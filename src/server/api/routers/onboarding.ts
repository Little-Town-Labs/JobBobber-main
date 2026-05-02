// Not part of the public REST API — one-time UI onboarding flow, internal router.
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { clerkClient } from "@clerk/nextjs/server"
import { createTRPCRouter, onboardingProcedure } from "@/server/api/trpc"

/**
 * Onboarding router — role selection and initial account setup.
 *
 * Uses `onboardingProcedure` (not `protectedProcedure`) because these
 * mutations are called BEFORE the user has a role. `protectedProcedure`
 * requires `userRole` to be non-null, creating a circular dependency.
 *
 * @see src/server/api/trpc.ts — onboardingProcedure definition
 * @see .specify/specs/2-authentication-byok/data-model.md — data flows
 */

const SetRoleInputSchema = z
  .object({
    role: z.enum(["JOB_SEEKER", "EMPLOYER"]),
    companyName: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === "EMPLOYER") {
      if (!data.companyName || data.companyName.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Company name is required for employers",
          path: ["companyName"],
        })
      }
    }
  })

export const onboardingRouter = createTRPCRouter({
  /**
   * Set the user's role and create the appropriate DB records.
   *
   * JOB_SEEKER:
   *   - Creates JobSeeker + SeekerSettings (in $transaction)
   *   - Updates Clerk publicMetadata: { role: 'JOB_SEEKER' }
   *
   * EMPLOYER:
   *   - Creates Clerk Organization (synchronous — org must exist before DB write)
   *   - Creates Employer + EmployerMember (ADMIN) (in $transaction)
   *   - Updates Clerk publicMetadata: { role: 'EMPLOYER' }
   *   - Orphan cleanup: deletes Clerk org if DB transaction fails
   *
   * Idempotent: if userRole is already set, returns success immediately.
   */
  setRole: onboardingProcedure.input(SetRoleInputSchema).mutation(async ({ ctx, input }) => {
    // Idempotency: short-circuit if role already assigned
    if (ctx.userRole) {
      return { success: true as const, redirectTo: "/setup/api-key" as const }
    }

    if (input.role === "JOB_SEEKER") {
      // Create JobSeeker + SeekerSettings in a single transaction
      await ctx.db.$transaction(async (tx) => {
        const seeker = await tx.jobSeeker.create({
          data: {
            clerkUserId: ctx.userId,
            name: "", // populated later in profile setup (Feature 3)
            skills: [],
          },
        })
        await tx.seekerSettings.create({ data: { seekerId: seeker.id } })
      })

      // Update Clerk metadata (after DB success)
      const clerk = await clerkClient()
      await clerk.users.updateUserMetadata(ctx.userId, {
        publicMetadata: { role: "JOB_SEEKER" },
      })

      return { success: true as const, redirectTo: "/setup/api-key" as const }
    }

    // EMPLOYER path
    // Step 1: Create Clerk Org (synchronous — must be done first for orgId)
    const clerk = await clerkClient()
    const org = await clerk.organizations.createOrganization({
      name: input.companyName!,
      createdBy: ctx.userId,
    })

    // Step 2: Create Employer + EmployerMember in a transaction
    // If this fails, we must clean up the Clerk org (orphan cleanup)
    try {
      await ctx.db.$transaction(async (tx) => {
        const employer = await tx.employer.create({
          data: {
            clerkOrgId: org.id,
            name: input.companyName!,
          },
        })
        await tx.employerMember.create({
          data: {
            employerId: employer.id,
            clerkUserId: ctx.userId,
            role: "ADMIN",
            invitedBy: null,
          },
        })
      })
    } catch (err) {
      // Orphan cleanup: delete the Clerk org if DB write fails
      try {
        await clerk.organizations.deleteOrganization(org.id)
      } catch (cleanupErr) {
        // Best-effort cleanup — log the failure but don't rethrow
        console.error(
          "[onboarding.setRole] Failed to delete orphaned Clerk org:",
          org.id,
          cleanupErr,
        )
      }
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create employer account. Please try again.",
        cause: err,
      })
    }

    // Update Clerk metadata (after DB success)
    await clerk.users.updateUserMetadata(ctx.userId, {
      publicMetadata: { role: "EMPLOYER" },
    })

    return { success: true as const, redirectTo: "/setup/api-key" as const }
  }),
})
