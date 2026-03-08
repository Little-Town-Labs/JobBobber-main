# Data Model: Two-Way Matching

## Schema Changes

### Modified: Match Model

New fields added to the existing `Match` model:

| Field           | Type    | Constraints      | Description                            |
| --------------- | ------- | ---------------- | -------------------------------------- |
| employerSummary | String? | Max 500          | Employer-perspective match summary     |
| seekerSummary   | String? | Max 500          | Seeker-perspective match summary       |
| evaluationData  | Json?   | Validated by Zod | Structured evaluation from both agents |

Existing `matchSummary` field retained for backwards compatibility with Feature 6 dashboard. New summaries are richer, per-perspective versions.

### New: AgentEvaluation Schema (Zod, not DB)

Stored inside `Match.evaluationData` as JSON. Not a separate DB table — this is agent output that belongs to the match.

```
AgentEvaluation {
  agentRole:        "employer_agent" | "seeker_agent"
  overallScore:     number (0-100)
  recommendation:   "MATCH" | "NO_MATCH"
  reasoning:        string (20-500 chars)
  dimensions: [
    {
      name:         string (e.g., "skills_alignment")
      score:        number (0-100)
      reasoning:    string (10-200 chars)
    }
  ]
}
```

### New: MatchEvaluationData Schema (Zod, not DB)

The shape of `Match.evaluationData`:

```
MatchEvaluationData {
  employerEvaluation:  AgentEvaluation
  seekerEvaluation:    AgentEvaluation
  confidenceInputs: {
    averageScore:      number (0-100)
    dimensionCount:    number
    weakestDimension:  string
    weakestScore:      number
  }
}
```

## Evaluation Dimensions

Standard set of dimensions both agents score:

| Dimension              | Description                                      |
| ---------------------- | ------------------------------------------------ |
| skills_alignment       | How well candidate skills match requirements     |
| experience_fit         | Experience level and relevance                   |
| compensation_alignment | Salary/comp expectations vs offering             |
| work_arrangement       | Remote/hybrid/onsite preference alignment        |
| culture_fit            | Values, work style, team dynamics alignment      |
| growth_potential       | Career growth and learning opportunity alignment |

Employer agent scores: skills_alignment, experience_fit, culture_fit, growth_potential
Seeker agent scores: compensation_alignment, work_arrangement, culture_fit, growth_potential

Both agents score all 6 dimensions, but naturally weight their own perspective.

## Confidence Derivation

```
averageScore = mean(all dimension scores from both agents)

STRONG:    averageScore >= 75
GOOD:      averageScore >= 55
POTENTIAL: averageScore >= 35
NO_MATCH:  averageScore < 35 (shouldn't happen — agents would have signaled NO_MATCH)
```

## Relationships

- Match 1:1 AgentConversation (existing, via conversationId)
- Match.evaluationData contains both AgentEvaluations as JSON
- No new DB relationships needed

## Migration

- Add `employerSummary`, `seekerSummary`, `evaluationData` as nullable columns to Match
- Existing matches retain null values for new fields
- No data backfill needed
