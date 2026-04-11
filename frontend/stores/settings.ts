import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  descriptionKey: string;
  contextWindow?: number;
}

export interface LocalizedModelConfig extends ModelConfig {
  description: string;
}

type Locale = "zh" | "en";
export type ResponseLength = "concise" | "balanced" | "detailed";

const MODEL_DESCRIPTIONS: Record<string, Record<Locale, string>> = {
  gpt_5_4: {
    zh: "OpenAI 最新旗舰模型，通用复杂任务首选",
    en: "OpenAI's latest flagship model, ideal for general complex tasks",
  },
  gpt_5_4_pro: {
    zh: "更高精度版本，适合高难度推理与代码任务",
    en: "Higher-precision version for demanding reasoning and coding",
  },
  gpt_5_mini: {
    zh: "高性价比默认选择，速度和质量更均衡",
    en: "A balanced default choice with strong speed-to-quality ratio",
  },
  gpt_5_nano: {
    zh: "低延迟、低成本，适合高吞吐轻量任务",
    en: "Low-latency, low-cost option for high-throughput lightweight tasks",
  },
  gpt_4_1: {
    zh: "成熟稳定的高质量非推理模型",
    en: "Mature and stable high-quality non-reasoning model",
  },
  claude_opus_4_6: {
    zh: "Anthropic 最强模型，适合复杂任务和编码",
    en: "Anthropic's strongest model for complex tasks and coding",
  },
  claude_sonnet_4_6: {
    zh: "速度和智能均衡，适合通用生产场景",
    en: "Balanced speed and intelligence for general production use",
  },
  claude_haiku_4_5: {
    zh: "低成本、快速响应，适合实时场景",
    en: "Low-cost, fast responses for real-time scenarios",
  },
  gemini_3_1_pro_preview: {
    zh: "Gemini 最新高级推理与代理编程模型",
    en: "Gemini's latest advanced reasoning and agentic coding model",
  },
  gemini_3_flash_preview: {
    zh: "Gemini 3 系列高性价比快速模型",
    en: "Fast, cost-effective model in the Gemini 3 family",
  },
  gemini_3_1_flash_lite_preview: {
    zh: "适合高并发、低成本场景的轻量模型",
    en: "Lightweight model for high-concurrency, low-cost scenarios",
  },
  deepseek_chat: {
    zh: "DeepSeek-V3.2 非思考模式",
    en: "DeepSeek-V3.2 non-thinking mode",
  },
  deepseek_reasoner: {
    zh: "DeepSeek-V3.2 思考模式",
    en: "DeepSeek-V3.2 reasoning mode",
  },
  qwen3_max: {
    zh: "阿里云最新旗舰模型",
    en: "Alibaba Cloud's latest flagship model",
  },
  qwen3_5_plus: {
    zh: "高性能通用模型，支持超长上下文",
    en: "High-performance general model with ultra-long context support",
  },
  qwen_plus_latest: {
    zh: "Qwen-Plus 最新稳定别名",
    en: "Latest stable alias of Qwen-Plus",
  },
  qwen_flash: {
    zh: "低延迟、高并发模型",
    en: "Low-latency, high-concurrency model",
  },
  qwen3_coder_plus: {
    zh: "阿里云新一代代码模型",
    en: "Alibaba Cloud's next-generation coding model",
  },
  glm_5: {
    zh: "智谱最新旗舰模型",
    en: "Zhipu's latest flagship model",
  },
  glm_4_7: {
    zh: "强化代码和 Agent 能力的生产模型",
    en: "Production model strengthened for coding and agents",
  },
  glm_4_7_flash: {
    zh: "高速低成本模型",
    en: "Fast, low-cost model",
  },
  kimi_k2_5: {
    zh: "Kimi 最新多模态旗舰模型",
    en: "Kimi's latest multimodal flagship model",
  },
  kimi_k2_turbo_preview: {
    zh: "Kimi 高速预览模型",
    en: "Kimi's high-speed preview model",
  },
  kimi_k2_thinking: {
    zh: "Kimi 深度推理模型",
    en: "Kimi's deep reasoning model",
  },
  kimi_latest: {
    zh: "Kimi 产品同款最新别名",
    en: "Latest alias matching the product version of Kimi",
  },
  moonshot_v1_128k_legacy: {
    zh: "兼容旧版接口的稳定模型",
    en: "Stable model compatible with the legacy API",
  },
  command_r: {
    zh: "长上下文",
    en: "Long context",
  },
  command_r_plus: {
    zh: "最强性能",
    en: "Strongest performance",
  },
  mistral_large_latest: {
    zh: "旗舰模型",
    en: "Flagship model",
  },
  mistral_medium: {
    zh: "平衡性能",
    en: "Balanced performance",
  },
  mistral_small: {
    zh: "快速经济",
    en: "Fast and economical",
  },
};export const SUPPORTED_MODELS: ModelConfig[] = [
  {
    id: "gpt-5.4",
    name: "GPT-5.4",
    provider: "openai",
    descriptionKey: "gpt_5_4",
    contextWindow: 1000000,
  },
  {
    id: "gpt-5.4-pro",
    name: "GPT-5.4 Pro",
    provider: "openai",
    descriptionKey: "gpt_5_4_pro",
    contextWindow: 272000,
  },
  {
    id: "gpt-5-mini",
    name: "GPT-5 Mini",
    provider: "openai",
    descriptionKey: "gpt_5_mini",
    contextWindow: 400000,
  },
  {
    id: "gpt-5-nano",
    name: "GPT-5 Nano",
    provider: "openai",
    descriptionKey: "gpt_5_nano",
    contextWindow: 400000,
  },
  {
    id: "gpt-4.1",
    name: "GPT-4.1",
    provider: "openai",
    descriptionKey: "gpt_4_1",
    contextWindow: 128000,
  },

  {
    id: "claude-opus-4-6",
    name: "Claude Opus 4.6",
    provider: "anthropic",
    descriptionKey: "claude_opus_4_6",
    contextWindow: 200000,
  },
  {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    provider: "anthropic",
    descriptionKey: "claude_sonnet_4_6",
    contextWindow: 200000,
  },
  {
    id: "claude-haiku-4-5",
    name: "Claude Haiku 4.5",
    provider: "anthropic",
    descriptionKey: "claude_haiku_4_5",
    contextWindow: 200000,
  },

  {
    id: "gemini-3.1-pro-preview",
    name: "Gemini 3.1 Pro",
    provider: "google",
    descriptionKey: "gemini_3_1_pro_preview",
    contextWindow: 1000000,
  },
  {
    id: "gemini-3-flash-preview",
    name: "Gemini 3 Flash",
    provider: "google",
    descriptionKey: "gemini_3_flash_preview",
    contextWindow: 1000000,
  },
  {
    id: "gemini-3.1-flash-lite-preview",
    name: "Gemini 3.1 Flash-Lite",
    provider: "google",
    descriptionKey: "gemini_3_1_flash_lite_preview",
    contextWindow: 1000000,
  },
  {
    id: "deepseek-chat",
    name: "DeepSeek Chat",
    provider: "deepseek",
    descriptionKey: "deepseek_chat",
    contextWindow: 128000,
  },
  {
    id: "deepseek-reasoner",
    name: "DeepSeek Reasoner",
    provider: "deepseek",
    descriptionKey: "deepseek_reasoner",
    contextWindow: 128000,
  },
  {
    id: "qwen3-max",
    name: "Qwen3-Max",
    provider: "alibaba",
    descriptionKey: "qwen3_max",
    contextWindow: 262144,
  },
  {
    id: "qwen3.5-plus",
    name: "Qwen3.5-Plus",
    provider: "alibaba",
    descriptionKey: "qwen3_5_plus",
    contextWindow: 1000000,
  },
  {
    id: "qwen-plus-latest",
    name: "Qwen-Plus-Latest",
    provider: "alibaba",
    descriptionKey: "qwen_plus_latest",
    contextWindow: 1000000,
  },
  {
    id: "qwen-flash",
    name: "Qwen-Flash",
    provider: "alibaba",
    descriptionKey: "qwen_flash",
    contextWindow: 1000000,
  },
  {
    id: "qwen3-coder-plus",
    name: "Qwen3-Coder-Plus",
    provider: "alibaba",
    descriptionKey: "qwen3_coder_plus",
    contextWindow: 1000000,
  },
  {
    id: "glm-5",
    name: "GLM-5",
    provider: "zhipu",
    descriptionKey: "glm_5",
    contextWindow: 128000,
  },
  {
    id: "glm-4.7",
    name: "GLM-4.7",
    provider: "zhipu",
    descriptionKey: "glm_4_7",
    contextWindow: 200000,
  },
  {
    id: "glm-4.7-flash",
    name: "GLM-4.7-Flash",
    provider: "zhipu",
    descriptionKey: "glm_4_7_flash",
    contextWindow: 200000,
  },
  {
    id: "kimi-k2.5",
    name: "Kimi K2.5",
    provider: "moonshot",
    descriptionKey: "kimi_k2_5",
    contextWindow: 256000,
  },
  {
    id: "kimi-k2-turbo-preview",
    name: "Kimi K2 Turbo Preview",
    provider: "moonshot",
    descriptionKey: "kimi_k2_turbo_preview",
    contextWindow: 256000,
  },
  {
    id: "kimi-k2-thinking",
    name: "Kimi K2 Thinking",
    provider: "moonshot",
    descriptionKey: "kimi_k2_thinking",
    contextWindow: 256000,
  },
  {
    id: "kimi-latest",
    name: "Kimi Latest",
    provider: "moonshot",
    descriptionKey: "kimi_latest",
    contextWindow: 128000,
  },
  {
    id: "moonshot-v1-128k",
    name: "Moonshot V1 128K (Legacy)",
    provider: "moonshot",
    descriptionKey: "moonshot_v1_128k_legacy",
    contextWindow: 128000,
  },
  {
    id: "command-r",
    name: "Command R",
    provider: "cohere",
    descriptionKey: "command_r",
    contextWindow: 128000,
  },
  {
    id: "command-r-plus",
    name: "Command R+",
    provider: "cohere",
    descriptionKey: "command_r_plus",
    contextWindow: 128000,
  },
  {
    id: "mistral-large-latest",
    name: "Mistral Large",
    provider: "mistral",
    descriptionKey: "mistral_large_latest",
    contextWindow: 32000,
  },
  {
    id: "mistral-medium",
    name: "Mistral Medium",
    provider: "mistral",
    descriptionKey: "mistral_medium",
    contextWindow: 32000,
  },
  {
    id: "mistral-small",
    name: "Mistral Small",
    provider: "mistral",
    descriptionKey: "mistral_small",
    contextWindow: 32000,
  },
];

