/**
 * Chat history router — cursor-based paginated access to chat messages.
 *
 * Gated behind the USER_CHAT feature flag.
 */
import { z } from "zod"
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc"
import { assertFlagEnabled, USER_CHAT } from "@/lib/flags"

export const chatRouter = createTRPCRouter({
  /** Get paginated chat history for the authenticated user */
  getHistory: protectedProcedure
    .input(
      z
        .object({
          cursor: z.string().optional(),
          limit: z.number().int().min(1).max(100).default(50),
        })
        .optional()
        .default({ limit: 50 }),
    )
    .query(async ({ ctx, input }) => {
      await assertFlagEnabled(USER_CHAT)

      const { cursor, limit } = input

      const items = await ctx.db.chatMessage.findMany({
        where: { clerkUserId: ctx.userId },
        orderBy: { createdAt: "desc" },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      })

      const hasMore = items.length > limit
      const resultItems = hasMore ? items.slice(0, limit) : items

      return {
        items: resultItems.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt.toISOString(),
        })),
        nextCursor: hasMore ? resultItems[resultItems.length - 1]!.id : null,
        hasMore,
      }
    }),
})
