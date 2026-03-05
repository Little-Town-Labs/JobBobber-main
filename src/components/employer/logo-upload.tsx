"use client"

import { useState } from "react"
import { trpc } from "@/lib/trpc/client"
import { upload } from "@vercel/blob/client"

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"]
const MAX_SIZE = 2 * 1024 * 1024 // 2 MB

interface LogoUploadProps {
  currentLogoUrl: string | null
}

export function LogoUpload({ currentLogoUrl }: LogoUploadProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentLogoUrl)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const updateLogo = trpc.employers.updateLogo.useMutation()

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Only PNG, JPEG, and WebP images are allowed.")
      return
    }

    if (file.size > MAX_SIZE) {
      setError("File must be 2 MB or smaller.")
      return
    }

    // Show local preview
    const objectUrl = URL.createObjectURL(file)
    setPreviewUrl(objectUrl)

    try {
      setUploading(true)
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/employer/logo/upload",
      })
      await updateLogo.mutateAsync({ logoUrl: blob.url })
      setPreviewUrl(blob.url)
    } catch {
      setError("Failed to upload logo. Please try again.")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <label htmlFor="logo-input">Company Logo</label>

      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- preview may be a blob: URL
        <img
          src={previewUrl}
          alt="Company logo preview"
          className="mt-2 h-20 w-20 rounded object-cover"
        />
      )}

      <input
        id="logo-input"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFileChange}
        disabled={uploading || updateLogo.isPending}
        className="mt-2"
      />

      {error && <p role="alert">{error}</p>}
      {uploading && <p>Uploading...</p>}
    </div>
  )
}
