import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"

/**
 * POST /api/resume/upload
 *
 * Handles Vercel Blob client-upload token exchange.
 * Auth check and seeker lookup are performed BEFORE delegating to handleUpload.
 *
 * Upload flow:
 *   1. Browser calls this endpoint to obtain a client token.
 *   2. Browser PUTs the file directly to Vercel Blob using the token.
 *   3. Browser calls tRPC resume.confirmUpload to persist the blob URL.
 *
 * onUploadCompleted is intentionally empty — URL persistence is handled
 * by tRPC resume.confirmUpload so that the client can review the URL
 * before it is stored on the JobSeeker row.
 */
export async function POST(request: Request): Promise<Response> {
  const { userId } = await auth()
  if (!userId) {
    return new Response("Unauthorized", { status: 401 })
  }

  const seeker = await db.jobSeeker.findUnique({ where: { clerkUserId: userId } })
  if (!seeker) {
    return new Response("Forbidden: Job seeker account not found", { status: 403 })
  }

  const body = (await request.json()) as HandleUploadBody

  return handleUpload({
    body,
    request,
    onBeforeGenerateToken: async (_pathname: string) => {
      return {
        allowedContentTypes: [
          "application/pdf",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
        maximumSizeInBytes: 10 * 1024 * 1024, // 10 MiB
        tokenPayload: JSON.stringify({ seekerId: seeker.id }),
      }
    },
    onUploadCompleted: async () => {
      // Intentionally empty — URL persistence handled by tRPC resume.confirmUpload.
      // The client calls confirmUpload after the direct PUT completes, which
      // validates and stores the blob URL on the JobSeeker row.
    },
  }) as unknown as Response
}
