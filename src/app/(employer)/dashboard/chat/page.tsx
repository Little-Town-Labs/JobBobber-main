"use client"

import { trpc } from "@/lib/trpc/client"
import { ChatInterface } from "@/components/chat/chat-interface"

export default function EmployerChatPage() {
  const { data: byokStatus, isLoading } = trpc.byok.getKeyStatus.useQuery()

  if (isLoading) {
    return (
      <div className="space-y-3 p-6">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="h-96 animate-pulse rounded bg-gray-100" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-2xl font-bold">Chat with Your Agent</h1>
      <ChatInterface hasByokKey={!!byokStatus?.hasKey} />
    </div>
  )
}
