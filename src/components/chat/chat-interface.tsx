"use client"

import { useRef, useEffect, useMemo, useState } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { useChatGetHistory } from "@/lib/trpc/hooks"

const MAX_INPUT_LENGTH = 5000

interface ChatInterfaceProps {
  hasByokKey: boolean
}

interface HistoryMessage {
  id: string
  role: "USER" | "ASSISTANT"
  content: string
  createdAt: string
}

/** Extract text content from a UIMessage's parts array */
function getMessageText(message: { parts?: Array<{ type: string; text?: string }> }): string {
  if (!message.parts) return ""
  return message.parts
    .filter((p) => p.type === "text" && p.text)
    .map((p) => p.text)
    .join("")
}

export function ChatInterface({ hasByokKey }: ChatInterfaceProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [inputValue, setInputValue] = useState("")
  const historyQuery = useChatGetHistory()
  const historyData = historyQuery.data as
    | { items: HistoryMessage[]; hasMore: boolean; nextCursor: string | null }
    | undefined

  const {
    messages: chatMessages,
    sendMessage,
    status,
    error,
  } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  })

  const isLoading = status === "streaming" || status === "submitted"

  // Merge persisted history with live chat messages
  const allMessages = useMemo(() => {
    const historyItems = historyData?.items ?? []
    const chronological = [...historyItems].reverse()
    const fromHistory = chronological.map((m) => ({
      id: m.id,
      role: m.role === "USER" ? ("user" as const) : ("assistant" as const),
      content: m.content,
    }))
    const historyContents = new Set(fromHistory.map((m) => m.content))
    const newChatMessages = chatMessages
      .map((m) => ({ id: m.id, role: m.role as "user" | "assistant", content: getMessageText(m) }))
      .filter((m) => !historyContents.has(m.content))
    return [...fromHistory, ...newChatMessages]
  }, [historyData, chatMessages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [allMessages.length])

  if (!hasByokKey) {
    return (
      <div
        data-testid="chat-byok-prompt"
        className="rounded-lg border border-dashed p-8 text-center"
      >
        <h2 className="text-lg font-semibold text-gray-800">API Key Required</h2>
        <p className="mt-2 text-sm text-gray-600">
          To chat with your agent, please configure your API key first.
        </p>
        <a
          href="/account/api-key"
          className="mt-4 inline-block rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Set Up API Key
        </a>
      </div>
    )
  }

  if (historyQuery.isLoading) {
    return (
      <div data-testid="chat-loading" className="space-y-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className={`h-12 animate-pulse rounded-lg bg-gray-100 ${i % 2 === 0 ? "ml-auto w-2/3" : "w-3/4"}`}
          />
        ))}
      </div>
    )
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() || isLoading) return
    sendMessage({ text: inputValue })
    setInputValue("")
  }

  return (
    <div className="flex h-[calc(100vh-12rem)] flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 p-4">
        {allMessages.length === 0 && (
          <div className="text-center text-sm text-gray-400 pt-8">
            Ask your agent about your matches, profile, or job search strategy.
          </div>
        )}
        {allMessages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 text-sm whitespace-pre-wrap ${
                message.role === "user" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-800"
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-400">
              Thinking...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div
          data-testid="chat-error"
          className="mx-4 mb-2 rounded bg-red-50 p-3 text-sm text-red-700"
        >
          Something went wrong: {error.message}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleFormSubmit} className="border-t p-4 flex gap-2">
        <input
          data-testid="chat-input"
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          maxLength={MAX_INPUT_LENGTH}
          placeholder="Ask your agent..."
          className="flex-1 rounded-lg border px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isLoading}
        />
        <button
          data-testid="chat-send-button"
          type="submit"
          disabled={isLoading || !inputValue.trim()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? "..." : "Send"}
        </button>
      </form>
    </div>
  )
}