export const getModelsByProvider = (provider: string) =>
  SUPPORTED_MODELS.filter((m) => m.provider === provider);

export const getLocalizedModels = (locale: Locale): LocalizedModelConfig[] =>
  SUPPORTED_MODELS.map((model) => ({
    ...model,
    description: MODEL_DESCRIPTIONS[model.descriptionKey]?.[locale],
  }));

export const getLocalizedModelById = (locale: Locale, modelId: string) =>
  getLocalizedModels(locale).find((model) => model.id === modelId);

export const PROVIDERS = [
  {
    id: "openai",
    name: "OpenAI",
    keyName: "OPENAI_API_KEY",
    baseUrlPlaceholder: "https://api.openai.com/v1",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    keyName: "ANTHROPIC_API_KEY",
    baseUrlPlaceholder: "https://api.anthropic.com",
  },
  {
    id: "google",
    name: "Google AI",
    keyName: "GOOGLE_API_KEY",
    baseUrlPlaceholder: "https://generativelanguage.googleapis.com",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    keyName: "DEEPSEEK_API_KEY",
    baseUrlPlaceholder: "https://api.deepseek.com/v1",
  },
  {
    id: "alibaba",
    name: "阿里云",
    keyName: "DASHSCOPE_API_KEY",
    baseUrlPlaceholder: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  },
  {
    id: "zhipu",
    name: "智谱 AI",
    keyName: "ZHIPU_API_KEY",
    baseUrlPlaceholder: "https://open.bigmodel.cn/api/paas/v4",
  },
  {
    id: "moonshot",
    name: "Moonshot",
    keyName: "MOONSHOT_API_KEY",
    baseUrlPlaceholder: "https://api.moonshot.cn/v1",
  },
  {
    id: "cohere",
    name: "Cohere",
    keyName: "COHERE_API_KEY",
    baseUrlPlaceholder: "https://api.cohere.ai",
  },
  {
    id: "mistral",
    name: "Mistral",
    keyName: "MISTRAL_API_KEY",
    baseUrlPlaceholder: "https://api.mistral.ai",
  },
];

