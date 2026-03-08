/**
 * Shared logic for embedding generation Inngest functions.
 *
 * Eliminates duplication between generate-profile-embedding and
 * generate-posting-embedding by parameterizing the three varying parts:
 * context fetch, decrypt+embed, and store.
 */

type FetchResult = { error: string } | { skip: true } | { text: string; error: null; skip: false }

interface EmbeddingStepConfig {
  step: {
    run: <T>(name: string, fn: () => Promise<T>) => Promise<T>
  }
  fetchStepName: string
  fetchContext: () => Promise<FetchResult>
  decryptAndEmbed: (text: string) => Promise<number[] | null>
  storeEmbedding: (vectorStr: string) => Promise<void>
}

export async function generateAndStoreEmbedding(
  config: EmbeddingStepConfig,
): Promise<{ status: string; error?: string }> {
  const context = await config.step.run(config.fetchStepName, config.fetchContext)

  if ("error" in context && context.error) {
    return { status: "FAILED", error: context.error }
  }

  if ("skip" in context && context.skip) {
    return { status: "SKIPPED" }
  }

  const { text } = context as { text: string }

  const embedding = await config.step.run("generate-embedding", () => config.decryptAndEmbed(text))

  if (!embedding) {
    return { status: "FAILED", error: "embedding generation failed" }
  }

  await config.step.run("update-embedding", () => {
    const vectorStr = `[${embedding.join(",")}]`
    return config.storeEmbedding(vectorStr)
  })

  return { status: "SUCCESS" }
}
