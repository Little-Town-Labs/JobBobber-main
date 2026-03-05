"use client"

import { JobPostingForm } from "@/components/employer/job-posting-form"

export default function NewPostingPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">New Job Posting</h1>
      <JobPostingForm posting={null} />
    </div>
  )
}
