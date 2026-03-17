/**
 * POST /api/chat
 *
 * Streaming chat endpoint for user-to-agent conversations.
 * Uses Vercel AI SDK streamText with the user's BYOK API key.
 * Messages persisted to ChatMessage table.
 *
 * @see .specify/specs/19-user-chat-basic/spec.md
 */
import { streamText } from "ai"
import { z } from "zod"
import { getAuth } from "@/lib/auth"
import { db } from "@/lib/db"
import { decrypt } from "@/lib/encryption"
import { checkRateLimit } from "@/lib/rate-limit"
import { createProvider } from "@/server/agents/employer-agent"
import { assembleChatContext, buildChatSystemPrompt } from "@/server/agents/chat-agent"

const MAX_MESSAGE_LENGTH = 5000

const chatInputSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().max(MAX_MESSAGE_LENGTH),
    }),
  ),
})

/** Model selection: lighter models for cost-efficient chat */
function getChatModel(provider: string): string {
  if (provider === "openai") return "gpt-4o-mini"
  if (provider === "anthropic") return "claude-haiku-4-5-20251001"
  return "gpt-4o-mini"
}

export async function POST(request: Request): Promise<Response> {
  // 1. Auth
  const { userId, sessionClaims } = await getAuth()
  if (!userId) {
    return new Response("Unauthorized", { status: 401 })
  }

  const userRole = sessionClaims?.metadata?.role as "JOB_SEEKER" | "EMPLOYER" | undefined

  // 2. Rate limit
  const rateLimitResult = await checkRateLimit(userId, "chat")
  if (!rateLimitResult.success) {
    return new Response("Too many messages. Please wait a moment.", { status: 429 })
  }

  // 3. Parse and validate input
  const body = await request.json()
  const parsed = chatInputSchema.safeParse(body)
  if (!parsed.success) {
    return new Response("Invalid input: messages required, max 5000 chars per message", {
      status: 400,
    })
  }

  const { messages } = parsed.data
  const lastUserMessage = messages.filter((m) => m.role === "user").pop()

  // 4. Look up BYOK key
  let encryptedKey: string | null = null
  let provider: string | null = null
  let scopeId: string = userId

  if (userRole === "EMPLOYER") {
    const employer = await db.employer.findUnique({
      where: { clerkOrgId: userId },
      select: { id: true, byokApiKeyEncrypted: true, byokProvider: true },
    })
    if (!employer?.byokApiKeyEncrypted || !employer.byokProvider) {
      return new Response("API key not configured. Please set up your BYOK key.", { status: 403 })
    }
    encryptedKey = employer.byokApiKeyEncrypted
    provider = employer.byokProvider
    scopeId = employer.id
  } else {
    const seeker = await db.jobSeeker.findUnique({
      where: { clerkUserId: userId },
      select: { id: true },
    })
    if (!seeker) {
      return new Response("Profile not found. Please complete onboarding.", { status: 403 })
    }
    const settings = await db.seekerSettings.findUnique({
      where: { seekerId: seeker.id },
      select: { byokApiKeyEncrypted: true, byokProvider: true },
    })
    if (!settings?.byokApiKeyEncrypted || !settings.byokProvider) {
      return new Response("API key not configured. Please set up your BYOK key.", { status: 403 })
    }
    encryptedKey = settings.byokApiKeyEncrypted
    provider = settings.byokProvider
    scopeId = seeker.id
  }

  // 5. Decrypt BYOK key
  const apiKey = await decrypt(encryptedKey, scopeId)

  // 6. Assemble context
  const context = await assembleChatContext(db, userId, userRole ?? "JOB_SEEKER")
  const systemPrompt = buildChatSystemPrompt(context)

  // 7. Persist user message
  if (lastUserMessage) {
    await db.chatMessage.create({
      data: {
        clerkUserId: userId,
        role: "USER",
        content: lastUserMessage.content,
      },
    })
  }

  // 8. Stream LLM response
  const model = createProvider(provider, apiKey)
  const result = streamText({
    model: model(getChatModel(provider)),
    system: systemPrompt,
    messages,
    onFinish: async ({ text }) => {
      // 9. Persist assistant message after streaming completes
      if (text) {
        await db.chatMessage.create({
          data: {
            clerkUserId: userId,
            role: "ASSISTANT",
            content: text,
          },
        })
      }
    },
  })

  return result.toTextStreamResponse()
}
