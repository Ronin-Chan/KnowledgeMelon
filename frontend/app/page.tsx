"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, Brain, MessageSquare, Sparkles } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { PageContainer, PageShell, PageSurface } from "@/components/page-shell";
import { useT } from "@/lib/i18n";

export default function Home() {
  const t = useT();

  const highlights = [
    {
      title: t("navChat"),
      description: t("homeChatDescription"),
      icon: MessageSquare,
      href: "/chat",
    },
    {
      title: t("navKnowledge"),
      description: t("homeKnowledgeDescription"),
      icon: BookOpen,
      href: "/knowledge",
    },
    {
      title: t("navMemories"),
      description: t("homeMemoryDescription"),
      icon: Brain,
      href: "/memories",
    },
  ];

  return (
    <AppShell>
      <PageShell className="min-h-[calc(100vh-4rem)] dark:[background-image:none]">
        <PageContainer className="flex min-h-[calc(100vh-4rem)] items-center py-10 lg:py-12">
          <section className="grid w-full gap-8 xl:grid-cols-[1.05fr_0.95fr] xl:items-center">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-muted/70 px-4 py-2 text-sm text-foreground shadow-[0_0_0_1px_rgba(0,0,0,0.04)]">
                <Sparkles className="h-4 w-4" />
                {t("appName")}
              </div>

              <h1 className="mt-8 text-5xl font-semibold tracking-[-0.06em] text-foreground sm:text-6xl lg:text-7xl">
                {t("homeHero")}
                <span className="block text-muted-foreground">
                  {t("homeHeroAccent")}
                </span>
              </h1>

              <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground sm:text-xl">
                {t("homeDescription")}
              </p>

              <div className="mt-10 flex flex-wrap gap-3">
                <Link
                  href="/chat"
                  className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background shadow-[0_0_0_1px_rgba(0,0,0,0.08)] transition-opacity hover:opacity-90"
                >
                  {t("startChat")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/knowledge"
                  className="inline-flex items-center gap-2 rounded-full bg-background px-5 py-3 text-sm font-medium text-foreground shadow-[0_0_0_1px_rgba(0,0,0,0.08)] transition-colors hover:bg-muted"
                >
                  {t("viewKnowledge")}
                </Link>
              </div>
            </div>

            <div className="grid gap-4">
              <PageSurface className="overflow-hidden p-0">
                <div className="border-b border-border/70 bg-muted/35 px-5 py-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                        Knowledge Melon
                      </p>
                      <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                        {t("homeHero")}
                      </p>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground text-background">
                      <Sparkles className="h-5 w-5" />
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 p-5 sm:grid-cols-3">
                  {highlights.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="rounded-2xl border border-border/70 bg-background p-4 transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-18px_rgba(0,0,0,0.35)]"
                      >
                        <Icon className="h-5 w-5 text-foreground" />
                        <h3 className="mt-4 text-sm font-medium text-foreground">
                          {item.title}
                        </h3>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">
                          {item.description}
                        </p>
                      </Link>
                    );
                  })}
                </div>
              </PageSurface>
            </div>
          </section>
        </PageContainer>
      </PageShell>
    </AppShell>
  );
}
