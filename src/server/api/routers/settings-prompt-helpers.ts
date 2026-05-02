/**
 * Helper functions for custom prompt encryption/decryption in settings router.
 *
 * Extracted to keep the settings router focused and to enable
 * independent testing of the encryption + validation flow.
 *
 * Not part of the public REST API — internal helper module, not a standalone router.
 */
import { TRPCError } from "@trpc/server"
import { encrypt, decrypt } from "@/lib/encryption"
import { validateCustomPrompt } from "@/server/agents/prompt-guard"

/**
 * Validate and encrypt a custom prompt before storage.
 *
 * @param prompt - Plaintext prompt from user input (null to clear)
 * @param encryptionScopeId - userId (seeker) or jobPostingId (employer)
 * @returns Encrypted prompt string, or null if prompt is null/empty
 * @throws TRPCError BAD_REQUEST if injection detected
 */
export async function encryptAndValidatePrompt(
  prompt: string | null | undefined,
  encryptionScopeId: string,
): Promise<string | null> {
  if (!prompt || prompt.trim().length === 0) {
    return null
  }

  const validation = validateCustomPrompt(prompt)
  if (!validation.valid) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: validation.reason ?? "Invalid custom prompt.",
    })
  }

  return encrypt(prompt, encryptionScopeId, "customPrompt")
}

/**
 * Decrypt a stored custom prompt for display.
 *
 * @param encryptedPrompt - Encrypted prompt from database (null if not set)
 * @param encryptionScopeId - userId (seeker) or jobPostingId (employer)
 * @returns Decrypted plaintext prompt, or null if not set
 */
export async function decryptPrompt(
  encryptedPrompt: string | null | undefined,
  encryptionScopeId: string,
): Promise<string | null> {
  if (!encryptedPrompt) {
    return null
  }

  return decrypt(encryptedPrompt, encryptionScopeId, "customPrompt")
}
