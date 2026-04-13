import { apiFetch } from "@/lib/api";
import {
  getLocalizedModels,
  type LocalizedModelConfig,
  PROVIDERS,
} from "@/stores/settings";
import type { Locale } from "@/lib/i18n";

export interface CustomModelRecord {
  id: string;
  model_id: string;
  display_name: string | null;
  provider: string;
  base_url: string | null;
  description: string | null;
  context_window: number | null;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomModelPayload {
  model_id: string;
  display_name?: string | null;
  provider: string;
  base_url?: string | null;
  description?: string | null;
  context_window?: number | null;
  pinned?: boolean;
}

export interface ResolvedModelConfig extends LocalizedModelConfig {
  isCustom?: boolean;
  pinned?: boolean;
  customId?: string;
  baseUrl?: string | null;
}

export const CUSTOM_MODEL_PROVIDER_OPTIONS = PROVIDERS;

export const humanizeModelId = (value: string) =>
  value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

export const getCustomModelDisplayName = (model: CustomModelRecord) =>
  model.display_name?.trim() || humanizeModelId(model.model_id);

export const resolveModels = (
  locale: Locale,
  customModels: CustomModelRecord[],
): ResolvedModelConfig[] => {
  const builtinModels = getLocalizedModels(locale).map((model) => ({
    ...model,
    isCustom: false,
    pinned: false,
    customId: undefined,
    baseUrl: null,
  }));

  const customEntries = customModels.map((model) => ({
    id: model.model_id,
    name: getCustomModelDisplayName(model),
    provider: model.provider,
    description: model.description?.trim() || "",
    contextWindow: model.context_window ?? undefined,
    isCustom: true,
    pinned: model.pinned,
    customId: model.id,
    baseUrl: model.base_url,
  }));

  return [...customEntries, ...builtinModels];
};

export async function fetchCustomModels() {
  const response = await apiFetch("/api/custom-models");
  if (!response.ok) {
    throw new Error("Failed to load custom models");
  }
  return (await response.json()) as CustomModelRecord[];
}

export async function saveCustomModel(payload: CustomModelPayload) {
  const response = await apiFetch("/api/custom-models", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Failed to save custom model");
  }

  return (await response.json()) as CustomModelRecord;
}

export async function updateCustomModel(
  id: string,
  payload: CustomModelPayload,
) {
  const response = await apiFetch(`/api/custom-models/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Failed to update custom model");
  }

  return (await response.json()) as CustomModelRecord;
}

export async function deleteCustomModel(id: string) {
  const response = await apiFetch(`/api/custom-models/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Failed to delete custom model");
  }

  return (await response.json()) as { success: true };
}
