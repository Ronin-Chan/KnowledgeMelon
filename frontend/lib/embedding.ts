type EmbeddingProvider = "openai" | "alibaba" | "zhipu" | "moonshot";

const EMBEDDING_PROVIDERS: EmbeddingProvider[] = [
  "openai",
  "alibaba",
  "zhipu",
  "moonshot",
];

interface ResolveEmbeddingConfigArgs {
  apiKeys: Record<string, string>;
  openaiApiKey: string;
  baseUrls: Record<string, string>;
  currentProvider?: string;
  useLocalEmbedding: boolean;
}

export function resolveEmbeddingConfig({
  apiKeys,
  openaiApiKey,
  baseUrls,
  currentProvider,
  useLocalEmbedding,
}: ResolveEmbeddingConfigArgs) {
  if (useLocalEmbedding) {
    return {
      provider: currentProvider || "openai",
      apiKey: "",
      baseUrl: "",
      useLocalEmbedding: true,
    };
  }

  const providersToTry: EmbeddingProvider[] = [];
  if (
    currentProvider &&
    EMBEDDING_PROVIDERS.includes(currentProvider as EmbeddingProvider)
  ) {
    providersToTry.push(currentProvider as EmbeddingProvider);
  }

  for (const provider of EMBEDDING_PROVIDERS) {
    if (!providersToTry.includes(provider)) {
      providersToTry.push(provider);
    }
  }

  for (const provider of providersToTry) {
    const apiKey =
      apiKeys[provider] || (provider === "openai" ? openaiApiKey : "") || "";
    if (apiKey) {
      return {
        provider,
        apiKey,
        baseUrl: baseUrls[provider] || "",
        useLocalEmbedding: false,
      };
    }
  }

  return null;
}
