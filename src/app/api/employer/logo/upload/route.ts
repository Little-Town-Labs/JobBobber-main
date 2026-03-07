import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"

/**
 * POST /api/employer/logo/upload
 *
 * Handles Vercel Blob client-upload token exchange for employer logo.
 * Auth check and employer org membership verified BEFORE delegating to handleUpload.
 *
 * Accepted: image/png, image/jpeg, image/webp — max 2 MB.
 * Logo URL is persisted via tRPC employers.updateLogo after upload.
 */
export async function POST(request: Request): Promise<Response> {
  const { userId, orgId, orgRole } = await (auth() as unknown as Promise<{
    userId: string | null
    orgId: string | null
    orgRole: string | null
  }>)
  if (!userId) {
    return new Response("Unauthorized", { status: 401 })
  }
  if (!orgId) {
    return new Response("Forbidden: Organization membership required", { status: 403 })
  }
  if (orgRole !== "org:admin") {
    return new Response("Forbidden: Admin role required", { status: 403 })
  }

  const employer = await db.employer.findUnique({ where: { clerkOrgId: orgId } })
  if (!employer) {
    return new Response("Forbidden: Employer account not found", { status: 403 })
  }

  const body = (await request.json()) as HandleUploadBody

  return handleUpload({
    body,
    request,
    onBeforeGenerateToken: async (_pathname: string) => {
      return {
        allowedContentTypes: ["image/png", "image/jpeg", "image/webp"],
        maximumSizeInBytes: 2 * 1024 * 1024, // 2 MB
        tokenPayload: JSON.stringify({ employerId: employer.id }),
      }
    },
    onUploadCompleted: async () => {
      // Intentionally empty — URL persisted via tRPC employers.updateLogo.
    },
  }) as unknown as Response
}
