/**
 * Privacy filter — strips exact private parameter values from agent output.
 *
 * Applied to every agent message before storage to prevent accidental
 * disclosure of salary figures, deal-breakers, and other private params.
 *
 * Strategy: exact value matching with common formatting variants.
 * Only redacts values that exactly match known private params — does not
 * remove all numbers (that would break legitimate content).
 */

export interface PrivateValues {
  seekerMinSalary: number | null
  seekerDealBreakers: string[]
  employerTrueMaxSalary: number | null
}

/**
 * Formats a number into variants that might appear in agent output.
 * e.g., 85000 → ["85000", "85,000", "$85,000", "$85000"]
 */
/**
 * Deterministic comma formatter — does not depend on ICU/locale config.
 */
function formatWithCommas(value: number): string {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}

function salaryVariants(value: number): string[] {
  const plain = String(value)
  const formatted = formatWithCommas(value)
  const variants = [plain]
  if (formatted !== plain) variants.push(formatted)
  variants.push(`$${plain}`)
  if (formatted !== plain) variants.push(`$${formatted}`)
  // Shorthand variants (e.g., 85000 → "85k", "$85K")
  if (value >= 1000 && value % 1000 === 0) {
    const k = String(value / 1000)
    variants.push(`${k}k`, `${k}K`, `$${k}k`, `$${k}K`)
  }
  return variants
}

/**
 * Filter private parameter values from text.
 * Returns the text with all matching private values replaced by [REDACTED].
 */
export function filterPrivateValues(text: string, privateValues: PrivateValues): string {
  let result = text

  // Redact salary values (exact match with formatting variants)
  const salaries = [privateValues.seekerMinSalary, privateValues.employerTrueMaxSalary].filter(
    (v): v is number => v !== null,
  )

  for (const salary of salaries) {
    const variants = salaryVariants(salary)
    // Sort by length descending so "$85,000" is matched before "85,000"
    variants.sort((a, b) => b.length - a.length)
    for (const variant of variants) {
      result = result.split(variant).join("[REDACTED]")
    }
  }

  // Redact deal-breaker strings (case-insensitive)
  for (const dealBreaker of privateValues.seekerDealBreakers) {
    if (!dealBreaker) continue
    const regex = new RegExp(dealBreaker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")
    result = result.replace(regex, "[REDACTED]")
  }

  return result
}
