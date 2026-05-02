// Not part of the public REST API — GDPR/compliance actions are admin-only, internal router.
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { createTRPCRouter, protectedProcedure, adminProcedure } from "@/server/api/trpc"
import { assertFlagEnabled, COMPLIANCE_SECURITY } from "@/lib/flags"
import { logAudit } from "@/lib/audit"

/**
 * Feature 18 — Compliance & Security router.
 *
 * Provides GDPR data export, account deletion with 72-hour grace period,
 * compliance audit log (admin-only), and MFA status stubs.
 *
 * protectedProcedure is used for export/deletion (both seekers and employers).
 * adminProcedure is used for getAuditLog (employer admins only).
 */
export const complianceRouter = createTRPCRouter({
  // ---------------------------------------------------------------------------
  // exportMyData — GDPR data export
  // ---------------------------------------------------------------------------
  exportMyData: protectedProcedure.query(async ({ ctx }) => {
    await assertFlagEnabled(COMPLIANCE_SECURITY)

    const exportedAt = new Date().toISOString()

    if (ctx.userRole === "JOB_SEEKER") {
      const profile = await ctx.db.jobSeeker.findUnique({
        where: { clerkUserId: ctx.userId },
      })

      const [rawSettings, matches, conversations, feedbackInsights] = profile
        ? await Promise.all([
            ctx.db.seekerSettings.findUnique({ where: { seekerId: profile.id } }),
            ctx.db.match.findMany({ where: { seekerId: profile.id } }),
            ctx.db.agentConversation.findMany({ where: { seekerId: profile.id } }),
            ctx.db.feedbackInsights.findUnique({
              where: { userId_userType: { userId: profile.id, userType: "JOB_SEEKER" } },
            }),
          ])
        : [null, [], [], null]

      // Strip sensitive encrypted key from exported settings
      const settings = rawSettings
        ? (() => {
            const { byokApiKeyEncrypted: _key, ...safe } = rawSettings
            return safe
          })()
        : null

      await logAudit({
        actorId: ctx.userId,
        actorType: "JOB_SEEKER",
        action: "data.exported",
        entityType: "JobSeeker",
        entityId: profile?.id,
        result: "SUCCESS",
      })

      return {
        exportedAt,
        userType: "JOB_SEEKER" as const,
        profile,
        settings,
        matches,
        conversations,
        feedbackInsights,
        dataUsageOptOut: rawSettings?.dataUsageOptOut ?? false,
      }
    }

    // EMPLOYER path
    const rawProfile = await ctx.db.employer.findUnique({
      where: { clerkOrgId: ctx.orgId ?? "" },
    })

    // Strip sensitive encrypted key from employer profile
    const profile = rawProfile
      ? (() => {
          const { byokApiKeyEncrypted: _key, ...safe } = rawProfile
          return safe
        })()
      : null

    const [jobPostings, matches, conversations, feedbackInsights] = rawProfile
      ? await Promise.all([
          ctx.db.jobPosting.findMany({
            where: { employerId: rawProfile.id },
            include: { settings: true },
          }),
          ctx.db.match.findMany({ where: { employerId: rawProfile.id } }),
          ctx.db.agentConversation.findMany({
            where: { jobPosting: { employerId: rawProfile.id } },
          }),
          ctx.db.feedbackInsights.findUnique({
            where: { userId_userType: { userId: rawProfile.id, userType: "EMPLOYER" } },
          }),
        ])
      : [[], [], [], null]

    // Strip byokApiKeyEncrypted from job settings
    const sanitizedPostings = jobPostings.map((jp) => {
      if (jp.settings) {
        const { byokApiKeyEncrypted: _key, ...safeSettings } = jp.settings
        return { ...jp, settings: safeSettings }
      }
      return jp
    })

    await logAudit({
      actorId: ctx.userId,
      actorType: "EMPLOYER",
      action: "data.exported",
      entityType: "Employer",
      entityId: rawProfile?.id,
      result: "SUCCESS",
    })

    return {
      exportedAt,
      userType: "EMPLOYER" as const,
      profile,
      jobPostings: sanitizedPostings,
      matches,
      conversations,
      feedbackInsights,
      dataUsageOptOut: rawProfile?.dataUsageOptOut ?? false,
    }
  }),

  // ---------------------------------------------------------------------------
  // requestDeletion — 72-hour grace period deletion
  // ---------------------------------------------------------------------------
  requestDeletion: protectedProcedure
    .input(
      z.object({
        confirmation: z.string(),
        reason: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertFlagEnabled(COMPLIANCE_SECURITY)

      if (input.confirmation !== "DELETE MY ACCOUNT") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: 'You must type "DELETE MY ACCOUNT" to confirm.',
        })
      }

      // Check for existing pending deletion
      const existing = await ctx.db.deletionRequest.findUnique({
        where: { clerkUserId: ctx.userId },
      })
      if (existing && existing.status === "PENDING") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A deletion request is already pending.",
        })
      }

      const scheduledAt = new Date(Date.now() + 72 * 60 * 60 * 1000)
      const userType = ctx.userRole === "JOB_SEEKER" ? "JOB_SEEKER" : "EMPLOYER"

      const request = await ctx.db.deletionRequest.create({
        data: {
          clerkUserId: ctx.userId,
          userType,
          status: "PENDING",
          reason: input.reason ?? null,
          scheduledAt,
        },
      })

      // Schedule the deletion via Inngest
      await ctx.inngest.send({
        name: "compliance/account.deletion.execute",
        data: {
          deletionRequestId: request.id,
          clerkUserId: ctx.userId,
          clerkOrgId: ctx.orgId ?? null,
        },
        ts: scheduledAt.getTime(),
      })

      await logAudit({
        actorId: ctx.userId,
        actorType: userType,
        action: "account.deletion.requested",
        entityType: "DeletionRequest",
        entityId: request.id,
        metadata: { reason: input.reason ?? null, scheduledAt: scheduledAt.toISOString() },
        result: "SUCCESS",
      })

      return {
        id: request.id,
        status: request.status,
        scheduledAt: request.scheduledAt.toISOString(),
      }
    }),

  // ---------------------------------------------------------------------------
  // cancelDeletion
  // ---------------------------------------------------------------------------
  cancelDeletion: protectedProcedure.mutation(async ({ ctx }) => {
    await assertFlagEnabled(COMPLIANCE_SECURITY)

    const existing = await ctx.db.deletionRequest.findUnique({
      where: { clerkUserId: ctx.userId },
    })
    if (!existing || existing.status !== "PENDING") {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No pending deletion request found.",
      })
    }

    const updated = await ctx.db.deletionRequest.update({
      where: { clerkUserId: ctx.userId },
      data: { status: "CANCELLED" },
    })

    await logAudit({
      actorId: ctx.userId,
      actorType: existing.userType === "JOB_SEEKER" ? "JOB_SEEKER" : "EMPLOYER",
      action: "account.deletion.cancelled",
      entityType: "DeletionRequest",
      entityId: existing.id,
      result: "SUCCESS",
    })

    return {
      id: updated.id,
      status: updated.status,
    }
  }),

  // ---------------------------------------------------------------------------
  // getDeletionStatus
  // ---------------------------------------------------------------------------
  getDeletionStatus: protectedProcedure.query(async ({ ctx }) => {
    await assertFlagEnabled(COMPLIANCE_SECURITY)

    const request = await ctx.db.deletionRequest.findUnique({
      where: { clerkUserId: ctx.userId },
    })

    if (!request || request.status !== "PENDING") {
      return { hasPendingDeletion: false, request: null }
    }

    return {
      hasPendingDeletion: true,
      request: {
        id: request.id,
        status: request.status,
        reason: request.reason,
        scheduledAt: request.scheduledAt.toISOString(),
        requestedAt: request.requestedAt.toISOString(),
      },
    }
  }),

  // ---------------------------------------------------------------------------
  // getAuditLog — admin only, cursor-based pagination
  // ---------------------------------------------------------------------------
  getAuditLog: adminProcedure
    .input(
      z
        .object({
          action: z.string().optional(),
          actorId: z.string().optional(),
          dateFrom: z.string().optional(),
          dateTo: z.string().optional(),
          cursor: z.string().optional(),
          limit: z.number().int().min(1).max(100).default(20),
        })
        .default({ limit: 20 }),
    )
    .query(async ({ ctx, input }) => {
      await assertFlagEnabled(COMPLIANCE_SECURITY)

      const { cursor, limit, action, actorId, dateFrom, dateTo } = input

      // Scope audit logs to the caller's employer organization
      // Only show entries from users who are members of this org
      const orgMembers = await ctx.db.employerMember.findMany({
        where: { employerId: ctx.employer.id },
        select: { clerkUserId: true },
      })
      const orgUserIds = orgMembers.map((m) => m.clerkUserId)

      const allowedActorIds = [...orgUserIds, "SYSTEM"]
      const where: Record<string, unknown> = {
        actorId: { in: allowedActorIds },
      }
      if (action) where.action = action
      if (actorId) {
        // Validate actorId belongs to this org to prevent cross-tenant access
        if (!allowedActorIds.includes(actorId)) {
          return { items: [], nextCursor: null, hasMore: false }
        }
        where.actorId = actorId
      }
      if (dateFrom || dateTo) {
        const createdAt: Record<string, Date> = {}
        if (dateFrom) createdAt.gte = new Date(dateFrom)
        if (dateTo) createdAt.lte = new Date(dateTo)
        where.createdAt = createdAt
      }

      const items = await ctx.db.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      })

      const hasMore = items.length > limit
      const resultItems = hasMore ? items.slice(0, limit) : items

      return {
        items: resultItems.map((entry) => ({
          id: entry.id,
          actorId: entry.actorId,
          actorType: entry.actorType,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          metadata: entry.metadata,
          result: entry.result,
          createdAt: entry.createdAt.toISOString(),
        })),
        nextCursor: hasMore ? (resultItems.at(-1)?.id ?? null) : null,
        hasMore,
      }
    }),

  // ---------------------------------------------------------------------------
  // getMfaStatus — stub
  // ---------------------------------------------------------------------------
  getMfaStatus: protectedProcedure.query(async () => {
    await assertFlagEnabled(COMPLIANCE_SECURITY)

    return {
      mfaEnabled: false,
      mfaDismissedAt: null,
      shouldPrompt: true,
    }
  }),

  // ---------------------------------------------------------------------------
  // dismissMfaPrompt — stub
  // ---------------------------------------------------------------------------
  dismissMfaPrompt: protectedProcedure.mutation(async () => {
    await assertFlagEnabled(COMPLIANCE_SECURITY)

    return { dismissed: true }
  }),
})
