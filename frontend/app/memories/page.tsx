"use client";

import { useState, useCallback, useEffect } from "react";
import { useSettingsStore, SUPPORTED_MODELS } from "@/stores/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Brain,
  Plus,
  Trash2,
  Search,
  Loader2,
  ArrowLeft,
  Settings,
  X,
  Check,
  AlertCircle,
  Clock,
  Shield,
  Filter,
  Tag,
  Star,
} from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { useT } from "@/lib/i18n";

interface Memory {
  id: string;
  content: string;
  category: string;
  importance: number;
  source: string;
  created_at: string;
  access_count: number;
}

interface MemorySettings {
  auto_extract: boolean;
  whitelist_topics: string[];
  blacklist_topics: string[];
  min_importance: number;
}

interface Toast {
  id: string;
  type: "success" | "error" | "info";
  message: string;
}

const categories = [
  { value: "fact", color: "bg-blue-500/10 text-blue-600" },
  { value: "preference", color: "bg-emerald-500/10 text-emerald-600" },
  { value: "goal", color: "bg-violet-500/10 text-violet-600" },
  { value: "important", color: "bg-amber-500/10 text-amber-600" },
];

export default function MemoriesPage() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [newMemory, setNewMemory] = useState({
    content: "",
    category: "fact",
    importance: 5,
  });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [settings, setSettings] = useState<MemorySettings>({
    auto_extract: true,
    whitelist_topics: [],
    blacklist_topics: [],
    min_importance: 5,
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [newWhitelistItem, setNewWhitelistItem] = useState("");
  const [newBlacklistItem, setNewBlacklistItem] = useState("");
  const { apiKeys, openaiApiKey, model, baseUrls } = useSettingsStore();
  const t = useT();
  const categoryLabels = {
    fact: t("memoriesCategoryFact"),
    preference: t("memoriesCategoryPreference"),
    goal: t("memoriesCategoryGoal"),
    important: t("memoriesCategoryImportant"),
  };

  // Get current model's provider and API key
  const currentModel = SUPPORTED_MODELS.find((m) => m.id === model);
  const provider = currentModel?.provider || "openai";
  const apiKey =
    apiKeys[provider] || (provider === "openai" ? openaiApiKey : "") || "";
  const baseUrl = baseUrls[provider] || "";

  // Toast helper
  const showToast = useCallback((type: Toast["type"], message: string) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const fetchMemories = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/memories/`);
      if (response.ok) {
        const data = await response.json();
        setMemories(data);
      }
    } catch (error) {
      console.error("Failed to fetch memories:", error);
      showToast("error", t("memoriesFetchListFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [showToast, t]);

  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/memories/settings`);
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error("Failed to fetch memory settings:", error);
    }
  }, []);

  useEffect(() => {
    fetchMemories();
    fetchSettings();
  }, [fetchMemories, fetchSettings]);

  const handleAddMemory = async () => {
    if (!newMemory.content.trim()) {
      showToast("error", t("memoriesMissingContent"));
      return;
    }
    if (!apiKey) {
      showToast(
        "error",
        t("memoriesMissingApiKey", {
          provider: currentModel?.provider || t("settingsModelLabel"),
        }),
      );
      return;
    }

    try {
      const params = new URLSearchParams();
      params.append("api_key", apiKey);
      params.append("provider", provider);
      if (baseUrl) params.append("base_url", baseUrl);

      const response = await fetch(
        `${API_BASE_URL}/api/memories/?${params.toString()}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newMemory),
        },
      );

      if (response.ok) {
        await fetchMemories();
        setNewMemory({ content: "", category: "fact", importance: 5 });
        setShowAddForm(false);
      } else {
        showToast("error", t("memoriesAddFailed"));
      }
    } catch (error) {
      console.error("Add memory error:", error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/memories/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        showToast("success", t("memoriesDeleted"));
        await fetchMemories();
      } else {
        showToast("error", t("memoriesDeleteFailed"));
      }
    } catch (error) {
      console.error("Delete error:", error);
      showToast("error", t("memoriesDeleteFailed"));
    }
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/memories/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        showToast("success", t("memoriesSettingsSaved"));
        setShowSettings(false);
      } else {
        showToast("error", t("memoriesSettingsSaveFailed"));
      }
    } catch (error) {
      console.error("Save settings error:", error);
      showToast("error", t("memoriesSettingsSaveFailed"));
    } finally {
      setIsSavingSettings(false);
    }
  };

  const addWhitelistItem = () => {
    if (!newWhitelistItem.trim()) return;
    if (settings.whitelist_topics.includes(newWhitelistItem.trim())) {
      showToast("error", t("memoriesTopicExistsWhitelist"));
      return;
    }
    setSettings({
      ...settings,
      whitelist_topics: [...settings.whitelist_topics, newWhitelistItem.trim()],
    });
    setNewWhitelistItem("");
  };

  const removeWhitelistItem = (item: string) => {
    setSettings({
      ...settings,
      whitelist_topics: settings.whitelist_topics.filter((i) => i !== item),
    });
  };

  const addBlacklistItem = () => {
    if (!newBlacklistItem.trim()) return;
    if (settings.blacklist_topics.includes(newBlacklistItem.trim())) {
      showToast("error", t("memoriesTopicExistsBlacklist"));
      return;
    }
    setSettings({
      ...settings,
      blacklist_topics: [...settings.blacklist_topics, newBlacklistItem.trim()],
    });
    setNewBlacklistItem("");
  };

  const removeBlacklistItem = (item: string) => {
    setSettings({
      ...settings,
      blacklist_topics: settings.blacklist_topics.filter((i) => i !== item),
    });
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      showToast("error", t("memoriesSearchContentRequired"));
      return;
    }
    if (!apiKey) {
      showToast(
        "error",
        t("memoriesMissingApiKey", {
          provider: currentModel?.provider || t("settingsModelLabel"),
        }),
      );
      return;
    }

    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("query", searchQuery);
      params.append("api_key", apiKey);
      params.append("provider", provider);
      if (baseUrl) params.append("base_url", baseUrl);

      const response = await fetch(
        `${API_BASE_URL}/api/memories/search?${params.toString()}`,
      );
      if (response.ok) {
        const data = await response.json();
        setMemories(data);
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getCategoryBadge = (category: string) => {
    const cat = categories.find((c) => c.value === category);
    const label =
      categoryLabels[category as keyof typeof categoryLabels] || category;
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cat?.color || "bg-muted text-muted-foreground"}`}
      >
        {label}
      </span>
    );
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "preference":
        return <Star className="h-4 w-4 text-amber-500" />;
      case "goal":
        return <Tag className="h-4 w-4 text-blue-500" />;
      default:
        return <Brain className="h-4 w-4 text-purple-500" />;
    }
  };

  return (
    <AppShell>
      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg animate-in slide-in-from-right fade-in duration-200 ${
              toast.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
                : toast.type === "error"
                  ? "bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200"
                  : "bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200"
            }`}
          >
            {toast.type === "success" && <Check className="h-4 w-4" />}
            {toast.type === "error" && <AlertCircle className="h-4 w-4" />}
            {toast.type === "info" && <Clock className="h-4 w-4" />}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        ))}
      </div>

      {/* Sidebar */}
      <aside className="hidden">
        <div className="p-4">
          <Link
            href="/chat"
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg border border-sidebar-border hover:bg-sidebar-accent transition-colors text-sm font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("memoriesBackToChat")}
          </Link>
        </div>

        <nav className="flex-1 px-2 space-y-1">
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors cursor-pointer"
          >
            {t("memoriesHome")}
          </Link>
          <Link
            href="/knowledge"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors cursor-pointer"
          >
            {t("memoriesKnowledge")}
          </Link>
            <Link
            href="/memories"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm bg-sidebar-accent text-foreground transition-colors cursor-pointer"
          >
            <Brain className="h-4 w-4" />
            {t("memoriesManagement")}
          </Link>
          <Link
            href="/settings"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors cursor-pointer"
          >
            {t("memoriesSettings")}
          </Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-8 py-12">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-semibold mb-2">{t("memoriesTitle")}</h1>
              <p className="text-muted-foreground">{t("memoriesSubtitle")}</p>
            </div>

                <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setShowSettings(true)}>
                  <Settings className="mr-2 h-4 w-4" />
                  {t("memoriesExtractionSettings")}
                </Button>
                <Button onClick={() => setShowAddForm(!showAddForm)}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t("memoriesAddMemory")}
                </Button>
              </div>
          </div>

          {/* Settings Summary */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="p-4 rounded-lg border border-border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <Brain className="h-4 w-4 text-purple-500" />
                  <span className="text-sm font-medium">{t("memoriesAutoExtract")}</span>
                </div>
                <p className="text-2xl font-semibold">
                  {settings.auto_extract ? t("memoriesAutoExtractOn") : t("memoriesAutoExtractOff")}
                </p>
              </div>
              <div className="p-4 rounded-lg border border-border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-4 w-4 text-emerald-500" />
                  <span className="text-sm font-medium">{t("memoriesWhitelistTopics")}</span>
                </div>
              <p className="text-2xl font-semibold">
                {settings.whitelist_topics.length}
              </p>
            </div>
            <div className="p-4 rounded-lg border border-border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <Filter className="h-4 w-4 text-red-500" />
                  <span className="text-sm font-medium">{t("memoriesBlacklistTopics")}</span>
                </div>
              <p className="text-2xl font-semibold">
                {settings.blacklist_topics.length}
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="flex gap-2 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("memoriesSearchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-9"
              />
            </div>
            <Button variant="outline" onClick={handleSearch}>
              {t("memoriesSearch")}
            </Button>
          </div>

          {/* Add Memory Form */}
          {showAddForm && (
            <div className="border border-border rounded-xl p-6 mb-6">
              <h3 className="font-medium mb-4">{t("memoriesAddNewTitle")}</h3>
              <div className="space-y-4">
                <Textarea
                  placeholder={t("memoriesNeedRememberWhat")}
                  value={newMemory.content}
                  onChange={(e) =>
                    setNewMemory({ ...newMemory, content: e.target.value })
                  }
                  className="min-h-[100px]"
                />
                <div className="flex gap-3">
                  <Select
                    value={newMemory.category}
                    onValueChange={(value) =>
                      setNewMemory({ ...newMemory, category: value })
                    }
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder={t("memoriesCategory")} />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {categoryLabels[cat.value as keyof typeof categoryLabels]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={newMemory.importance}
                    onChange={(e) =>
                      setNewMemory({
                        ...newMemory,
                        importance: parseInt(e.target.value),
                      })
                    }
                    className="w-[100px]"
                    placeholder={t("memoriesImportance")}
                  />
                  <div className="flex-1"></div>
                  <Button
                    variant="outline"
                    onClick={() => setShowAddForm(false)}
                  >
                    {t("memoriesCancel")}
                  </Button>
                  <Button onClick={handleAddMemory}>{t("memoriesAdd")}</Button>
                </div>
              </div>
            </div>
          )}

          {/* Memories List */}
          <div className="border border-border rounded-xl overflow-hidden">
            {isLoading ? (
              <div className="p-12 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                <p className="text-muted-foreground mt-2">{t("memoriesLoading")}</p>
              </div>
            ) : memories.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center mx-auto mb-4">
                  <Brain className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="font-medium mb-1">{t("memoriesNoMemories")}</h3>
                <p className="text-sm text-muted-foreground">
                  {t("memoriesNoMemoriesHint")}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {memories.map((memory) => (
                  <div
                    key={memory.id}
                    className="p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                        {getCategoryIcon(memory.category)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-relaxed">
                          {memory.content}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          {getCategoryBadge(memory.category)}
                          <span>·</span>
                          <span>
                            {t("memoriesImportanceLabel")}: {memory.importance}/10
                          </span>
                          <span>·</span>
                          <span>
                            {new Date(memory.created_at).toLocaleDateString()}
                          </span>
                          {memory.access_count > 0 && (
                            <>
                              <span>·</span>
                              <span>
                                {t("memoriesReferencedTimes", {
                                  count: memory.access_count,
                                })}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => setPendingDeleteId(memory.id)}
                        className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors shrink-0"
                        title={t("memoriesDelete")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Settings Modal */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Settings className="h-5 w-5 text-muted-foreground" />
              {t("memoriesExtractionSettings")}
            </DialogTitle>
            <DialogDescription>{t("memoriesSubtitle")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
              {/* Auto Extract Toggle */}
              <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                <div>
                  <p className="font-medium">{t("memoriesAutoExtract")}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("memoriesAutoExtractDescription")}
                  </p>
                </div>
                <button
                  onClick={() =>
                    setSettings({
                      ...settings,
                      auto_extract: !settings.auto_extract,
                    })
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.auto_extract
                      ? "bg-emerald-500"
                      : "bg-gray-200 dark:bg-gray-700"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.auto_extract ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Min Importance */}
              <div className="space-y-3">
                <label className="font-medium">{t("memoriesMinImportance")}</label>
                <p className="text-sm text-muted-foreground">
                  {t("memoriesMinImportanceHint")}
                </p>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={settings.min_importance}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        min_importance: parseInt(e.target.value),
                      })
                    }
                    className="flex-1"
                  />
                  <span className="w-12 text-center font-medium">
                    {settings.min_importance}
                  </span>
                </div>
              </div>

              {/* Whitelist */}
              <div className="space-y-3">
                <label className="font-medium">{t("memoriesWhitelistTopics")}</label>
                <p className="text-sm text-muted-foreground">
                  {t("memoriesWhitelistHint")}
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newWhitelistItem}
                    onChange={(e) => setNewWhitelistItem(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addWhitelistItem();
                    }}
                    placeholder={t("memoriesAddTopic")}
                    className="flex-1 px-3 py-2 rounded-lg border border-border bg-background"
                  />
                  <Button onClick={addWhitelistItem} size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {settings.whitelist_topics.map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 text-sm"
                    >
                      {item}
                      <button
                        onClick={() => removeWhitelistItem(item)}
                        className="hover:text-emerald-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Blacklist */}
              <div className="space-y-3">
                <label className="font-medium">{t("memoriesBlacklistTopics")}</label>
                <p className="text-sm text-muted-foreground">
                  {t("memoriesBlacklistHint")}
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newBlacklistItem}
                    onChange={(e) => setNewBlacklistItem(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addBlacklistItem();
                    }}
                    placeholder={t("memoriesAddTopic")}
                    className="flex-1 px-3 py-2 rounded-lg border border-border bg-background"
                  />
                  <Button onClick={addBlacklistItem} size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {settings.blacklist_topics.map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 text-sm"
                    >
                      {item}
                      <button
                        onClick={() => removeBlacklistItem(item)}
                        className="hover:text-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/30">
              <Button variant="outline" onClick={() => setShowSettings(false)}>
                {t("memoriesCancel")}
              </Button>
              <Button onClick={handleSaveSettings} disabled={isSavingSettings}>
                {isSavingSettings ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("memoriesSaving")}
                  </>
                ) : (
                  t("memoriesSave")
                )}
              </Button>
            </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("memoriesDelete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("memoriesDeleteConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("memoriesCancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDeleteId) {
                  handleDelete(pendingDeleteId);
                }
                setPendingDeleteId(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("memoriesDelete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