interface ApiKeys {
  [provider: string]: string;
}

interface SettingsStore {
  openaiApiKey: string;
  model: string;
  theme: "light" | "dark";
  locale: "zh" | "en";
  responseLength: ResponseLength;
  apiKeys: ApiKeys;
  baseUrls: { [provider: string]: string };
  selectedProvider: string;
  useRAG: boolean;
  useMemory: boolean;
  useTools: boolean;
  useLocalEmbedding: boolean;
  setOpenaiApiKey: (key: string) => void;
  setModel: (model: string) => void;
  setTheme: (theme: "light" | "dark") => void;
  toggleTheme: () => void;
  setLocale: (locale: "zh" | "en") => void;
  setResponseLength: (value: ResponseLength) => void;
  setApiKey: (provider: string, key: string) => void;
  setBaseUrl: (provider: string, url: string) => void;
  setSelectedProvider: (provider: string) => void;
  setUseRAG: (value: boolean) => void;
  setUseMemory: (value: boolean) => void;
  setUseTools: (value: boolean) => void;
  setUseLocalEmbedding: (value: boolean) => void;
  getEffectiveApiKey: () => string;
  replaceProviderSettings: (
    payload: {
      provider: string;
      apiKey: string;
      baseUrl?: string;
    }[],
  ) => void;
  resetProviderSettings: () => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      openaiApiKey: "",
      model: "gpt-5-mini",
      theme: "dark",
      locale: "en",
      responseLength: "balanced",
      apiKeys: {},
      baseUrls: {},
      selectedProvider: "openai",
      useRAG: false,
      useMemory: false,
      useTools: false,
      useLocalEmbedding: false,

