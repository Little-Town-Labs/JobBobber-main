"use client"

import type { StreamingField } from "./streaming-parser"

interface ProgressiveFieldsProps {
  fields: StreamingField[]
}

export function ProgressiveFields({ fields }: ProgressiveFieldsProps) {
  if (fields.length === 0) return null

  // Single plain-text field — render without section header for backward compatibility
  const isSinglePlainText = fields.length === 1 && fields[0]!.name === "response"

  if (isSinglePlainText) {
    const field = fields[0]!
    return (
      <div className="whitespace-pre-wrap">
        <span>{field.content}</span>
        {field.state === "streaming" && (
          <span
            data-testid="streaming-cursor"
            className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-gray-500"
            aria-hidden="true"
          />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {fields.map((field) => {
        if (field.state === "pending") {
          return (
            <div
              key={field.name}
              data-testid={`pending-field-${field.name}`}
              className="space-y-1 animate-pulse"
            >
              <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
              <div className="h-3 w-full animate-pulse rounded bg-gray-100" />
            </div>
          )
        }

        return (
          <div key={field.name} className="space-y-1">
            <h4 className="text-sm font-semibold text-gray-700">{field.name}</h4>
            <div className="whitespace-pre-wrap text-sm text-gray-800">
              <span>{field.content}</span>
              {field.state === "streaming" && (
                <span
                  data-testid="streaming-cursor"
                  className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-gray-500"
                  aria-hidden="true"
                />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
