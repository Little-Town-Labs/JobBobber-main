export interface StreamingField {
  name: string
  content: string
  state: "pending" | "streaming" | "complete"
}

/**
 * Parses streaming LLM text into typed fields based on section boundaries.
 *
 * Detects markdown headers (## / ###) and bold labels (**Label:**) as
 * field boundaries. Previous fields are marked complete; the last field
 * is always streaming.
 */
export function parseStreamingFields(text: string): StreamingField[] {
  if (!text) return []

  // Match markdown headers or bold labels at the start of a line
  const boundaryPattern = /^(?:#{2,3}\s+(.+)|^\*\*(.+?):\*\*)/gm

  const boundaries: Array<{ name: string; index: number; matchLength: number }> = []
  let match: RegExpExecArray | null

  while ((match = boundaryPattern.exec(text)) !== null) {
    const name = (match[1] ?? match[2] ?? "").trim()
    boundaries.push({ name, index: match.index, matchLength: match[0].length })
  }

  // No structure detected — return single plain text field
  if (boundaries.length === 0) {
    return [{ name: "response", content: text, state: "streaming" }]
  }

  const fields: StreamingField[] = boundaries.map((boundary, i) => {
    const contentStart = boundary.index + boundary.matchLength
    const contentEnd = i < boundaries.length - 1 ? boundaries[i + 1]!.index : text.length
    const content = text.slice(contentStart, contentEnd).trim()
    const isLast = i === boundaries.length - 1

    return {
      name: boundary.name,
      content,
      state: isLast ? "streaming" : "complete",
    }
  })

  return fields
}
