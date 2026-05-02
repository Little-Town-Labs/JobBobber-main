// Not part of the public REST API — org member management, internal UI-only router.
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { clerkClient } from "@clerk/nextjs/server"
import { createTRPCRouter, employerProcedure, adminProcedure } from "@/server/api/trpc"
import { logActivity } from "@/lib/activity-log"
import { assertFlagEnabled, MULTI_MEMBER_EMPLOYER } from "@/lib/flags"

export const teamRouter = createTRPCRouter({
  listMembers: employerProcedure.query(async ({ ctx }) => {
    await assertFlagEnabled(MULTI_MEMBER_EMPLOYER)
    const members = await ctx.db.employerMember.findMany({
      where: { employerId: ctx.employer.id },
      orderBy: { joinedAt: "asc" },
    })
    return members.map((m) => ({
      id: m.id,
      clerkUserId: m.clerkUserId,
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
    }))
  }),

  invite: adminProcedure
    .input(
      z.object({
        email: z.string().email(),
        role: z.enum(["ADMIN", "JOB_POSTER", "VIEWER"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertFlagEnabled(MULTI_MEMBER_EMPLOYER)

      // Check for duplicate pending invitation
      const existing = await ctx.db.invitation.findFirst({
        where: {
          employerId: ctx.employer.id,
          email: input.email,
          status: "PENDING",
        },
      })
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An invitation is already pending for this email",
        })
      }

      // Create Clerk organization invitation
      const clerk = await clerkClient()
      const clerkInvitation = await clerk.organizations.createOrganizationInvitation({
        organizationId: ctx.orgId ?? "",
        emailAddress: input.email,
        role: input.role === "ADMIN" ? "org:admin" : "org:member",
        inviterUserId: ctx.userId ?? "",
      })

      // Store invitation in DB
      const invitation = await ctx.db.invitation.create({
        data: {
          employerId: ctx.employer.id,
          email: input.email,
          role: input.role,
          invitedBy: ctx.userId ?? "",
          clerkInvitationId: clerkInvitation.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      })

      await logActivity({
        employerId: ctx.employer.id,
        actorClerkUserId: ctx.userId ?? "",
        actorName: ctx.member.clerkUserId ?? "",
        action: "member.invited",
        targetLabel: input.email,
      })

      return {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt.toISOString(),
        createdAt: invitation.createdAt.toISOString(),
      }
    }),

  updateRole: adminProcedure
    .input(
      z.object({
        memberId: z.string().min(1),
        role: z.enum(["ADMIN", "JOB_POSTER", "VIEWER"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertFlagEnabled(MULTI_MEMBER_EMPLOYER)

      const member = await ctx.db.employerMember.findUnique({
        where: { id: input.memberId },
      })
      if (!member || member.employerId !== ctx.employer.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" })
      }

      // Prevent demoting the last admin
      if (member.role === "ADMIN" && input.role !== "ADMIN") {
        const adminCount = await ctx.db.employerMember.count({
          where: { employerId: ctx.employer.id, role: "ADMIN" },
        })
        if (adminCount <= 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot demote the last admin",
          })
        }
      }

      const updated = await ctx.db.employerMember.update({
        where: { id: input.memberId },
        data: { role: input.role },
      })

      await logActivity({
        employerId: ctx.employer.id,
        actorClerkUserId: ctx.userId ?? "",
        actorName: ctx.member.clerkUserId ?? "",
        action: "member.role_changed",
        targetType: "EmployerMember",
        targetId: input.memberId,
        targetLabel: `${input.role}`,
      })

      return {
        id: updated.id,
        clerkUserId: updated.clerkUserId,
        role: updated.role,
        joinedAt: updated.joinedAt.toISOString(),
      }
    }),

  removeMember: adminProcedure
    .input(z.object({ memberId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await assertFlagEnabled(MULTI_MEMBER_EMPLOYER)

      const member = await ctx.db.employerMember.findUnique({
        where: { id: input.memberId },
      })
      if (!member || member.employerId !== ctx.employer.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" })
      }

      // Prevent removing the last admin
      if (member.role === "ADMIN") {
        const adminCount = await ctx.db.employerMember.count({
          where: { employerId: ctx.employer.id, role: "ADMIN" },
        })
        if (adminCount <= 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot remove the last admin",
          })
        }
      }

      // Remove from Clerk organization
      try {
        const clerk = await clerkClient()
        await clerk.organizations.deleteOrganizationMembership({
          organizationId: ctx.orgId ?? "",
          userId: member.clerkUserId,
        })
      } catch {
        // Best-effort Clerk sync — DB is source of truth
      }

      await ctx.db.employerMember.delete({ where: { id: input.memberId } })

      await logActivity({
        employerId: ctx.employer.id,
        actorClerkUserId: ctx.userId ?? "",
        actorName: ctx.member.clerkUserId ?? "",
        action: "member.removed",
        targetType: "EmployerMember",
        targetId: input.memberId,
      })

      return { success: true }
    }),

  listInvitations: adminProcedure.query(async ({ ctx }) => {
    await assertFlagEnabled(MULTI_MEMBER_EMPLOYER)

    const invitations = await ctx.db.invitation.findMany({
      where: {
        employerId: ctx.employer.id,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    })

    return invitations.map((inv) => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      status: inv.status,
      invitedBy: inv.invitedBy,
      expiresAt: inv.expiresAt.toISOString(),
      createdAt: inv.createdAt.toISOString(),
    }))
  }),

  revokeInvitation: adminProcedure
    .input(z.object({ invitationId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await assertFlagEnabled(MULTI_MEMBER_EMPLOYER)

      const invitation = await ctx.db.invitation.findUnique({
        where: { id: input.invitationId },
      })
      if (!invitation || invitation.employerId !== ctx.employer.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found" })
      }
      if (invitation.status !== "PENDING") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only pending invitations can be revoked",
        })
      }

      // Revoke in Clerk
      if (invitation.clerkInvitationId) {
        try {
          const clerk = await clerkClient()
          await clerk.organizations.revokeOrganizationInvitation({
            organizationId: ctx.orgId ?? "",
            invitationId: invitation.clerkInvitationId,
            requestingUserId: ctx.userId ?? undefined,
          })
        } catch {
          // Best-effort Clerk sync
        }
      }

      await ctx.db.invitation.update({
        where: { id: input.invitationId },
        data: { status: "REVOKED" },
      })

      await logActivity({
        employerId: ctx.employer.id,
        actorClerkUserId: ctx.userId ?? "",
        actorName: ctx.member.clerkUserId ?? "",
        action: "invitation.revoked",
        targetLabel: invitation.email,
      })

      return { success: true }
    }),

  getActivityLog: adminProcedure
    .input(
      z
        .object({
          cursor: z.string().optional(),
          limit: z.number().int().min(1).max(100).default(20),
          // Feature 17: filter by team member or action type
          actorClerkUserId: z.string().optional(),
          action: z.string().optional(),
        })
        .default({ limit: 20 }),
    )
    .query(async ({ ctx, input }) => {
      await assertFlagEnabled(MULTI_MEMBER_EMPLOYER)

      const { cursor, limit = 20, actorClerkUserId, action } = input ?? {}

      const where: Record<string, unknown> = { employerId: ctx.employer.id }
      if (actorClerkUserId) where.actorClerkUserId = actorClerkUserId
      if (action) where.action = action

      const items = await ctx.db.activityLog.findMany({
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
          actorName: entry.actorName,
          action: entry.action,
          targetType: entry.targetType,
          targetLabel: entry.targetLabel,
          createdAt: entry.createdAt.toISOString(),
        })),
        nextCursor: hasMore ? resultItems[resultItems.length - 1]!.id : null,
        hasMore,
      }
    }),
})
