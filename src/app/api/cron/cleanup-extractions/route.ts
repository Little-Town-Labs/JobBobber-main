import { db } from "@/lib/db"

/**
 * GET /api/cron/cleanup-extractions
 *
 * Vercel Cron route that deletes expired ExtractionCache rows.
 * Protected by a CRON_SECRET bearer token in the Authorization header.
 *
 * Runs hourly (see vercel.json).
 */
export async function GET(request: Request): Promise<Response> {
  const secret = process.env["CRON_SECRET"]
  const authHeader = request.headers.get("authorization")

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 })
  }

  const { count } = await db.extractionCache.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  })

  return Response.json({ deleted: count })
}
