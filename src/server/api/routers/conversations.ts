/**
 * Conversations router — read-only conversation log viewing.
 *
 * Provides seeker and employer access to agent conversation logs
 * with sensitive data redacted at the API layer.
 *
 * @see .specify/specs/12-agent-conversation-logs/spec.md
 */
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import {
  createTRPCRouter,
  protectedProcedure,
  seekerProcedure,
  employerProcedure,
} from "@/server/api/trpc"
import { assertFlagEnabled, CONVERSATION_LOGS } from "@/lib/flags"
import { redactConversationMessages } from "@/lib/redaction"
import { safeParseJsonArray } from "@/lib/schemas/prisma-json"
import { conversationMessageSchema } from "@/lib/conversation-schemas"

const statusEnum = z.enum(["IN_PROGRESS", "COMPLETED_MATCH", "COMPLETED_NO_MATCH", "TERMINATED"])

// ---------------------------------------------------------------------------
// Output schemas (required by trpc-to-openapi for annotated procedures)
// ---------------------------------------------------------------------------

const conversationSummarySchema = z.object({
  id: z.string(),
  jobPostingTitle: z.string(),
  status: statusEnum,
  messageCount: z.number(),
  startedAt: z.string(),
  completedAt: z.string().nullable(),
  outcome: z.string().nullable(),
})

const paginatedConversationsSchema = z.object({
  items: z.array(conversationSummarySchema),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
})

const conversationDetailSchema = z.object({
  id: z.string(),
  jobPostingTitle: z.string(),
  candidateName: z.string().nullable(),
  status: statusEnum,
  startedAt: z.string(),
  completedAt: z.string().nullable(),
  outcome: z.string().nullable(),
  messages: z.array(z.unknown()),
})

const listInput = z
  .object({
    cursor: z.string().optional(),
    limit: z.number().int().min(1).max(50).default(20),
    status: statusEnum.optional(),
  })
  .optional()
  .default({ limit: 20 })

export const conversationsRouter = createTRPCRouter({
  /** List conversations for the authenticated seeker */
  listForSeeker: seekerProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/conversations",
        summary: "List conversations for the authenticated seeker",
        tags: ["conversations"],
      },
    })
    .input(listInput)
    .output(paginatedConversationsSchema)
    .query(async ({ ctx, input }) => {
      await assertFlagEnabled(CONVERSATION_LOGS)

      const { cursor, limit, status } = input
      const where: Record<string, unknown> = { seekerId: ctx.seeker.id }
      if (status) where.status = status

      const items = await ctx.db.agentConversation.findMany({
        where,
        orderBy: { startedAt: "desc" },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: {
          jobPosting: { select: { id: true, title: true } },
          seeker: { select: { id: true, name: true } },
        },
      })

      const hasMore = items.length > limit
      const resultItems = hasMore ? items.slice(0, limit) : items

      return {
        items: resultItems.map((c) => ({
          id: c.id,
          jobPostingTitle: c.jobPosting.title,
          status: c.status,
          messageCount: Array.isArray(c.messages) ? c.messages.length : 0,
          startedAt: c.startedAt.toISOString(),
          completedAt: c.completedAt?.toISOString() ?? null,
          outcome: c.outcome,
        })),
        nextCursor: hasMore ? resultItems[resultItems.length - 1]!.id : null,
        hasMore,
      }
    }),

  /** List conversations for employer's job posting */
  listForEmployer: employerProcedure
    .input(
      z.object({
        jobPostingId: z.string().min(1),
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(50).default(20),
        status: statusEnum.optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await assertFlagEnabled(CONVERSATION_LOGS)

      const posting = await ctx.db.jobPosting.findUnique({
        where: { id: input.jobPostingId },
      })
      if (!posting || posting.employerId !== ctx.employer.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Posting not found" })
      }

      const where: Record<string, unknown> = { jobPostingId: input.jobPostingId }
      if (input.status) where.status = input.status

      const items = await ctx.db.agentConversation.findMany({
        where,
        orderBy: { startedAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        include: {
          jobPosting: { select: { id: true, title: true } },
          seeker: { select: { id: true, name: true } },
        },
      })

      const hasMore = items.length > input.limit
      const resultItems = hasMore ? items.slice(0, input.limit) : items

      return {
        items: resultItems.map((c) => ({
          id: c.id,
          jobPostingTitle: c.jobPosting.title,
          candidateName: c.seeker.name,
          status: c.status,
          messageCount: Array.isArray(c.messages) ? c.messages.length : 0,
          startedAt: c.startedAt.toISOString(),
          completedAt: c.completedAt?.toISOString() ?? null,
          outcome: c.outcome,
        })),
        nextCursor: hasMore ? resultItems[resultItems.length - 1]!.id : null,
        hasMore,
      }
    }),

  /** Get single conversation with redacted messages */
  getById: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/conversations/{conversationId}",
        summary: "Get a single conversation by ID",
        tags: ["conversations"],
      },
    })
    .input(z.object({ conversationId: z.string().min(1) }))
    .output(conversationDetailSchema)
    .query(async ({ ctx, input }) => {
      await assertFlagEnabled(CONVERSATION_LOGS)

      const conversation = await ctx.db.agentConversation.findUnique({
        where: { id: input.conversationId },
        include: {
          jobPosting: { select: { id: true, title: true, employerId: true } },
          seeker: { select: { id: true, name: true } },
        },
      })

      if (!conversation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" })
      }

      // Authorization: seeker owns conversation OR employer owns the posting
      const isSeeker = ctx.userRole === "JOB_SEEKER"
      const isEmployer = ctx.userRole === "EMPLOYER"

      if (isSeeker) {
        const seeker = await ctx.db.jobSeeker.findUnique({
          where: { clerkUserId: ctx.userId },
        })
        if (!seeker || conversation.seekerId !== seeker.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized" })
        }
      } else if (isEmployer) {
        if (!ctx.orgId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized" })
        }
        const employer = await ctx.db.employer.findUnique({
          where: { clerkOrgId: ctx.orgId },
        })
        if (!employer || conversation.jobPosting.employerId !== employer.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized" })
        }
      } else {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized" })
      }

      const rawMessages = Array.isArray(conversation.messages)
        ? safeParseJsonArray(conversationMessageSchema, conversation.messages)
        : []
      const messages = redactConversationMessages(rawMessages)

      return {
        id: conversation.id,
        jobPostingTitle: conversation.jobPosting.title,
        candidateName: isEmployer ? conversation.seeker.name : null,
        status: conversation.status,
        startedAt: conversation.startedAt.toISOString(),
        completedAt: conversation.completedAt?.toISOString() ?? null,
        outcome: conversation.outcome,
        messages,
      }
    }),
})
