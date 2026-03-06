/**
 * Inngest function registry.
 *
 * Export all functions from this file. They are registered with the Inngest
 * serve handler in src/app/api/inngest/route.ts.
 */
import { evaluateCandidates } from "./evaluate-candidates"
import {
  sendMatchCreatedNotification,
  sendMutualAcceptNotification,
} from "./send-match-notification"

export const functions = [
  evaluateCandidates,
  sendMatchCreatedNotification,
  sendMutualAcceptNotification,
]
