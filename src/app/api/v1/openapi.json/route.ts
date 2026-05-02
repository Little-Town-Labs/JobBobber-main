import { generateOpenApiDocument } from "trpc-to-openapi"
import { appRouter } from "@/server/api/root"
import { env } from "@/lib/env"

export const dynamic = "force-dynamic"

export function GET() {
  const spec = generateOpenApiDocument(appRouter, {
    title: "JobBobber API",
    version: "1.0.0",
    baseUrl: `${env.NEXT_PUBLIC_APP_URL}/api/v1`,
    description:
      "REST API for the JobBobber agent platform. Authenticate with `Authorization: Bearer <api-key>`.",
    tags: ["system", "postings", "matches", "profile", "conversations", "insights"],
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        description: "API key prefixed with `jb_live_`",
      },
    },
  })

  return Response.json(spec)
}
