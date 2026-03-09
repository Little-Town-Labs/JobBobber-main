import "server-only"
import { createHmac } from "crypto"
import { db } from "@/lib/db"
import type { AuditActorType, AuditResult } from "@prisma/client"

interface LogAuditParams {
  actorId: string
  actorType: AuditActorType
  action: string
  entityType?: string
  entityId?: string
  metadata?: Record<string, unknown>
  ipHash?: string | null
  result: AuditResult
}

/**
 * Fire-and-forget audit logger for compliance-sensitive operations.
 * Swallows errors — audit logs are informational, never block user requests.
 */
export async function logAudit(params: LogAuditParams): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorId: params.actorId,
        actorType: params.actorType,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        metadata: params.metadata ?? {},
        ipHash: params.ipHash ?? null,
        result: params.result,
      },
    })
  } catch {
    // Fire-and-forget: audit logs are non-critical
  }
}

/**
 * Hash an IP address using SHA-256 with application salt.
 * Returns null if no IP provided.
 */
export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null
  const salt = process.env["AUDIT_IP_SALT"]
  if (!salt) return null
  return createHmac("sha256", salt).update(ip).digest("hex")
}
