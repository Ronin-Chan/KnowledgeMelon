"use client";

import { useEffect, useMemo, useState, type ElementType } from "react";
import {
  AlertTriangle,
  Brain,
  BookOpen,
  FileText,
  Link2,
  Loader2,
  MessageSquare,
  Sparkles,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { apiFetch } from "@/lib/api";
import { useLocale, useT } from "@/lib/i18n";

type SummaryResponse = {
  usage: {
    conversations: number;
    documents: number;
    memories: number;
    interactions: number;
    rag_interactions: number;
  };
  retrieval: {
    hit_rate: number;
    no_result_rate: number;
    avg_top_k: number;
    avg_retrieved_count: number;
    avg_citation_coverage: number;
    citation_coverage_rate: number;
  };
  quality: {
    answer_success_rate: number;
    one_shot_rate: number;
    follow_up_rate: number;
    hallucination_rate: number;
    human_correction_rate: number;
  };
  knowledge: {
    archived_documents: number;
    duplicate_documents: number;
    active_documents: number;
  };
  memory: {
    active_memories: number;
    expired_memories: number;
  };
};

type InteractionItem = {
  id: string;
  question: string;
  answer?: string | null;
  mode: string;
  top_k: number;
  retrieved_count: number;
  no_result: boolean;
  citation_count: number;
  citation_coverage: number;
  retrieval_hit_rate: number;
  answer_success: boolean;
  first_try_answer: boolean;
  follow_up_required: boolean;
  hallucination_flag: boolean;
  human_correction_flag: boolean;
  retrieved_sources: Array<{
    id: string;
    document_title: string;
    chunk_index: number;
    score: number;
    reason: string;
  }>;
  created_at: string;
};

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: ElementType;
}) {
  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function ProgressBar({
  label,
  value,
  color = "bg-primary",
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{formatPercent(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
    </div>
  );
}

export default function InsightsPage() {
  const t = useT();
  const locale = useLocale();
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [interactions, setInteractions] = useState<InteractionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [summaryResponse, interactionsResponse] = await Promise.all([
          apiFetch("/api/metrics/summary"),
          apiFetch("/api/metrics/interactions?limit=10"),
        ]);

        if (!summaryResponse.ok) {
          throw new Error("Failed to load summary");
        }
        if (!interactionsResponse.ok) {
          throw new Error("Failed to load interactions");
        }

        setSummary((await summaryResponse.json()) as SummaryResponse);
        setInteractions((await interactionsResponse.json()) as InteractionItem[]);
      } catch (err) {
        console.error("Failed to load insights:", err);
        setError(err instanceof Error ? err.message : "Failed to load insights");
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, []);

  const recentAverageScore = useMemo(() => {
    if (!interactions.length) {
      return 0;
    }
    const total = interactions.reduce((acc, item) => acc + item.citation_coverage, 0);
    return total / interactions.length;
  }, [interactions]);

  return (
    <AppShell>
      <div className="relative min-h-screen overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.15),transparent_34%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_28%),linear-gradient(to_bottom,rgba(255,255,255,0.04),transparent)]" />
        <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 sm:py-12">
          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">{t("insightsTitle")}</h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
                {t("insightsSubtitle")}
              </p>
            </div>
            <div className="hidden rounded-2xl border border-border bg-card px-4 py-3 text-right shadow-sm sm:block">
              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{t("insightsCitationCoverageRate")}</div>
              <div className="mt-2 text-2xl font-semibold">{formatPercent(recentAverageScore)}</div>
            </div>
          </div>

          {isLoading ? (
            <div className="flex min-h-[50vh] items-center justify-center">
              <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4 shadow-sm">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">{t("knowledgeLoading")}</span>
              </div>
            </div>
          ) : error ? (
            <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
              {error}
            </div>
          ) : summary ? (
            <div className="space-y-8">
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  title={t("insightsTotalInteractions")}
                  value={String(summary.usage.interactions)}
                  description={t("insightsUsage")}
                  icon={MessageSquare}
                />
                <MetricCard
                  title={t("insightsRagInteractions")}
                  value={String(summary.usage.rag_interactions)}
                  description={t("insightsRetrieval")}
                  icon={BookOpen}
                />
                <MetricCard
                  title={t("insightsActiveMemories")}
                  value={String(summary.memory.active_memories)}
                  description={t("insightsMemory")}
                  icon={Brain}
                />
                <MetricCard
                  title={t("insightsArchivedDocuments")}
                  value={String(summary.knowledge.archived_documents)}
                  description={t("insightsKnowledge")}
                  icon={FileText}
                />
              </section>

              <section className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600">
                      <BookOpen className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold">{t("insightsRetrieval")}</h2>
                      <p className="text-sm text-muted-foreground">{t("insightsSubtitle")}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <ProgressBar label={t("insightsRetrievalHitRate")} value={summary.retrieval.hit_rate} color="bg-blue-500" />
                    <ProgressBar label={t("insightsNoResultRate")} value={summary.retrieval.no_result_rate} color="bg-amber-500" />
                    <ProgressBar label={t("insightsCitationCoverageRate")} value={summary.retrieval.citation_coverage_rate} color="bg-emerald-500" />
                  </div>
                  <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-2xl bg-muted/50 p-3">
                      <div className="text-muted-foreground">{t("insightsAvgTopK")}</div>
                      <div className="mt-1 text-xl font-semibold">{summary.retrieval.avg_top_k.toFixed(1)}</div>
                    </div>
                    <div className="rounded-2xl bg-muted/50 p-3">
                      <div className="text-muted-foreground">{t("insightsAvgRetrieved")}</div>
                      <div className="mt-1 text-xl font-semibold">{summary.retrieval.avg_retrieved_count.toFixed(1)}</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-600">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold">{t("insightsQuality")}</h2>
                      <p className="text-sm text-muted-foreground">{t("insightsSubtitle")}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <ProgressBar label={t("insightsAnswerSuccessRate")} value={summary.quality.answer_success_rate} color="bg-emerald-500" />
                    <ProgressBar label={t("insightsOneShotRate")} value={summary.quality.one_shot_rate} color="bg-blue-500" />
                    <ProgressBar label={t("insightsFollowUpRate")} value={summary.quality.follow_up_rate} color="bg-amber-500" />
                    <ProgressBar label={t("insightsHallucinationRate")} value={summary.quality.hallucination_rate} color="bg-red-500" />
                    <ProgressBar label={t("insightsHumanCorrectionRate")} value={summary.quality.human_correction_rate} color="bg-slate-500" />
                  </div>
                </div>
              </section>

              <section className="grid gap-4 lg:grid-cols-3">
                <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold">{t("insightsKnowledge")}</h2>
                    </div>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between rounded-2xl bg-muted/50 px-4 py-3">
                      <span className="text-muted-foreground">{t("insightsArchivedDocuments")}</span>
                      <span className="font-semibold">{summary.knowledge.archived_documents}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-muted/50 px-4 py-3">
                      <span className="text-muted-foreground">{t("insightsDuplicateDocuments")}</span>
                      <span className="font-semibold">{summary.knowledge.duplicate_documents}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-muted/50 px-4 py-3">
                      <span className="text-muted-foreground">{t("insightsKnowledge")}</span>
                      <span className="font-semibold">{summary.knowledge.active_documents}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600">
                      <Brain className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold">{t("insightsMemory")}</h2>
                    </div>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between rounded-2xl bg-muted/50 px-4 py-3">
                      <span className="text-muted-foreground">{t("insightsActiveMemories")}</span>
                      <span className="font-semibold">{summary.memory.active_memories}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-muted/50 px-4 py-3">
                      <span className="text-muted-foreground">{t("insightsExpiredMemories")}</span>
                      <span className="font-semibold">{summary.memory.expired_memories}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-600">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold">{t("insightsUsage")}</h2>
                    </div>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between rounded-2xl bg-muted/50 px-4 py-3">
                      <span className="text-muted-foreground">{t("insightsConversations")}</span>
                      <span className="font-semibold">{summary.usage.conversations}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-muted/50 px-4 py-3">
                      <span className="text-muted-foreground">{t("insightsDocuments")}</span>
                      <span className="font-semibold">{summary.usage.documents}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-muted/50 px-4 py-3">
                      <span className="text-muted-foreground">{t("insightsMemories")}</span>
                      <span className="font-semibold">{summary.usage.memories}</span>
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-3xl border border-border bg-card p-6 shadow-sm">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Link2 className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold">{t("insightsRecent")}</h2>
                        <p className="text-sm text-muted-foreground">{t("insightsRecentSources")}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {interactions.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
                    {t("insightsNoData")}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {interactions.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-border bg-muted/20 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              {item.question}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {new Date(item.created_at).toLocaleString(locale === "zh" ? "zh-CN" : "en-US")}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="rounded-full bg-background px-2.5 py-1 text-muted-foreground">
                              {item.mode}
                            </span>
                            <span className="rounded-full bg-background px-2.5 py-1 text-muted-foreground">
                              {t("insightsRecentSources")}: {item.citation_count}
                            </span>
                            <span className={`rounded-full px-2.5 py-1 ${item.answer_success ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"}`}>
                              {item.answer_success ? t("success") : t("error")}
                            </span>
                          </div>
                        </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                          <div className="rounded-xl bg-background p-3">
                            <div className="text-xs text-muted-foreground">{t("insightsRecentAnswer")}</div>
                            <p className="mt-1 max-h-20 overflow-hidden text-sm leading-6 text-foreground">
                              {item.answer || t("insightsNoData")}
                            </p>
                          </div>
                          <div className="rounded-xl bg-background p-3">
                            <div className="text-xs text-muted-foreground">{t("insightsRecentSources")}</div>
                            <div className="mt-2 space-y-2">
                              {item.retrieved_sources.slice(0, 3).map((source) => (
                                <div key={source.id} className="rounded-lg bg-muted/50 px-3 py-2 text-xs">
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="truncate font-medium">{source.document_title}</span>
                                    <span className="text-muted-foreground">{source.score.toFixed(2)}</span>
                                  </div>
                                  <p className="mt-1 text-muted-foreground">{source.reason}</p>
                                </div>
                              ))}
                              {item.retrieved_sources.length === 0 && (
                                <p className="text-xs text-muted-foreground">{t("insightsNoData")}</p>
                              )}
                            </div>
                          </div>
                          <div className="rounded-xl bg-background p-3">
                            <div className="text-xs text-muted-foreground">{t("insightsQuality")}</div>
                            <div className="mt-2 space-y-2 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">{t("insightsRetrievalHitRate")}</span>
                                <span>{formatPercent(item.retrieval_hit_rate)}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">{t("insightsCitationCoverageRate")}</span>
                                <span>{formatPercent(item.citation_coverage)}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">{t("insightsOneShotRate")}</span>
                                <span>{item.first_try_answer ? t("success") : t("error")}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
