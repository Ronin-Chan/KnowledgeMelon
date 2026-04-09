"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, Brain, MessageSquare, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";

const highlights = [
  {
    title: "AI 聊天",
    description: "在对话中接入记忆与知识库，持续上下文更自然。",
    icon: MessageSquare,
    href: "/chat",
  },
  {
    title: "知识库",
    description: "上传文档并进行向量检索，让回答更贴近你的资料。",
    icon: BookOpen,
    href: "/knowledge",
  },
  {
    title: "长期记忆",
    description: "自动提取重要偏好、事实和目标，形成可复用记忆。",
    icon: Brain,
    href: "/memories",
  },
];

export default function Home() {
  return (
    <AppShell>
      <div className="relative min-h-screen overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.14),transparent_36%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_28%),linear-gradient(to_bottom,rgba(255,255,255,0.08),transparent)]" />
        <div className="relative max-w-6xl mx-auto px-6 py-16 lg:py-24">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-4 py-2 text-sm text-muted-foreground backdrop-blur">
              <Sparkles className="h-4 w-4 text-primary" />
              Knowledge Assistant
            </div>

            <h1 className="mt-8 text-5xl font-semibold tracking-tight text-foreground lg:text-7xl">
              把知识库、记忆和对话
              <span className="block text-muted-foreground">
                连接成一个工作台。
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
              这是一个用于文档检索、长期记忆和多模型聊天的统一空间。
              你可以从首页进入不同模块，左侧菜单始终保持一致，右侧只切换当前内容。
            </p>

            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                href="/chat"
                className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90"
              >
                开始聊天
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/knowledge"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-sidebar-accent"
              >
                查看知识库
              </Link>
            </div>
          </div>

          <div className="mt-16 grid gap-4 md:grid-cols-3">
            {highlights.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} className="group">
                  <div className="h-full rounded-3xl border border-border bg-card/85 p-6 shadow-sm backdrop-blur transition-all hover:-translate-y-1 hover:shadow-xl">
                    <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
