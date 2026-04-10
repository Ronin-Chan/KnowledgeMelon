"use client";

import { useState } from "react";
import {
  useSettingsStore,
  PROVIDERS,
  getLocalizedModels,
  getLocalizedModelById,
} from "@/stores/settings";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Key,
  Bot,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Globe,
  MoonStar,
  SunMedium,
  Languages,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useT } from "@/lib/i18n";

type SettingsTab = "models" | "providers" | "appearance" | "language";

export default function SettingsPage() {
  const t = useT();
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
  const [expandedProvider, setExpandedProvider] = useState<string | null>(
    selectedProvider || "openai",
  );

  const handleModelSelect = (modelId: string) => {
    setModel(modelId);
    const modelConfig = localizedModels.find((m) => m.id === modelId);
    if (modelConfig) {
      setSelectedProvider(modelConfig.provider);
      setExpandedProvider(modelConfig.provider);
    }
  };

  const toggleShowKey = (providerId: string) => {
    setShowKey((prev) => ({ ...prev, [providerId]: !prev[providerId] }));
  };

  return (
    <AppShell>
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-8 py-12">
          <h1 className="text-3xl font-semibold mb-8">{t("settingsTitle")}</h1>

          <div className="flex flex-wrap gap-2 mb-8 border-b border-border">
            {[
              ["models", t("settingsModels")],
              ["providers", t("settingsApi")],
              ["appearance", t("settingsAppearance")],
              ["language", t("settingsLanguage")],
            ].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setActiveTab(value as SettingsTab)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === value
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {activeTab === "models" && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-medium">{t("settingsChooseModel")}</h2>
                  <p className="text-sm text-muted-foreground">
                    {t("settingsChooseModelDesc")}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-6">
                <button
                  onClick={() => setSelectedProvider("")}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
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
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
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
                  ? localizedModels.filter((m) => m.provider === selectedProvider)
                  : localizedModels
                ).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleModelSelect(item.id)}
                    className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all text-left ${
                      model === item.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground/50"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{item.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {PROVIDERS.find((p) => p.id === item.provider)?.name}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {item.description}
                        {item.contextWindow && (
                          <span className="ml-2">
                            · {t("modelContextWindow", {
                              size: (item.contextWindow / 1000).toFixed(0),
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                    {model === item.id && (
                      <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                        <Check className="h-4 w-4" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === "providers" && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
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
                  <div
                    key={provider.id}
                    className="border border-border rounded-xl overflow-hidden"
                  >
                    <button
                      onClick={() =>
                        setExpandedProvider(
                          expandedProvider === provider.id ? null : provider.id,
                        )
                      }
                      className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{provider.name}</span>
                        {apiKeys[provider.id] && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                            {t("settingsConfigured")}
                          </span>
                        )}
                      </div>
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${
                          expandedProvider === provider.id ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {expandedProvider === provider.id && (
                      <div className="p-4 border-t border-border space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor={`key-${provider.id}`}>
                            {provider.keyName}
                          </Label>
                          <div className="relative">
                            <Input
                              id={`key-${provider.id}`}
                              type={showKey[provider.id] ? "text" : "password"}
                              placeholder={t("providerApiKey", {
                                keyName: provider.keyName,
                              })}
                              value={apiKeys[provider.id] || ""}
                              onChange={(e) =>
                                setApiKey(provider.id, e.target.value)
                              }
                              className="pr-10"
                            />
                            <button
                              onClick={() => toggleShowKey(provider.id)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                              {showKey[provider.id] ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`url-${provider.id}`}>
                            {t("providerBaseUrlOptional")}
                          </Label>
                          <div className="relative">
                            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              id={`url-${provider.id}`}
                              placeholder={provider.baseUrlPlaceholder}
                              value={baseUrls[provider.id] || ""}
                              onChange={(e) =>
                                setBaseUrl(provider.id, e.target.value)
                              }
                              className="pl-9"
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {t("providerBaseUrlHint")}
                          </p>
                        </div>

                        <div className="pt-2">
                          <a
                            href={getApiKeyUrl(provider.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline"
                          >
                            {t("providerGetKey", { keyName: provider.keyName })} →
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-8 p-4 rounded-xl bg-muted">
                <h3 className="font-medium mb-2">{t("settingsCurrentConfig")}</h3>
                <div className="text-sm space-y-1">
                  <p>
                    <span className="text-muted-foreground">
                      {t("settingsModelLabel")}:
                    </span>{" "}
                    {getLocalizedModelById(locale, model)?.name || model}
                  </p>
                  <p>
                    <span className="text-muted-foreground">
                      {t("settingsProvider")}:
                    </span>{" "}
                    {PROVIDERS.find((p) => p.id === selectedProvider)?.name}
                  </p>
                  <p>
                    <span className="text-muted-foreground">
                      {t("settingsApiStatus")}:
                    </span>{" "}
                    {getEffectiveApiKey() ? (
                      <span className="text-emerald-600">{t("settingsConfigured")}</span>
                    ) : (
                      <span className="text-red-500">{t("settingsUnconfigured")}</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "appearance" && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <SunMedium className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-medium">{t("settingsAppearance")}</h2>
                  <p className="text-sm text-muted-foreground">
                    {t("settingsAppearanceDescription")}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <button
                  onClick={() => setTheme("light")}
                  className={`flex items-center justify-between rounded-2xl border p-5 text-left transition-all ${
                    theme === "light"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/50"
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2 font-medium">
                      <SunMedium className="h-4 w-4" />
                      {t("themeLight")}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {t("themeLightDescription")}
                    </p>
                  </div>
                  {theme === "light" && <Check className="h-5 w-5" />}
                </button>

                <button
                  onClick={() => setTheme("dark")}
                  className={`flex items-center justify-between rounded-2xl border p-5 text-left transition-all ${
                    theme === "dark"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/50"
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2 font-medium">
                      <MoonStar className="h-4 w-4" />
                      {t("themeDark")}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {t("themeDarkDescription")}
                    </p>
                  </div>
                  {theme === "dark" && <Check className="h-5 w-5" />}
                </button>
              </div>
            </div>
          )}

          {activeTab === "language" && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Languages className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-medium">{t("settingsLanguage")}</h2>
                  <p className="text-sm text-muted-foreground">
                    {t("languageSelectHint")}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <button
                  onClick={() => setLocale("zh")}
                  className={`rounded-2xl border p-5 text-left transition-all ${
                    locale === "zh"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{t("languageChinese")}</div>
                    {locale === "zh" && <Check className="h-5 w-5" />}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t("languageChineseDescription")}
                  </p>
                </button>

                <button
                  onClick={() => setLocale("en")}
                  className={`rounded-2xl border p-5 text-left transition-all ${
                    locale === "en"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{t("languageEnglish")}</div>
                    {locale === "en" && <Check className="h-5 w-5" />}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t("languageEnglishDescription")}
                  </p>
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}

function getApiKeyUrl(providerId: string): string {
  const urls: Record<string, string> = {
    openai: "https://platform.openai.com/api-keys",
    anthropic: "https://console.anthropic.com/settings/keys",
    google: "https://aistudio.google.com/app/apikey",
    deepseek: "https://platform.deepseek.com/api_keys",
    alibaba: "https://dashscope.console.aliyun.com/apiKey",
    zhipu: "https://open.bigmodel.cn/usercenter/apikeys",
    moonshot: "https://platform.moonshot.cn/console/api-keys",
    cohere: "https://dashboard.cohere.com/api-keys",
    mistral: "https://console.mistral.ai/api-keys/",
  };
  return urls[providerId] || "#";
}
