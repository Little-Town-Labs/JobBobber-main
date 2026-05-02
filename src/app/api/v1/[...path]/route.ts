import { createOpenApiFetchHandler } from "trpc-to-openapi"
import { appRouter } from "@/server/api/root"
import { db } from "@/lib/db"
import { inngest } from "@/lib/inngest"
import { checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit"
import { lookupApiKey } from "@/lib/api-keys"
import type { TRPCContext } from "@/server/api/trpc"

export const dynamic = "force-dynamic"

type ResolvedContext =
  | { earlyResponse: Response; ctx?: never }
  | { ctx: TRPCContext; earlyResponse?: never }

async function resolveContext(req: Request): Promise<ResolvedContext> {
  const authHeader = req.headers.get("authorization")
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null

  if (token?.startsWith("jb_live_")) {
    const apiKey = await lookupApiKey(token)
    if (!apiKey) {
      return {
        earlyResponse: new Response(
          JSON.stringify({ error: { code: "401", message: "Invalid or revoked API key" } }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        ),
      }
    }
    return {
      ctx: {
        db,
        inngest,
        userId: apiKey.ownerId,
        orgId: null,
        orgRole: null,
        userRole: apiKey.ownerType === "SEEKER" ? "JOB_SEEKER" : "EMPLOYER",
      },
    }
  }

  // No API key — pass token as-is (web session handled by Clerk at the app layer)
  return {
    ctx: {
      db,
      inngest,
      userId: token ?? null,
      orgId: null,
      orgRole: null,
      userRole: null,
    },
  }
}

const handler = async (req: Request): Promise<Response> => {
  const requestId = crypto.randomUUID()

  const resolved = await resolveContext(req)
  if (resolved.earlyResponse) {
    resolved.earlyResponse.headers.set("X-JobBobber-Request-Id", requestId)
    return resolved.earlyResponse
  }

  const ctx = resolved.ctx

  const response = await createOpenApiFetchHandler({
    endpoint: "/api/v1",
    router: appRouter,
    createContext: () => ctx,
    req,
  })

  const newHeaders = new Headers(response.headers)
  newHeaders.set("X-JobBobber-Request-Id", requestId)

  const identifier = req.headers.get("x-forwarded-for") ?? "anonymous"
  try {
    const rl = await checkRateLimit(identifier, "read")
    const rlHeaders = rateLimitHeaders(rl)
    for (const [k, v] of Object.entries(rlHeaders)) {
      newHeaders.set(k, v)
    }
  } catch {
    // Never let header injection fail a request
  }

  // Normalise error responses to a consistent { error: { code, message } } envelope
  if (!response.ok) {
    try {
      const errBody = (await response.json()) as { error?: { message?: string }; message?: string }
      const message =
        errBody?.error?.message ?? errBody?.message ?? response.statusText ?? "An error occurred"
      newHeaders.set("Content-Type", "application/json")
      if (response.status === 429) newHeaders.set("Retry-After", "60")
      return new Response(JSON.stringify({ error: { code: String(response.status), message } }), {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      })
    } catch {
      // Body unreadable — return as-is with request ID
    }
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  })
}

export const GET = handler
export const POST = handler
export const PUT = handler
export const PATCH = handler
export const DELETE = handler
