# AI Bias Audit Checklist

This checklist supports compliance with NYC Local Law 144 (AEDT) and emerging AI fairness regulations. Review quarterly or before major prompt/model changes.

## 1. Prompt Review

- [ ] Agent system prompts do not reference protected characteristics (race, gender, age, religion, disability, national origin, sexual orientation)
- [ ] No proxy variables that correlate with protected classes (e.g., "cultural fit", zip code as proxy for race)
- [ ] Evaluation criteria are job-relevant and objectively measurable
- [ ] Prompts instruct the AI to evaluate based on skills, experience, and qualifications only
- [ ] Custom employer prompts pass injection detection (`prompt-guard.ts`)
- [ ] Custom prompts are sandboxed to prevent override of fairness instructions (`prompt-sandbox.ts`)

## 2. Scoring & Matching Review

- [ ] Confidence scores (STRONG/GOOD/POTENTIAL) are based on documented, job-relevant criteria
- [ ] Match summaries do not reference protected characteristics
- [ ] Evaluation dimensions (technical fit, experience alignment, etc.) are clearly defined
- [ ] No implicit weighting that disadvantages protected groups (e.g., penalizing employment gaps)

## 3. Data Pipeline Review

- [ ] Training/context data does not encode historical hiring biases
- [ ] Seeker profiles are evaluated on stated qualifications, not inferred demographics
- [ ] Privacy filter (`privacy-filter.ts`) prevents salary and deal-breaker leakage between parties
- [ ] Redaction layer (`redaction.ts`) removes PII before embedding generation

## 4. Outcome Monitoring

- [ ] Track match acceptance rates by available demographic segments (if voluntarily disclosed)
- [ ] Monitor for statistically significant disparities in confidence score distribution
- [ ] Review declined-match patterns for potential adverse impact
- [ ] Document any disparities found and corrective actions taken

## 5. Documentation Requirements

- [ ] Bias audit results documented with date and reviewer
- [ ] Corrective actions tracked to completion
- [ ] Audit results available to candidates upon request (NYC LL144 requirement)
- [ ] Annual summary published (if subject to NYC LL144)

## 6. Technical Controls

- [ ] `bias-audit.test.ts` validates prompt-level bias detection
- [ ] Agent prompts tested for discriminatory language patterns
- [ ] Proxy variable detection covers common indirect discrimination vectors
- [ ] Test suite runs in CI to catch prompt regression

## Audit Schedule

| Frequency   | Action                                  |
| ----------- | --------------------------------------- |
| Per release | Run `bias-audit.test.ts` in CI          |
| Monthly     | Review new/modified agent prompts       |
| Quarterly   | Full checklist review                   |
| Annually    | Third-party audit (if subject to LL144) |

## References

- NYC Local Law 144 (Automated Employment Decision Tools)
- EEOC Guidance on AI in Employment
- NIST AI Risk Management Framework (AI RMF)
