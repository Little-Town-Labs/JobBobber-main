"use client"

import Link from "next/link"

interface JobPostingListProps {
  postings: {
    id: string
    title: string
    status: string
    updatedAt: string
  }[]
}

export function JobPostingList({ postings }: JobPostingListProps) {
  if (postings.length === 0) {
    return (
      <div className="rounded-lg border p-6 text-center">
        <p className="text-gray-500">No job postings yet.</p>
        <Link href="/postings/new" className="mt-2 inline-block text-blue-600 hover:underline">
          Create your first posting
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {postings.map((posting) => (
        <Link
          key={posting.id}
          href={`/postings/${posting.id}`}
          className="block rounded-lg border p-4 hover:bg-gray-50"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-medium">{posting.title}</h3>
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs">{posting.status}</span>
          </div>
          <p className="text-xs text-gray-500">Updated {posting.updatedAt}</p>
        </Link>
      ))}
    </div>
  )
}
