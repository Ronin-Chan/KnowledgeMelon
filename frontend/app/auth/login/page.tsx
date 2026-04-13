"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import { getErrorMessage } from "@/lib/error-message";
import { useAuthStore } from "@/stores/auth";
import { useSettingsStore } from "@/stores/settings";

export default function LoginPage() {
  const router = useRouter();
  const { token, hydrated, setAuth } = useAuthStore();
  const locale = useSettingsStore((state) => state.locale);
  const setLocale = useSettingsStore((state) => state.setLocale);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (hydrated && token) {
      router.replace("/chat");
    }
  }, [hydrated, router, token]);

  if (!hydrated) {
    return null;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await apiFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            data?.detail,
            locale === "zh" ? "登录失败" : "Login failed",
          ),
        );
      }

      setAuth(data.access_token, data.user);
      const keysResponse = await apiFetch("/api/auth/api-keys");
      if (keysResponse.ok) {
        const keys = await keysResponse.json();
        useSettingsStore.getState().replaceProviderSettings(
          keys.map(
            (item: {
              provider: string;
              api_key: string;
              base_url: string;
            }) => ({
              provider: item.provider,
              apiKey: item.api_key,
              baseUrl: item.base_url,
            }),
          ),
        );
      } else {
        useSettingsStore.getState().replaceProviderSettings([]);
      }
      router.push("/chat");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : locale === "zh"
            ? "登录失败"
            : "Login failed",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const toggleLocale = () => setLocale(locale === "zh" ? "en" : "zh");

  return (
    <main className="relative min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.12),transparent_34%)] bg-background px-4 py-6 text-foreground transition-colors sm:px-6 sm:py-10">
      <button
        type="button"
        onClick={toggleLocale}
        className="absolute right-4 top-4 z-20 rounded-full bg-background px-3 py-2 text-sm shadow-[0_0_0_1px_rgba(0,0,0,0.06)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
      >
        {locale === "zh" ? "English" : "中文"}
      </button>

      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-5xl items-center justify-center sm:min-h-[calc(100vh-5rem)]">
        <Card className="grid w-full max-w-4xl overflow-hidden border border-border/70 bg-card shadow-[0_24px_60px_-32px_rgba(15,23,42,0.42)] md:grid-cols-[1.05fr_0.95fr]">
          <div className="bg-slate-950 px-6 py-8 text-slate-50 dark:bg-slate-950 dark:text-slate-50 sm:px-8 sm:py-10 md:px-10 md:py-12">
            <div className="text-sm uppercase tracking-[0.3em] text-slate-50/70">
              Knowledge Melon
            </div>
            <h1 className="mt-6 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
              {locale === "zh" ? "欢迎回来" : "Welcome back"}
            </h1>
            <p className="mt-4 max-w-md text-sm leading-7 text-slate-50/75">
              {locale === "zh"
                ? "登录后可访问你的对话、知识库、记忆，以及可选的加密服务器端 API Key 同步。"
                : "Log in to access your conversations, knowledge base, memories, and optional encrypted server-side API key sync."}
            </p>
          </div>

          <div className="px-6 py-8 sm:px-8 sm:py-10 md:px-10 md:py-12">
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label className="text-foreground/85" htmlFor="email">
                  {locale === "zh" ? "邮箱" : "Email"}
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={
                    locale === "zh" ? "你的邮箱地址" : "your@email.com"
                  }
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="border-border bg-background text-foreground placeholder:text-muted-foreground"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground/85" htmlFor="password">
                  {locale === "zh" ? "密码" : "Password"}
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder={
                    locale === "zh" ? "请输入密码" : "Enter your password"
                  }
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="border-border bg-background text-foreground placeholder:text-muted-foreground"
                  required
                />
              </div>
              {error && (
                <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600 shadow-[0_0_0_1px_rgba(0,0,0,0.06)] dark:bg-red-950/30 dark:text-red-300">
                  {error}
                </div>
              )}
              <Button
                className="w-full bg-slate-950 text-white shadow-[0_0_0_1px_rgba(0,0,0,0.06)] hover:bg-slate-800 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
                disabled={isLoading}
                type="submit"
              >
                {isLoading
                  ? locale === "zh"
                    ? "登录中..."
                    : "Logging in..."
                  : locale === "zh"
                    ? "登录"
                    : "Login"}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground md:text-left">
              {locale === "zh" ? "新用户？" : "New here?"}{" "}
              <Link
                className="font-medium text-foreground underline underline-offset-4"
                href="/auth/register"
              >
                {locale === "zh" ? "创建账户" : "Create an account"}
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </main>
  );
}
