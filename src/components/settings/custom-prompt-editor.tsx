"use client"

import { useState } from "react"
import { trpc } from "@/lib/trpc/client"

const MAX_PROMPT_LENGTH = 2000

interface CustomPromptEditorProps {
  userType: "seeker" | "employer"
  initialValue?: string | null
  onPromptChange?: (prompt: string) => void
}

export function CustomPromptEditor({
  userType,
  initialValue,
  onPromptChange,
}: CustomPromptEditorProps) {
  const [prompt, setPrompt] = useState(initialValue ?? "")
  const [validationError, setValidationError] = useState<string | null>(null)

  const { data: examples } = trpc.customPrompts.getExamples.useQuery({ userType })

  const remaining = MAX_PROMPT_LENGTH - prompt.length

  function handleChange(value: string) {
    if (value.length <= MAX_PROMPT_LENGTH) {
      setPrompt(value)
      setValidationError(null)
      onPromptChange?.(value)
    }
  }

  function handleExampleClick(examplePrompt: string) {
    setPrompt(examplePrompt)
    setValidationError(null)
    onPromptChange?.(examplePrompt)
  }

  return (
    <div className="space-y-4">
      <div data-testid="prompt-guidance" className="text-sm text-muted-foreground">
        <p className="font-medium">Custom Agent Prompt</p>
        <p>
          Write instructions that influence how your agent behaves during conversations. Your prompt
          can express preferences and priorities, but cannot override the agent&apos;s core
          evaluation rules or ethical guidelines.
        </p>
      </div>

      <textarea
        data-testid="custom-prompt-textarea"
        value={prompt}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={
          userType === "seeker"
            ? "E.g., Be assertive on salary but flexible on start date..."
            : "E.g., Prioritize culture fit over years of experience..."
        }
        className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        maxLength={MAX_PROMPT_LENGTH}
      />

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span data-testid="char-counter">
          {remaining.toLocaleString()} / {MAX_PROMPT_LENGTH.toLocaleString()} characters remaining
        </span>
        {validationError && (
          <span data-testid="validation-error" className="text-destructive">
            {validationError}
          </span>
        )}
      </div>

      {examples && examples.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Example Prompts</p>
          <div className="flex flex-wrap gap-2">
            {examples.map((example) => (
              <button
                key={example.id}
                data-testid={`example-${example.id}`}
                type="button"
                onClick={() => handleExampleClick(example.prompt)}
                className="inline-flex items-center rounded-full border px-3 py-1 text-xs hover:bg-accent hover:text-accent-foreground transition-colors"
                title={example.description}
              >
                {example.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