      setOpenaiApiKey: (key) => set({ openaiApiKey: key }),
      setModel: (model) => set({ model }),
      setTheme: (theme) => set({ theme }),
      setLocale: (locale) => set({ locale }),
      setResponseLength: (responseLength) => set({ responseLength }),
      toggleTheme: () =>
        set((state) => ({
          theme: state.theme === "dark" ? "light" : "dark",
        })),
      setApiKey: (provider, key) =>
        set((state) => ({
          apiKeys: { ...state.apiKeys, [provider]: key },
        })),
      setBaseUrl: (provider, url) =>
        set((state) => ({
          baseUrls: { ...state.baseUrls, [provider]: url },
        })),
      setSelectedProvider: (provider) => set({ selectedProvider: provider }),
      setUseRAG: (value) => set({ useRAG: value }),
      setUseMemory: (value) => set({ useMemory: value }),
      setUseTools: (value) => set({ useTools: value }),
      setUseLocalEmbedding: (value) => set({ useLocalEmbedding: value }),
      replaceProviderSettings: (payload) =>
        set(() => ({
          apiKeys: payload.reduce<Record<string, string>>((acc, item) => {
            acc[item.provider] = item.apiKey;
            return acc;
          }, {}),
          baseUrls: payload.reduce<Record<string, string>>((acc, item) => {
            acc[item.provider] = item.baseUrl || "";
            return acc;
          }, {}),
        })),
      resetProviderSettings: () =>
        set({
          openaiApiKey: "",
          apiKeys: {},
          baseUrls: {},
          selectedProvider: "openai",
        }),
      getEffectiveApiKey: () => {
        const state = get();
        const provider = state.selectedProvider;
        const model = SUPPORTED_MODELS.find((m) => m.id === state.model);
        const modelProvider = model?.provider || provider;
        return (
          state.apiKeys[modelProvider] ||
          (modelProvider === "openai" ? state.openaiApiKey : "")
        );
      },
    }),
    {
      name: "settings-storage",
    },
  ),
);



