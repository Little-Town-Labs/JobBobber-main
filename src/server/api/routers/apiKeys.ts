import "server-only"
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc"
import { generateApiKey, hashApiKey } from "@/lib/api-keys"

const MAX_KEYS_PER_OWNER = 10

export const apiKeysRouter = createTRPCRouter({
  create: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/keys",
        summary: "Create API key",
        tags: ["keys"],
      },
    })
    .input(z.object({ label: z.string().min(1).max(100) }))
    .output(
      z.object({
        id: z.string(),
        raw: z.string(),
        label: z.string(),
        prefix: z.string(),
        createdAt: z.date(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const activeCount = await ctx.db.apiKey.count({
        where: { ownerId: ctx.userId, revokedAt: null },
      })
      if (activeCount >= MAX_KEYS_PER_OWNER) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Maximum ${MAX_KEYS_PER_OWNER} active keys allowed`,
        })
      }

      const { raw, prefix } = generateApiKey()
      const keyHash = hashApiKey(raw)
      const ownerType = ctx.userRole === "JOB_SEEKER" ? "SEEKER" : "EMPLOYER"

      const created = await ctx.db.apiKey.create({
        data: {
          label: input.label,
          keyHash,
          keyPrefix: prefix,
          ownerId: ctx.userId,
          ownerType,
        },
      })

      return {
        id: created.id,
        raw,
        label: created.label,
        prefix: created.keyPrefix,
        createdAt: created.createdAt,
      }
    }),

  list: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/keys",
        summary: "List API keys",
        tags: ["keys"],
      },
    })
    .input(z.void())
    .output(
      z.array(
        z.object({
          id: z.string(),
          label: z.string(),
          prefix: z.string(),
          createdAt: z.date(),
          lastUsedAt: z.date().nullable(),
        }),
      ),
    )
    .query(async ({ ctx }) => {
      const keys = await ctx.db.apiKey.findMany({
        where: { ownerId: ctx.userId, revokedAt: null },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          label: true,
          keyPrefix: true,
          createdAt: true,
          lastUsedAt: true,
        },
      })

      return keys.map((k) => ({
        id: k.id,
        label: k.label,
        prefix: k.keyPrefix,
        createdAt: k.createdAt,
        lastUsedAt: k.lastUsedAt,
      }))
    }),

  revoke: protectedProcedure
    .meta({
      openapi: {
        method: "DELETE",
        path: "/keys/{keyId}",
        summary: "Revoke API key",
        tags: ["keys"],
      },
    })
    .input(z.object({ keyId: z.string() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const key = await ctx.db.apiKey.findUnique({
        where: { id: input.keyId },
      })

      if (!key || key.ownerId !== ctx.userId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "API key not found" })
      }

      await ctx.db.apiKey.update({
        where: { id: input.keyId },
        data: { revokedAt: new Date() },
      })

      return { success: true }
    }),
})
