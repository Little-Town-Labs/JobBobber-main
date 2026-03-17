// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import React from "react"

const { mockUseChat, mockGetHistory } = vi.hoisted(() => ({
  mockUseChat: vi.fn(),
  mockGetHistory: vi.fn(),
}))

vi.mock("@ai-sdk/react", () => ({
  useChat: mockUseChat,
}))

vi.mock("@/lib/trpc/hooks", () => ({
  useChatGetHistory: mockGetHistory,
}))

vi.mock("@/lib/trpc/client", () => ({
  trpc: {
    useUtils: () => ({}),
  },
}))

import { ChatInterface } from "@/components/chat/chat-interface"

function makeUIMessage(id: string, role: "user" | "assistant", text: string) {
  return { id, role, parts: [{ type: "text", text }] }
}

beforeEach(() => {
  vi.clearAllMocks()

  mockGetHistory.mockReturnValue({
    data: undefined,
    isLoading: false,
  })

  mockUseChat.mockReturnValue({
    messages: [],
    sendMessage: vi.fn(),
    status: "ready",
    error: null,
  })
})

describe("ChatInterface", () => {
  it("renders loading skeleton while history loads", () => {
    mockGetHistory.mockReturnValue({ data: undefined, isLoading: true })

    render(<ChatInterface hasByokKey={true} />)

    expect(screen.getByTestId("chat-loading")).toBeInTheDocument()
  })

  it("displays BYOK setup prompt when hasByokKey is false", () => {
    render(<ChatInterface hasByokKey={false} />)

    expect(screen.getByTestId("chat-byok-prompt")).toBeInTheDocument()
    expect(screen.getByText("API Key Required")).toBeInTheDocument()
  })

  it("renders message input when ready", () => {
    render(<ChatInterface hasByokKey={true} />)

    expect(screen.getByTestId("chat-input")).toBeInTheDocument()
    expect(screen.getByTestId("chat-send-button")).toBeInTheDocument()
  })

  it("renders user and assistant messages", () => {
    mockUseChat.mockReturnValue({
      messages: [
        makeUIMessage("1", "user", "Hello agent"),
        makeUIMessage("2", "assistant", "Hi! I'm your JobBobber agent."),
      ],
      sendMessage: vi.fn(),
      status: "ready",
      error: null,
    })

    render(<ChatInterface hasByokKey={true} />)

    expect(screen.getByText("Hello agent")).toBeInTheDocument()
    expect(screen.getByText("Hi! I'm your JobBobber agent.")).toBeInTheDocument()
  })

  it("disables send button while loading", () => {
    mockUseChat.mockReturnValue({
      messages: [],
      sendMessage: vi.fn(),
      status: "streaming",
      error: null,
    })

    render(<ChatInterface hasByokKey={true} />)

    const button = screen.getByTestId("chat-send-button")
    expect(button).toBeDisabled()
  })

  it("displays error message on provider failure", () => {
    mockUseChat.mockReturnValue({
      messages: [],
      sendMessage: vi.fn(),
      status: "error",
      error: new Error("API key expired"),
    })

    render(<ChatInterface hasByokKey={true} />)

    expect(screen.getByTestId("chat-error")).toBeInTheDocument()
  })

  it("enforces character limit on input", () => {
    render(<ChatInterface hasByokKey={true} />)

    const input = screen.getByTestId("chat-input")
    expect(input).toHaveAttribute("maxLength", "5000")
  })

  it("displays previous messages from history on mount", () => {
    mockGetHistory.mockReturnValue({
      data: {
        items: [
          { id: "h1", role: "USER", content: "Past question", createdAt: "2026-03-15T10:00:00Z" },
          {
            id: "h2",
            role: "ASSISTANT",
            content: "Past answer",
            createdAt: "2026-03-15T10:00:01Z",
          },
        ],
        hasMore: false,
        nextCursor: null,
      },
      isLoading: false,
    })

    mockUseChat.mockReturnValue({
      messages: [],
      sendMessage: vi.fn(),
      status: "ready",
      error: null,
    })

    render(<ChatInterface hasByokKey={true} />)

    expect(screen.getByText("Past question")).toBeInTheDocument()
    expect(screen.getByText("Past answer")).toBeInTheDocument()
  })
})
