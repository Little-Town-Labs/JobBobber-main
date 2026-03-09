import { inngest } from "@/lib/inngest"
import { db } from "@/lib/db"
import { clerkClient } from "@clerk/nextjs/server"
import { logAudit } from "@/lib/audit"

interface DeletionInput {
  deletionRequestId: string
  clerkUserId: string
  clerkOrgId?: string | null
}

interface DeletionResult {
  completed?: boolean
  skipped?: boolean
  failed?: boolean
  reason?: string
  error?: string
}

/**
 * Core account deletion logic — extracted for testability.
 * Called by the Inngest function handler via step.run().
 */
export async function executeAccountDeletionHandler(input: DeletionInput): Promise<DeletionResult> {
  const { deletionRequestId, clerkUserId, clerkOrgId } = input

  // 1. Fetch the deletion request
  const request = await db.deletionRequest.findUnique({
    where: { id: deletionRequestId },
  })

  if (!request) {
    return { skipped: true, reason: "request_not_found" }
  }

  // 2. Check if cancelled during grace period
  if (request.status !== "PENDING") {
    return { skipped: true, reason: "request_cancelled" }
  }

  // 3. Mark as executing
  await db.deletionRequest.update({
    where: { id: deletionRequestId },
    data: { status: "EXECUTING" },
  })

  try {
    // 4. Terminate active conversations
    await db.agentConversation.updateMany({
      where: {
        seeker: { clerkUserId },
        status: "IN_PROGRESS",
      },
      data: { status: "TERMINATED" },
    })

    if (request.userType === "EMPLOYER" && clerkOrgId) {
      // 4b. Also terminate employer-side conversations
      await db.agentConversation.updateMany({
        where: {
          jobPosting: { employer: { clerkOrgId } },
          status: "IN_PROGRESS",
        },
        data: { status: "TERMINATED" },
      })

      // 5. Close active job postings
      await db.jobPosting.updateMany({
        where: {
          employer: { clerkOrgId },
          status: { in: ["ACTIVE", "PAUSED", "DRAFT"] },
        },
        data: { status: "CLOSED" },
      })

      // 6. Delete employer record (cascades to members, postings, settings, etc.)
      await db.employer.delete({
        where: { clerkOrgId },
      })
    } else {
      // 6. Delete seeker record (cascades to settings, conversations, matches, etc.)
      await db.jobSeeker.delete({
        where: { clerkUserId },
      })
    }

    // 7. Delete Clerk user account
    const clerk = await clerkClient()
    await clerk.users.deleteUser(clerkUserId)

    // For employers, also delete the organization
    if (request.userType === "EMPLOYER" && clerkOrgId) {
      try {
        await clerk.organizations.deleteOrganization(clerkOrgId)
      } catch {
        // Best-effort — org may already be cleaned up
      }
    }

    // 8. Mark as completed
    await db.deletionRequest.update({
      where: { id: deletionRequestId },
      data: { status: "COMPLETED", executedAt: new Date() },
    })

    await logAudit({
      actorId: "SYSTEM",
      actorType: "SYSTEM",
      action: "account.deletion.completed",
      entityType: "DeletionRequest",
      entityId: deletionRequestId,
      metadata: { clerkUserId, userType: request.userType },
      result: "SUCCESS",
    })

    return { completed: true }
  } catch (error) {
    // Mark as failed so it can be retried or investigated
    await db.deletionRequest.update({
      where: { id: deletionRequestId },
      data: { status: "FAILED" },
    })

    await logAudit({
      actorId: "SYSTEM",
      actorType: "SYSTEM",
      action: "account.deletion.failed",
      entityType: "DeletionRequest",
      entityId: deletionRequestId,
      metadata: {
        clerkUserId,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      result: "FAILURE",
    })

    return {
      failed: true,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Inngest function that executes account deletion after 72-hour grace period.
 * Triggered by "compliance/account.deletion.execute" event.
 */
export const executeAccountDeletion = inngest.createFunction(
  {
    id: "execute-account-deletion",
    retries: 3,
  },
  { event: "compliance/account.deletion.execute" },
  async ({ event, step }) => {
    const { deletionRequestId, clerkUserId, clerkOrgId } = event.data as DeletionInput

    return await step.run("execute-deletion", async () => {
      return executeAccountDeletionHandler({ deletionRequestId, clerkUserId, clerkOrgId })
    })
  },
)
