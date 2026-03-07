"use client"

import { useRef, useState } from "react"
import { trpc } from "@/lib/trpc/client"
import { ResumeExtractionReview } from "./resume-extraction-review"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MiB
const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]

interface ExtractionResult {
  extractionId: string
  proposed: Record<string, unknown>
  success: boolean
  errorReason?: string
}

interface ResumeUploadCardProps {
  resumeUrl: string | null
  hasApiKey: boolean
  seekerId: string
  onResumeUpdated?: (newUrl: string) => void
}

function getFilenameFromUrl(url: string): string {
  const parts = url.split("/")
  return parts[parts.length - 1] ?? url
}

export function ResumeUploadCard({
  resumeUrl: initialResumeUrl,
  hasApiKey,
  seekerId,
  onResumeUpdated,
}: ResumeUploadCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [resumeUrl, setResumeUrl] = useState(initialResumeUrl)
  const [error, setError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null)
  const [showReview, setShowReview] = useState(false)

  const getUploadUrl = trpc.resume.getUploadUrl.useMutation()
  const confirmUpload = trpc.resume.confirmUpload.useMutation()
  const triggerExtraction = trpc.resume.triggerExtraction.useMutation()

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)

    // Validate type
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Only PDF and DOCX files are accepted.")
      return
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      setError("File too large. Maximum size is 10 MiB.")
      return
    }

    setIsUploading(true)
    try {
      // Get signed upload URL
      const { blobPath } = await getUploadUrl.mutateAsync({
        filename: file.name,
        mimeType: file.type as
          | "application/pdf"
          | "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        sizeBytes: file.size,
      })

      // PUT directly to Vercel Blob
      const uploadResponse = await fetch(blobPath, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      })
      if (!uploadResponse.ok) {
        throw new Error("Upload failed.")
      }

      // Confirm upload (persist URL)
      const blobUrl = blobPath.split("?")[0] ?? blobPath
      const updatedProfile = await confirmUpload.mutateAsync({ blobUrl })
      const confirmedUrl = (updatedProfile as { resumeUrl?: string }).resumeUrl ?? blobUrl
      setResumeUrl(confirmedUrl)
      onResumeUpdated?.(confirmedUrl)
    } catch {
      setError("Upload failed. Please try again.")
    } finally {
      setIsUploading(false)
      // Reset input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  async function handleExtract() {
    if (!resumeUrl) return
    setError(null)
    try {
      const result = await triggerExtraction.mutateAsync({ blobUrl: resumeUrl })
      if (!result.success) {
        setError(result.errorReason ?? "Extraction failed. Please try again.")
        return
      }
      setExtraction(result)
      setShowReview(true)
    } catch {
      setError("Extraction failed. Please try again.")
    }
  }

  function handleExtractionApplied(updatedProfile: unknown) {
    setShowReview(false)
    setExtraction(null)
    void updatedProfile
  }

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx"
        style={{ display: "none" }}
        onChange={handleFileChange}
        aria-label="Resume file input"
        data-testid="file-input"
      />

      {resumeUrl ? (
        <div>
          <p>Current resume: {getFilenameFromUrl(resumeUrl)}</p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? "Uploading…" : "Replace Resume"}
          </button>

          {hasApiKey ? (
            <button type="button" onClick={handleExtract} disabled={triggerExtraction.isPending}>
              {triggerExtraction.isPending ? "Extracting…" : "Extract with AI"}
            </button>
          ) : (
            <p>
              No API key — <a href="/account/api-key">Configure</a> to enable AI extraction.
            </p>
          )}
        </div>
      ) : (
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
          {isUploading ? "Uploading…" : "Upload Resume"}
        </button>
      )}

      {error && <p role="alert">{error}</p>}

      {showReview && extraction?.success && (
        <ResumeExtractionReview
          extractionId={extraction.extractionId}
          proposed={extraction.proposed}
          onApplied={handleExtractionApplied}
          onClose={() => setShowReview(false)}
        />
      )}

      <span data-seeker-id={seekerId} style={{ display: "none" }} />
    </div>
  )
}
