# SOC 2 Control Mapping

Maps JobBobber's compliance controls to SOC 2 Type II Trust Services Criteria.

## CC1 — Control Environment

| Control                        | Implementation                                           | Status      |
| ------------------------------ | -------------------------------------------------------- | ----------- |
| CC1.1 Commitment to integrity  | Constitution defines governance principles               | Implemented |
| CC1.2 Board oversight          | Feature flags gate all features; admin-only audit access | Implemented |
| CC1.3 Organizational structure | Role-based access: seeker, employer, admin, job_poster   | Implemented |
| CC1.4 Competence commitment    | Specification-driven development with quality gates      | Implemented |
| CC1.5 Accountability           | Audit logging tracks all compliance-sensitive operations | Implemented |

## CC2 — Communication & Information

| Control                      | Implementation                                           | Status      |
| ---------------------------- | -------------------------------------------------------- | ----------- |
| CC2.1 Internal communication | Audit logs available to employer admins                  | Implemented |
| CC2.2 External communication | Privacy settings, data usage opt-out, GDPR export        | Implemented |
| CC2.3 Information quality    | Structured audit logs with actor, action, entity, result | Implemented |

## CC3 — Risk Assessment

| Control                   | Implementation                                          | Status      |
| ------------------------- | ------------------------------------------------------- | ----------- |
| CC3.1 Risk identification | AI bias audit checklist, security reviews per feature   | Implemented |
| CC3.2 Risk analysis       | Rate limiting categories tuned per endpoint sensitivity | Implemented |
| CC3.3 Fraud risk          | Prompt injection detection, API key validation          | Implemented |
| CC3.4 Change management   | Feature flags, specification-driven development         | Implemented |

## CC5 — Control Activities

| Control                   | Implementation                                             | Status      |
| ------------------------- | ---------------------------------------------------------- | ----------- |
| CC5.1 Risk mitigation     | Rate limiting (auth: 20/min, write: 30/min, agent: 10/min) | Implemented |
| CC5.2 Technology controls | Encryption at rest (AES-256-GCM), HMAC IP hashing          | Implemented |
| CC5.3 Policy deployment   | Feature flags default OFF, require explicit enablement     | Implemented |

## CC6 — Logical & Physical Access

| Control                              | Implementation                                                 | Status      |
| ------------------------------------ | -------------------------------------------------------------- | ----------- |
| CC6.1 Access controls                | Clerk authentication, tRPC middleware role enforcement         | Implemented |
| CC6.2 Authentication                 | Clerk SSO, MFA encouragement banner, BYOK key validation       | Implemented |
| CC6.3 Authorization                  | Role-based procedures: seeker, employer, admin, job_poster     | Implemented |
| CC6.6 Access removal                 | GDPR deletion with 72-hour grace period, Clerk account removal | Implemented |
| CC6.7 Access restrictions            | Admin-only audit log access, ownership checks on all resources | Implemented |
| CC6.8 Unauthorized access prevention | Rate limiting, prompt injection detection, input validation    | Implemented |

## CC7 — System Operations

| Control                         | Implementation                                               | Status      |
| ------------------------------- | ------------------------------------------------------------ | ----------- |
| CC7.1 Infrastructure monitoring | Inngest function monitoring, Vercel deployment logs          | Partial     |
| CC7.2 Anomaly detection         | Rate limit breach detection via Upstash Redis                | Implemented |
| CC7.3 Change management         | Git-based workflow, PR reviews, feature flags                | Implemented |
| CC7.4 System recovery           | Inngest retry policies (3 attempts), fail-open rate limiting | Implemented |

## CC8 — Change Management

| Control                    | Implementation                            | Status      |
| -------------------------- | ----------------------------------------- | ----------- |
| CC8.1 Change authorization | Feature flags require explicit enablement | Implemented |

## CC9 — Risk Mitigation (Vendors)

| Control                 | Implementation                                                                     | Status      |
| ----------------------- | ---------------------------------------------------------------------------------- | ----------- |
| CC9.1 Vendor risk       | BYOK model: users supply own API keys, platform doesn't store provider credentials | Implemented |
| CC9.2 Vendor monitoring | API key validation against provider endpoints                                      | Implemented |

## A1 — Availability

| Control                  | Implementation                                           | Status      |
| ------------------------ | -------------------------------------------------------- | ----------- |
| A1.1 Capacity management | Vercel serverless auto-scaling, Upstash serverless Redis | Implemented |
| A1.2 Recovery objectives | Inngest retry policies, graceful degradation (fail-open) | Implemented |

## C1 — Confidentiality

| Control                  | Implementation                                          | Status      |
| ------------------------ | ------------------------------------------------------- | ----------- |
| C1.1 Data classification | Private params encrypted, salary/deal-breakers filtered | Implemented |
| C1.2 Data disposal       | GDPR deletion cascades through all related records      | Implemented |

## P1-P8 — Privacy

| Control                       | Implementation                                        | Status      |
| ----------------------------- | ----------------------------------------------------- | ----------- |
| P1.1 Privacy notice           | Data usage opt-out available to seekers and employers | Implemented |
| P3.1 Personal data collection | Minimal data collection, purpose-bound                | Implemented |
| P4.1 Data use                 | Privacy filter prevents cross-party data leakage      | Implemented |
| P5.1 Data retention           | Deletion requests processed within 72 hours           | Implemented |
| P6.1 Data access              | GDPR export provides complete user data in JSON       | Implemented |
| P6.5 Data portability         | exportMyData procedure returns all user data          | Implemented |
| P8.1 Data quality             | Input validation via Zod schemas on all endpoints     | Implemented |

## Key Files

| File                                                       | Purpose                                   |
| ---------------------------------------------------------- | ----------------------------------------- |
| `src/lib/audit.ts`                                         | Platform-wide audit logging               |
| `src/lib/rate-limit.ts`                                    | Upstash-based rate limiting               |
| `src/lib/encryption.ts`                                    | AES-256-GCM encryption for sensitive data |
| `src/server/api/routers/compliance.ts`                     | GDPR export/deletion procedures           |
| `src/server/inngest/functions/execute-account-deletion.ts` | Scheduled account deletion                |
| `src/server/agents/privacy-filter.ts`                      | Cross-party data leakage prevention       |
| `src/server/agents/prompt-guard.ts`                        | Prompt injection detection                |
| `src/server/api/middleware/rate-limit.ts`                  | Per-procedure rate limit enforcement      |
| `docs/bias-audit-checklist.md`                             | AI fairness audit checklist               |

## Gaps & Roadmap

| Gap                                 | Priority | Notes                                             |
| ----------------------------------- | -------- | ------------------------------------------------- |
| Infrastructure monitoring dashboard | Medium   | Currently relies on Vercel/Inngest dashboards     |
| Automated anomaly alerting          | Medium   | Rate limit breaches logged but not alerted        |
| Penetration testing                 | High     | Schedule before production launch                 |
| Third-party bias audit              | Medium   | Required annually if subject to NYC LL144         |
| Data retention policy automation    | Low      | Manual deletion requests; automated retention TBD |
