"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bot,
  Check,
  ChevronDown,
  AlertCircle,
  Eye,
  EyeOff,
  Globe,
  Key,
  Clock,
  Languages,
  MoonStar,
  SunMedium,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import { PageContainer, PageHeader, PageSurface } from "@/components/page-shell";
import { useT } from "@/lib/i18n";
import { useAuthStore } from "@/stores/auth";
import {
  getLocalizedModelById,
  getLocalizedModels,
  PROVIDERS,
  useSettingsStore,
} from "@/stores/settings";

type SettingsTab = "models" | "providers" | "appearance" | "language";

type Toast = {
  id: string;
  type: "success" | "error" | "info";
  message: string;
};

export default function SettingsPage() {
  const t = useT();
  const user = useAuthStore((state) => state.user);
  const {
    model,
    setModel,
    apiKeys,
    baseUrls,
    setApiKey,
    setBaseUrl,
    selectedProvider,
    setSelectedProvider,
    getEffectiveApiKey,
    theme,
    setTheme,
    locale,
    setLocale,
  } = useSettingsStore();
  const localizedModels = getLocalizedModels(locale);

  const [activeTab, setActiveTab] = useState<SettingsTab>("models");
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [serverSyncedProviders, setServerSyncedProviders] = useState<string[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [expandedProvider, setExpandedProvider] = useState<string | null>(selectedProvider || "openai");
  const [storageAction, setStorageAction] = useState<Record<string, "save" | "remove" | null>>({});

  const showToast = useCallback((type: Toast["type"], message: string) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3000);
  }, []);

  useEffect(() => {
    const loadServerKeys = async () => {
      const response = await apiFetch("/api/auth/api-keys");
      if (!response.ok) return;
      const data: Array<{ provider: string }> = await response.json();
      setServerSyncedProviders(data.map((item) => item.provider));
    };
    void loadServerKeys();
  }, []);

  const handleModelSelect = (modelId: string) => {
    setModel(modelId);
    const modelConfig = localizedModels.find((item) => item.id === modelId);
    if (modelConfig) {
      setSelectedProvider(modelConfig.provider);
      setExpandedProvider(modelConfig.provider);
    }
  };

  const toggleShowKey = (providerId: string) => {
    setShowKey((prev) => ({ ...prev, [providerId]: !prev[providerId] }));
  };

  const syncProviderToServer = async (providerId: string) => {
    setSyncStatus(null);
    setStorageAction((prev) => ({ ...prev, [providerId]: "save" }));
    try {
      const response = await apiFetch(`/api/auth/api-keys/${providerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: providerId,
          api_key: apiKeys[providerId] || "",
          base_url: baseUrls[providerId] || "",
        }),
      });

      if (!response.ok) {
        const detail = await response.text();
        const message = detail || "Failed to save server copy.";
        setSyncStatus(message);
        showToast("error", message);
        return;
      }

      setSyncStatus("Encrypted server copy saved.");
      showToast("success", "Encrypted server copy saved.");
      setServerSyncedProviders((prev) =>
        prev.includes(providerId) ? prev : [...prev, providerId],
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save server copy.";
      setSyncStatus(message);
      showToast("error", message);
    } finally {
      setStorageAction((prev) => ({ ...prev, [providerId]: null }));
    }
  };

  const removeProviderFromServer = async (providerId: string) => {
    setSyncStatus(null);
    setStorageAction((prev) => ({ ...prev, [providerId]: "remove" }));
    try {
      const response = await apiFetch(`/api/auth/api-keys/${providerId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const detail = await response.text();
        const message = detail || "Failed to remove server copy.";
        setSyncStatus(message);
        showToast("error", message);
        return;
      }

      setSyncStatus("server copy removed.");
      showToast("info", "server copy removed.");
      setServerSyncedProviders((prev) => prev.filter((item) => item !== providerId));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to remove server copy.";
      setSyncStatus(message);
      showToast("error", message);
    } finally {
      setStorageAction((prev) => ({ ...prev, [providerId]: null }));
    }
  };

  return (
    <AppShell>
      <div className="fixed right-4 top-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-2 rounded-lg border px-4 py-3 shadow-lg animate-in slide-in-from-right fade-in duration-200 ${
              toast.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                : toast.type === "error"
                  ? "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
                  : "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200"
            }`}
          >
            {toast.type === "success" && <Check className="h-4 w-4" />}
            {toast.type === "error" && <AlertCircle className="h-4 w-4" />}
            {toast.type === "info" && <Clock className="h-4 w-4" />}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        ))}
      </div>

      <main className="flex-1 overflow-y-auto">
        <PageContainer>
          <PageHeader
            title={t("settingsTitle")}
            description={locale === "zh" ? "统一管理模型、提供商、外观与语言。" : "Manage models, providers, appearance, and language in one place."}
          />

          <PageSurface className="mt-8 p-2">
          <div className="flex gap-2 overflow-x-auto">
            {[
              ["models", t("settingsModels")],
              ["providers", t("settingsApi")],
              ["appearance", t("settingsAppearance")],
              ["language", t("settingsLanguage")],
            ].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setActiveTab(value as SettingsTab)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === value
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          </PageSurface>

          {activeTab === "models" && (
            <div className="mt-8 space-y-6">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-medium">{t("settingsChooseModel")}</h2>
                  <p className="text-sm text-muted-foreground">
                    {t("settingsChooseModelDesc")}
                  </p>
                </div>
              </div>

              <div className="mb-6 flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedProvider("")}
                  className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                    selectedProvider === ""
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {t("settingsAll")}
                </button>
                {PROVIDERS.map((provider) => (
                  <button
                    key={provider.id}
                    onClick={() => setSelectedProvider(provider.id)}
                    className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                      selectedProvider === provider.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {provider.name}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                {(selectedProvider
                  ? localizedModels.filter((item) => item.provider === selectedProvider)
                  : localizedModels
                ).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleModelSelect(item.id)}
                    className={`flex w-full items-center justify-between rounded-xl border p-4 text-left transition-all ${
                      model === item.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground/50"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{item.name}</span>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          {PROVIDERS.find((provider) => provider.id === item.provider)?.name}
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {item.description}
                      </div>
                    </div>
                    {model === item.id && (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-4 w-4" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === "providers" && (
            <div className="mt-8 space-y-6">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Key className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-medium">{t("settingsApi")}</h2>
                  <p className="text-sm text-muted-foreground">
                    {t("settingsApiDescription")}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {PROVIDERS.map((provider) => (
                  <div key={provider.id} className="overflow-hidden rounded-xl border border-border">
                    <button
                      onClick={() => setExpandedProvider(expandedProvider === provider.id ? null : provider.id)}
                      className="flex w-full items-center justify-between p-4 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{provider.name}</span>
                        {apiKeys[provider.id] && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                            {locale === "zh" ? "本地" : "Local"}
                          </span>
                        )}
                        {serverSyncedProviders.includes(provider.id) && (
                          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-700 dark:bg-sky-900 dark:text-sky-300">
                            {locale === "zh" ? "服务器" : "Server"}
                          </span>
                        )}
                      </div>
                      <ChevronDown className={`h-4 w-4 transition-transform ${expandedProvider === provider.id ? "rotate-180" : ""}`} />
                    </button>

                    {expandedProvider === provider.id && (
                      <div className="space-y-4 border-t border-border p-4">
                        <div className="space-y-2">
                          <Label htmlFor={`key-${provider.id}`}>{provider.keyName}</Label>
                          <div className="relative">
                            <Input
                              id={`key-${provider.id}`}
                              type={showKey[provider.id] ? "text" : "password"}
                              value={apiKeys[provider.id] || ""}
                              onChange={(event) => setApiKey(provider.id, event.target.value)}
                              placeholder={provider.keyName}
                              className="pr-10"
                            />
                            <button
                              type="button"
                              onClick={() => toggleShowKey(provider.id)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                              {showKey[provider.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`url-${provider.id}`}>{t("providerBaseUrlOptional")}</Label>
                          <div className="relative">
                            <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              id={`url-${provider.id}`}
                              value={baseUrls[provider.id] || ""}
                              onChange={(event) => setBaseUrl(provider.id, event.target.value)}
                              placeholder={provider.baseUrlPlaceholder}
                              className="pl-9"
                            />
                          </div>
                        </div>

                        <div className="rounded-xl border border-border bg-muted/40 p-3">
                          <div className="text-sm font-medium">
                            {locale === "zh" ? "存储模式" : "Storage mode"}
                          </div>
                          <p className="mt-1 text-xs leading-6 text-muted-foreground">
                            {locale === "zh"
                              ? "API Key 默认保存在本地。如果你希望在不同设备间更方便，也可以为这个提供商在服务器上保存一份加密副本。"
                              : "API keys are stored locally by default. If you want convenience across devices, you can also save an encrypted copy on the server for this provider."}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => void syncProviderToServer(provider.id)}
                              disabled={storageAction[provider.id] !== undefined && storageAction[provider.id] !== null}
                              className="rounded-lg bg-foreground px-3 py-2 text-sm text-background"
                            >
                              {storageAction[provider.id] === "save"
                                ? locale === "zh"
                                  ? "保存中..."
                                  : "Saving..."
                                : locale === "zh"
                                  ? "保存加密服务器副本"
                                  : "Save encrypted server copy"}
                            </button>
                            <button
                              type="button"
                              onClick={() => void removeProviderFromServer(provider.id)}
                              disabled={storageAction[provider.id] !== undefined && storageAction[provider.id] !== null}
                              className="rounded-lg border border-border px-3 py-2 text-sm"
                            >
                              {storageAction[provider.id] === "remove"
                                ? locale === "zh"
                                  ? "移除中..."
                                  : "Removing..."
                                : locale === "zh"
                                  ? "移除服务器副本"
                                  : "Remove server copy"}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-8 rounded-xl bg-muted p-4">
                <h3 className="mb-2 font-medium">{t("settingsCurrentConfig")}</h3>
                <div className="space-y-1 text-sm">
                  {user && (
                    <p>
                      <span className="text-muted-foreground">
                        {locale === "zh" ? "账户：" : "Account:"}
                      </span>{" "}
                      {user.email}
                    </p>
                  )}
                  <p>
                    <span className="text-muted-foreground">{t("settingsModelLabel")}:</span>{" "}
                    {getLocalizedModelById(locale, model)?.name || model}
                  </p>
                  <p>
                    <span className="text-muted-foreground">{t("settingsProvider")}:</span>{" "}
                    {PROVIDERS.find((provider) => provider.id === selectedProvider)?.name}
                  </p>
                  <p>
                    <span className="text-muted-foreground">{t("settingsApiStatus")}:</span>{" "}
                    {getEffectiveApiKey() ? (
                      <span className="text-emerald-600">{t("settingsConfigured")}</span>
                    ) : (
                      <span className="text-red-500">{t("settingsUnconfigured")}</span>
                    )}
                  </p>
                  {syncStatus && <p className="pt-2 text-foreground">{syncStatus}</p>}
                </div>
              </div>
            </div>
          )}

          {activeTab === "appearance" && (
            <div className="mt-8 space-y-6">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <SunMedium className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-medium">{t("settingsAppearance")}</h2>
                  <p className="text-sm text-muted-foreground">
                    {locale === "zh"
                      ? "切换浅色或深色外观。"
                      : "Switch between light and dark appearance."}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <button
                  onClick={() => setTheme("light")}
                  className={`flex items-center justify-between rounded-2xl border p-5 text-left transition-all ${theme === "light" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/50"}`}
                >
                  <div>
                    <div className="flex items-center gap-2 font-medium">
                      <SunMedium className="h-4 w-4" />
                      {t("themeLight")}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{t("themeLightDescription")}</p>
                  </div>
                  {theme === "light" && <Check className="h-5 w-5" />}
                </button>

                <button
                  onClick={() => setTheme("dark")}
                  className={`flex items-center justify-between rounded-2xl border p-5 text-left transition-all ${theme === "dark" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/50"}`}
                >
                  <div>
                    <div className="flex items-center gap-2 font-medium">
                      <MoonStar className="h-4 w-4" />
                      {t("themeDark")}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{t("themeDarkDescription")}</p>
                  </div>
                  {theme === "dark" && <Check className="h-5 w-5" />}
                </button>
              </div>
            </div>
          )}

          {activeTab === "language" && (
            <div className="mt-8 space-y-6">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Languages className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-medium">{t("settingsLanguage")}</h2>
                  <p className="text-sm text-muted-foreground">{t("languageSelectHint")}</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <button
                  onClick={() => setLocale("zh")}
                  className={`rounded-2xl border p-5 text-left transition-all ${locale === "zh" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/50"}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{t("languageChinese")}</div>
                    {locale === "zh" && <Check className="h-5 w-5" />}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{t("languageChineseDescription")}</p>
                </button>

                <button
                  onClick={() => setLocale("en")}
                  className={`rounded-2xl border p-5 text-left transition-all ${locale === "en" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/50"}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{t("languageEnglish")}</div>
                    {locale === "en" && <Check className="h-5 w-5" />}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{t("languageEnglishDescription")}</p>
                </button>
              </div>
            </div>
          )}
        </PageContainer>
      </main>
    </AppShell>
  );
}



