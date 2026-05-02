import "server-only"
import { randomUUID } from "crypto"
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc"
import { generateWebhookSecret, deliverWebhook, assertSafeWebhookUrl } from "@/lib/webhooks"
import { encrypt, decrypt } from "@/lib/encryption"

const MAX_WEBHOOKS_PER_OWNER = 5

const WebhookEventSchema = z.enum([
  "MATCH_CREATED",
  "MATCH_ACCEPTED",
  "MATCH_DECLINED",
  "CONVERSATION_COMPLETED",
  "SUBSCRIPTION_CHANGED",
])

export const webhooksRouter = createTRPCRouter({
  create: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/webhooks",
        summary: "Create webhook subscription",
        tags: ["webhooks"],
      },
    })
    .input(
      z.object({
        url: z
          .string()
          .url()
          .refine((u) => u.startsWith("https://"), {
            message: "URL must use HTTPS",
          }),
        events: z.array(WebhookEventSchema).min(1, "At least one event is required"),
      }),
    )
    .output(
      z.object({
        id: z.string(),
        url: z.string(),
        events: z.array(WebhookEventSchema),
        secret: z.string(),
        createdAt: z.date(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const activeCount = await ctx.db.webhook.count({
        where: { ownerId: ctx.userId, active: true },
      })

      if (activeCount >= MAX_WEBHOOKS_PER_OWNER) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Maximum ${MAX_WEBHOOKS_PER_OWNER} active webhooks allowed`,
        })
      }

      // SSRF protection: reject URLs that resolve to private/loopback/metadata addresses.
      try {
        await assertSafeWebhookUrl(input.url)
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: err instanceof Error ? err.message : "Invalid webhook URL",
        })
      }

      const secret = generateWebhookSecret()
      const ownerType = ctx.userRole === "JOB_SEEKER" ? "SEEKER" : "EMPLOYER"

      // Pre-generate the webhook id so we can derive the encryption IV from it
      // before writing to the database — avoids a two-step create+update.
      const id = randomUUID()
      const encryptedSecret = await encrypt(secret, id)

      const webhook = await ctx.db.webhook.create({
        data: {
          id,
          url: input.url,
          events: input.events,
          secret: encryptedSecret,
          ownerId: ctx.userId,
          ownerType,
        },
      })

      return {
        id: webhook.id,
        url: webhook.url,
        events: webhook.events as z.infer<typeof WebhookEventSchema>[],
        // Return the plaintext secret once — never stored in plaintext.
        secret,
        createdAt: webhook.createdAt,
      }
    }),

  list: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/webhooks",
        summary: "List webhook subscriptions",
        tags: ["webhooks"],
      },
    })
    .input(z.void())
    .output(
      z.array(
        z.object({
          id: z.string(),
          url: z.string(),
          events: z.array(WebhookEventSchema),
          active: z.boolean(),
          createdAt: z.date(),
          lastFiredAt: z.date().nullable(),
          failCount: z.number(),
        }),
      ),
    )
    .query(async ({ ctx }) => {
      const webhooks = await ctx.db.webhook.findMany({
        where: { ownerId: ctx.userId, active: true },
        select: {
          id: true,
          url: true,
          events: true,
          active: true,
          createdAt: true,
          lastFiredAt: true,
          failCount: true,
          // secret intentionally excluded
        },
        orderBy: { createdAt: "desc" },
      })

      return webhooks.map((w) => ({
        ...w,
        events: w.events as z.infer<typeof WebhookEventSchema>[],
      }))
    }),

  delete: protectedProcedure
    .meta({
      openapi: {
        method: "DELETE",
        path: "/webhooks/{webhookId}",
        summary: "Delete webhook subscription",
        tags: ["webhooks"],
      },
    })
    .input(z.object({ webhookId: z.string() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const webhook = await ctx.db.webhook.findUnique({
        where: { id: input.webhookId },
      })

      if (!webhook || webhook.ownerId !== ctx.userId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Webhook not found" })
      }

      await ctx.db.webhook.update({
        where: { id: input.webhookId },
        data: { active: false },
      })

      return { success: true }
    }),

  test: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/webhooks/{webhookId}/test",
        summary: "Send a test event to a webhook",
        tags: ["webhooks"],
      },
    })
    .input(z.object({ webhookId: z.string() }))
    .output(
      z.object({
        success: z.boolean(),
        statusCode: z.number().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const webhook = await ctx.db.webhook.findUnique({
        where: { id: input.webhookId },
      })

      if (!webhook || webhook.ownerId !== ctx.userId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Webhook not found" })
      }

      const secret = await decrypt(webhook.secret, webhook.id)

      const result = await deliverWebhook(
        { id: webhook.id, url: webhook.url, secret },
        "MATCH_CREATED",
        { test: true, message: "JobBobber webhook test", webhookId: webhook.id },
      )

      return result
    }),
})
