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
import { PageContainer, PageShell } from "@/components/page-shell";
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
  trendValue,
  trendAccent = "bg-primary",
  trendLabel,
  trendLowLabel,
  trendCurrentLabel,
  trendHighLabel,
}: {
  title: string;
  value: string;
  description: string;
  icon: ElementType;
  trendValue?: number;
  trendAccent?: string;
  trendLabel?: string;
  trendLowLabel: string;
  trendCurrentLabel: string;
  trendHighLabel: string;
}) {
  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {description}
          </p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {trendValue !== undefined && (
        <div className="mt-4">
          <MiniTrendBar
            value={trendValue}
            accent={trendAccent}
            labels={{
              low: trendLowLabel,
              current: trendCurrentLabel,
              high: trendHighLabel,
            }}
          />
          {trendLabel && (
            <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {trendLabel}
            </p>
          )}
        </div>
      )}
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
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </div>
    </div>
  );
}

function MiniTrendBar({
  value,
  accent = "bg-primary",
  labels,
}: {
  value: number;
  accent?: string;
  labels: {
    low: string;
    current: string;
    high: string;
  };
}) {
  const normalized = Math.max(0, Math.min(1, value));
  const bars = Array.from({ length: 12 }, (_, index) => {
    const threshold = (index + 1) / 12;
    return normalized >= threshold;
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        <span>{labels.low}</span>
        <span className="rounded-full bg-muted px-2 py-0.5 normal-case tracking-normal text-foreground">
          {labels.current}: {formatPercent(normalized)}
        </span>
        <span>{labels.high}</span>
      </div>
      <div className="flex h-2 items-center gap-1 overflow-hidden rounded-full bg-muted/80">
        {bars.map((active, index) => (
          <span
            key={index}
            className={`h-full flex-1 rounded-full transition-colors ${active ? accent : "bg-muted-foreground/20"}`}
          />
        ))}
      </div>
    </div>
  );
}

function QualityMeterCard({
  title,
  value,
  accent,
  note,
  tone = "positive",
  labels,
  directionLabel,
}: {
  title: string;
  value: number;
  accent: string;
  note: string;
  tone?: "positive" | "risk";
  labels: {
    low: string;
    mid: string;
    high: string;
  };
  directionLabel: string;
}) {
  const normalized = Math.max(0, Math.min(1, value));
  const totalBars = 12;
  const filled = Math.round(normalized * totalBars);
  const toneClass =
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-300"
      : "text-red-600 dark:text-red-300";

  return (
    <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className={`mt-1 text-3xl font-semibold tracking-tight ${toneClass}`}>
            {formatPercent(normalized)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{note}</p>
        </div>
        <div
          className={`rounded-2xl px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
            tone === "positive"
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "bg-red-500/10 text-red-700 dark:text-red-300"
          }`}
        >
          {directionLabel}
        </div>
      </div>
      <div className="mt-4">
        <div className="flex h-14 items-end gap-1 rounded-2xl bg-muted/30 px-3 py-3">
          {Array.from({ length: totalBars }, (_, index) => {
            const active = index < filled;
            const fillOpacity =
              0.25 + (index / Math.max(totalBars - 1, 1)) * 0.75;
            const segmentClass = active ? accent : "bg-muted-foreground/20";
            return (
              <span
                key={index}
                className={`flex-1 rounded-full transition-all ${segmentClass}`}
                style={{
                  height: `${26 + index * 5}%`,
                  opacity: active ? fillOpacity : 0.2,
                }}
              />
            );
          })}
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{labels.low}</span>
          <span>{labels.mid}</span>
          <span>{labels.high}</span>
        </div>
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
        setInteractions(
          (await interactionsResponse.json()) as InteractionItem[],
        );
      } catch (err) {
        console.error("Failed to load insights:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load insights",
        );
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
    const total = interactions.reduce(
      (acc, item) => acc + item.citation_coverage,
      0,
    );
    return total / interactions.length;
  }, [interactions]);

  const maxUsageValue = useMemo(
    () =>
      Math.max(
        summary?.usage.interactions ?? 0,
        summary?.usage.rag_interactions ?? 0,
        summary?.memory.active_memories ?? 0,
        summary?.knowledge.archived_documents ?? 0,
        1,
      ),
    [summary],
  );

  const qualityCards = useMemo(
    () =>
      summary
        ? [
            {
              key: "answer_success_rate",
              title: t("insightsAnswerSuccessRate"),
              value: summary.quality.answer_success_rate,
              accent: "bg-emerald-500",
              note: t("insightsHigherBetter"),
              tone: "positive",
            },
            {
              key: "one_shot_rate",
              title: t("insightsOneShotRate"),
              value: summary.quality.one_shot_rate,
              accent: "bg-emerald-500",
              note: t("insightsHigherBetter"),
              tone: "positive",
            },
            {
              key: "follow_up_rate",
              title: t("insightsFollowUpRate"),
              value: summary.quality.follow_up_rate,
              accent: "bg-red-500",
              note: t("insightsLowerBetter"),
              tone: "risk",
            },
            {
              key: "hallucination_rate",
              title: t("insightsHallucinationRate"),
              value: summary.quality.hallucination_rate,
              accent: "bg-red-500",
              note: t("insightsLowerBetter"),
              tone: "risk",
            },
            {
              key: "human_correction_rate",
              title: t("insightsHumanCorrectionRate"),
              value: summary.quality.human_correction_rate,
              accent: "bg-red-500",
              note: t("insightsLowerBetter"),
              tone: "risk",
            },
          ]
        : [],
    [summary, t],
  );

  const getSourceSnippet = (content: string, maxLength = 120) => {
    const normalized = content.replace(/\s+/g, " ").trim();
    if (normalized.length <= maxLength) {
      return normalized;
    }
    return `${normalized.slice(0, maxLength).trim()}...`;
  };

  return (
    <AppShell>
      <PageShell className="min-h-screen overflow-x-hidden dark:[background-image:none]">
        <PageContainer>
          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                {t("insightsTitle")}
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
                {t("insightsSubtitle")}
              </p>
            </div>
            <div className="hidden rounded-2xl border border-border bg-card px-4 py-3 text-right shadow-sm sm:block">
              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                {t("insightsCitationCoverageRate")}
              </div>
              <div className="mt-2 text-2xl font-semibold">
                {formatPercent(recentAverageScore)}
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="flex min-h-[50vh] items-center justify-center">
              <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4 shadow-sm">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">
                  {t("knowledgeLoading")}
                </span>
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
                  trendValue={summary.usage.interactions / maxUsageValue}
                  trendAccent="bg-blue-500"
                  trendLabel={t("insightsMetricTrend")}
                  trendLowLabel={t("insightsTrendLow")}
                  trendCurrentLabel={t("insightsTrendCurrent")}
                  trendHighLabel={t("insightsTrendHigh")}
                />
                <MetricCard
                  title={t("insightsRagInteractions")}
                  value={String(summary.usage.rag_interactions)}
                  description={t("insightsRetrieval")}
                  icon={BookOpen}
                  trendValue={summary.usage.rag_interactions / maxUsageValue}
                  trendAccent="bg-emerald-500"
                  trendLabel={t("insightsMetricTrend")}
                  trendLowLabel={t("insightsTrendLow")}
                  trendCurrentLabel={t("insightsTrendCurrent")}
                  trendHighLabel={t("insightsTrendHigh")}
                />
                <MetricCard
                  title={t("insightsActiveMemories")}
                  value={String(summary.memory.active_memories)}
                  description={t("insightsMemory")}
                  icon={Brain}
                  trendValue={summary.memory.active_memories / maxUsageValue}
                  trendAccent="bg-violet-500"
                  trendLabel={t("insightsMetricTrend")}
                  trendLowLabel={t("insightsTrendLow")}
                  trendCurrentLabel={t("insightsTrendCurrent")}
                  trendHighLabel={t("insightsTrendHigh")}
                />
                <MetricCard
                  title={t("insightsArchivedDocuments")}
                  value={String(summary.knowledge.archived_documents)}
                  description={t("insightsKnowledge")}
                  icon={FileText}
                  trendValue={
                    summary.knowledge.archived_documents / maxUsageValue
                  }
                  trendAccent="bg-orange-500"
                  trendLabel={t("insightsMetricTrend")}
                  trendLowLabel={t("insightsTrendLow")}
                  trendCurrentLabel={t("insightsTrendCurrent")}
                  trendHighLabel={t("insightsTrendHigh")}
                />
              </section>

              <section className="space-y-4">
                <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600">
                      <BookOpen className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold">
                        {t("insightsRetrieval")}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {t("insightsSubtitle")}
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
                    <div className="space-y-4">
                      <ProgressBar
                        label={t("insightsRetrievalHitRate")}
                        value={summary.retrieval.hit_rate}
                        color="bg-blue-500"
                      />
                      <ProgressBar
                        label={t("insightsNoResultRate")}
                        value={summary.retrieval.no_result_rate}
                        color="bg-amber-500"
                      />
                      <ProgressBar
                        label={t("insightsCitationCoverageRate")}
                        value={summary.retrieval.citation_coverage_rate}
                        color="bg-emerald-500"
                      />
                    </div>
                    <div className="space-y-3 text-sm">
                      <div className="rounded-2xl bg-muted/50 p-3">
                        <div className="text-muted-foreground">
                          {t("insightsAvgTopK")}
                        </div>
                        <div className="mt-1 text-xl font-semibold">
                          {summary.retrieval.avg_top_k.toFixed(1)}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-muted/50 p-3">
                        <div className="text-muted-foreground">
                          {t("insightsAvgRetrieved")}
                        </div>
                        <div className="mt-1 text-xl font-semibold">
                          {summary.retrieval.avg_retrieved_count.toFixed(1)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-600">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold">
                        {t("insightsQuality")}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {t("insightsSubtitle")}
                      </p>
                    </div>
                  </div>
                  <div className="mb-4 rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-3">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">
                          {t("insightsQualityDistribution")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t("insightsQualityDistributionHint")}
                        </p>
                        <p className="mt-2 text-xs leading-6 text-muted-foreground">
                          {t("insightsQualityExplainBody")}
                        </p>
                      </div>
                      <div className="hidden items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground sm:flex">
                        <span>{t("insightsQualityPositive")}</span>
                        <span>·</span>
                        <span>{t("insightsQualityRisk")}</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {qualityCards.map((card) => (
                      <QualityMeterCard
                        key={card.key}
                        title={card.title}
                        value={card.value}
                        accent={card.accent}
                        note={card.note}
                        tone={card.tone}
                        labels={{
                          low: t("insightsDistributionLow"),
                          mid: t("insightsDistributionMid"),
                          high: t("insightsDistributionHigh"),
                        }}
                        directionLabel={
                          card.inverse
                            ? t("insightsLowerBetter")
                            : t("insightsHigherBetter")
                        }
                      />
                    ))}
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
                      <h2 className="text-lg font-semibold">
                        {t("insightsKnowledge")}
                      </h2>
                    </div>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between rounded-2xl bg-muted/50 px-4 py-3">
                      <span className="text-muted-foreground">
                        {t("insightsArchivedDocuments")}
                      </span>
                      <span className="font-semibold">
                        {summary.knowledge.archived_documents}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-muted/50 px-4 py-3">
                      <span className="text-muted-foreground">
                        {t("insightsDuplicateDocuments")}
                      </span>
                      <span className="font-semibold">
                        {summary.knowledge.duplicate_documents}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-muted/50 px-4 py-3">
                      <span className="text-muted-foreground">
                        {t("insightsKnowledge")}
                      </span>
                      <span className="font-semibold">
                        {summary.knowledge.active_documents}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600">
                      <Brain className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold">
                        {t("insightsMemory")}
                      </h2>
                    </div>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between rounded-2xl bg-muted/50 px-4 py-3">
                      <span className="text-muted-foreground">
                        {t("insightsActiveMemories")}
                      </span>
                      <span className="font-semibold">
                        {summary.memory.active_memories}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-muted/50 px-4 py-3">
                      <span className="text-muted-foreground">
                        {t("insightsExpiredMemories")}
                      </span>
                      <span className="font-semibold">
                        {summary.memory.expired_memories}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-600">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold">
                        {t("insightsUsage")}
                      </h2>
                    </div>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between rounded-2xl bg-muted/50 px-4 py-3">
                      <span className="text-muted-foreground">
                        {t("insightsConversations")}
                      </span>
                      <span className="font-semibold">
                        {summary.usage.conversations}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-muted/50 px-4 py-3">
                      <span className="text-muted-foreground">
                        {t("insightsDocuments")}
                      </span>
                      <span className="font-semibold">
                        {summary.usage.documents}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-muted/50 px-4 py-3">
                      <span className="text-muted-foreground">
                        {t("insightsMemories")}
                      </span>
                      <span className="font-semibold">
                        {summary.usage.memories}
                      </span>
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
                        <h2 className="text-lg font-semibold">
                          {t("insightsRecent")}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          {t("insightsRecentSources")}
                        </p>
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
                      <details
                        key={item.id}
                        className="group rounded-3xl border border-border bg-muted/20 p-4 shadow-sm open:bg-card"
                      >
                        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              {item.question}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {new Date(item.created_at).toLocaleString(
                                locale === "zh" ? "zh-CN" : "en-US",
                              )}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="rounded-full bg-background px-2.5 py-1 text-muted-foreground">
                              {item.mode}
                            </span>
                            <span className="rounded-full bg-background px-2.5 py-1 text-muted-foreground">
                              {t("insightsRecentSources")}:{" "}
                              {item.citation_count}
                            </span>
                            <span
                              className={`rounded-full px-2.5 py-1 ${item.answer_success ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"}`}
                            >
                              {item.answer_success ? t("success") : t("error")}
                            </span>
                            <span className="rounded-full bg-background px-2.5 py-1 text-muted-foreground">
                              {t("insightsRecentExpand")}
                            </span>
                          </div>
                        </summary>
                        <div className="mt-4 grid gap-3 xl:grid-cols-[1.1fr_0.9fr]">
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="rounded-2xl bg-background p-3">
                              <div className="text-xs text-muted-foreground">
                                {t("insightsRecentAnswer")}
                              </div>
                              <p className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
                                {item.answer || t("insightsNoData")}
                              </p>
                            </div>
                            <div className="rounded-2xl bg-background p-3">
                              <div className="text-xs text-muted-foreground">
                                {t("insightsRecentSources")}
                              </div>
                              <div className="mt-2 space-y-2">
                                {item.retrieved_sources
                                  .slice(0, 3)
                                  .map((source) => (
                                    <div
                                      key={source.id}
                                      className="rounded-lg bg-muted/50 px-3 py-2 text-xs"
                                    >
                                      <div className="flex items-center justify-between gap-3">
                                        <span className="truncate font-medium">
                                          {source.document_title}
                                        </span>
                                        <span className="text-muted-foreground">
                                          {source.score.toFixed(2)}
                                        </span>
                                      </div>
                                      <p className="mt-1 text-muted-foreground">
                                        {getSourceSnippet(
                                          source.reason ||
                                            source.document_title,
                                        )}
                                      </p>
                                      <details className="mt-1">
                                        <summary className="cursor-pointer text-[11px] font-medium text-primary hover:underline">
                                          {t("insightsRecentExpand")}
                                        </summary>
                                        <div className="mt-2 space-y-2">
                                          <p className="text-xs leading-5 text-muted-foreground">
                                            {source.reason ||
                                              source.document_title}
                                          </p>
                                          <p className="text-[11px] text-muted-foreground">
                                            {source.reason}
                                          </p>
                                        </div>
                                      </details>
                                    </div>
                                  ))}
                                {item.retrieved_sources.length === 0 && (
                                  <p className="text-xs text-muted-foreground">
                                    {t("insightsNoData")}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="rounded-2xl bg-background p-3">
                            <div className="text-xs text-muted-foreground">
                              {t("insightsQuality")}
                            </div>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                              <div className="rounded-2xl bg-muted/40 p-3">
                                <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                                  {t("insightsRetrievalHitRate")}
                                </div>
                                <div className="mt-2 text-2xl font-semibold">
                                  {formatPercent(item.retrieval_hit_rate)}
                                </div>
                                <div className="mt-3">
                                  <MiniTrendBar
                                    value={item.retrieval_hit_rate}
                                    accent="bg-blue-500"
                                    labels={{
                                      low: t("insightsTrendLow"),
                                      current: t("insightsTrendCurrent"),
                                      high: t("insightsTrendHigh"),
                                    }}
                                  />
                                </div>
                              </div>
                              <div className="rounded-2xl bg-muted/40 p-3">
                                <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                                  {t("insightsCitationCoverageRate")}
                                </div>
                                <div className="mt-2 text-2xl font-semibold">
                                  {formatPercent(item.citation_coverage)}
                                </div>
                                <div className="mt-3">
                                  <MiniTrendBar
                                    value={item.citation_coverage}
                                    accent="bg-emerald-500"
                                    labels={{
                                      low: t("insightsTrendLow"),
                                      current: t("insightsTrendCurrent"),
                                      high: t("insightsTrendHigh"),
                                    }}
                                  />
                                </div>
                              </div>
                              <div className="rounded-2xl bg-muted/40 p-3">
                                <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                                  {t("insightsOneShotRate")}
                                </div>
                                <div className="mt-2 text-2xl font-semibold">
                                  {item.first_try_answer
                                    ? t("success")
                                    : t("error")}
                                </div>
                                <div className="mt-3">
                                  <MiniTrendBar
                                    value={item.first_try_answer ? 1 : 0}
                                    accent="bg-violet-500"
                                    labels={{
                                      low: t("insightsTrendLow"),
                                      current: t("insightsTrendCurrent"),
                                      high: t("insightsTrendHigh"),
                                    }}
                                  />
                                </div>
                              </div>
                              <div className="rounded-2xl bg-muted/40 p-3">
                                <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                                  {t("insightsAnswerSuccessRate")}
                                </div>
                                <div className="mt-2 text-2xl font-semibold">
                                  {item.answer_success
                                    ? t("success")
                                    : t("error")}
                                </div>
                                <div className="mt-3">
                                  <MiniTrendBar
                                    value={item.answer_success ? 1 : 0}
                                    accent="bg-emerald-500"
                                    labels={{
                                      low: t("insightsTrendLow"),
                                      current: t("insightsTrendCurrent"),
                                      high: t("insightsTrendHigh"),
                                    }}
                                  />
                                </div>
                              </div>
                              <div className="rounded-2xl bg-muted/40 p-3 sm:col-span-2">
                                <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                                  {t("insightsAnswerProfile")}
                                </div>
                                <div className="mt-3 flex items-center gap-3">
                                  <div className="flex-1">
                                    <div className="flex h-3 overflow-hidden rounded-full bg-muted">
                                      <div
                                        className="bg-emerald-500"
                                        style={{
                                          width: `${Math.round(item.citation_coverage * 100)}%`,
                                        }}
                                      />
                                      <div
                                        className="bg-amber-500"
                                        style={{
                                          width: `${Math.round(item.follow_up_required ? 15 : 5)}%`,
                                        }}
                                      />
                                      <div
                                        className="bg-red-500"
                                        style={{
                                          width: `${Math.round(item.hallucination_flag ? 10 : 0)}%`,
                                        }}
                                      />
                                    </div>
                                  </div>
                                  <span className="text-xs text-muted-foreground">
                                    {t("insightsAnswerProfileLegend")}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </details>
                    ))}
                  </div>
                )}
              </section>
            </div>
          ) : null}
        </PageContainer>
      </PageShell>
    </AppShell>
  );
}
