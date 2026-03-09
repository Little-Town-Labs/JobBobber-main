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
import { runAgentConversation } from "./run-agent-conversation"
import { generateProfileEmbedding } from "./generate-profile-embedding"
import { generatePostingEmbedding } from "./generate-posting-embedding"
import { generateFeedbackInsightsFunction } from "./generate-feedback-insights"
import { checkInsightThreshold } from "./check-insight-threshold"
import { processStripeEvent } from "./process-stripe-event"

export const functions = [
  evaluateCandidates,
  sendMatchCreatedNotification,
  sendMutualAcceptNotification,
  runAgentConversation,
  generateProfileEmbedding,
  generatePostingEmbedding,
  generateFeedbackInsightsFunction,
  checkInsightThreshold,
  processStripeEvent,
]
