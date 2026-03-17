"use client"

interface Suggestion {
  label: string
  message: string
}

export interface SuggestionButtonsProps {
  suggestions: Suggestion[]
  onSend: (message: string) => void
}

export function SuggestionButtons({ suggestions, onSend }: SuggestionButtonsProps) {
  if (suggestions.length === 0) return null

  return (
    <div data-testid="suggestion-buttons" className="flex flex-wrap gap-2 pt-2">
      {suggestions.map((suggestion) => (
        <button
          key={suggestion.label}
          type="button"
          onClick={() => onSend(suggestion.message)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors"
        >
          {suggestion.label}
        </button>
      ))}
    </div>
  )
}
