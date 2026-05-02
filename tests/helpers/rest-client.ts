/**
 * REST test client for /api/v1/ route handlers.
 *
 * Calls the Next.js route handler directly (no server required) by importing
 * and invoking the handler with a synthesised Request object. This keeps
 * tests fast and avoids spinning up a full Next.js server.
 */

const BASE = "http://localhost:3000/api/v1"

async function getHandler(method: string) {
  const mod = await import("@/app/api/v1/[...path]/route")
  const m = method.toUpperCase() as keyof typeof mod
  return mod[m] as ((req: Request) => Promise<Response>) | undefined
}

/**
 * Make an unauthenticated request to a /api/v1/ path.
 */
export async function callV1(method: string, path: string, body?: unknown): Promise<Response> {
  const handler = await getHandler(method)
  if (!handler) throw new Error(`No handler exported for method ${method}`)

  const url = `${BASE}${path}`
  const isMutating = !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())
  const init: RequestInit = { method }
  if (body !== undefined) {
    init.body = JSON.stringify(body)
    init.headers = { "content-type": "application/json" }
  } else if (isMutating) {
    // trpc-to-openapi requires a parseable JSON body for POST/PUT/PATCH even when
    // all inputs come from path params. Send an empty object as the body.
    init.body = "{}"
    init.headers = { "content-type": "application/json" }
  }

  return handler(new Request(url, init))
}

/**
 * Make an authenticated request using an API key Bearer token.
 */
export async function callV1Authed(
  method: string,
  path: string,
  apiKey: string,
  body?: unknown,
): Promise<Response> {
  const handler = await getHandler(method)
  if (!handler) throw new Error(`No handler exported for method ${method}`)

  const url = `${BASE}${path}`
  const isMutating = !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())
  const headers: Record<string, string> = {
    authorization: `Bearer ${apiKey}`,
  }
  let resolvedBody: string | undefined
  if (body !== undefined) {
    resolvedBody = JSON.stringify(body)
    headers["content-type"] = "application/json"
  } else if (isMutating) {
    resolvedBody = "{}"
    headers["content-type"] = "application/json"
  }

  return handler(
    new Request(url, {
      method,
      headers,
      body: resolvedBody,
    }),
  )
}
