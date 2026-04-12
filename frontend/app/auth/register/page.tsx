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

export default function RegisterPage() {
  const router = useRouter();
  const { token, hydrated, setAuth } = useAuthStore();
  const locale = useSettingsStore((state) => state.locale);
  const setLocale = useSettingsStore((state) => state.setLocale);
  const [username, setUsername] = useState("");
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
      const response = await apiFetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            data?.detail,
            locale === "zh" ? "注册失败" : "Registration failed",
          ),
        );
      }
      setAuth(data.access_token, data.user);
      router.push("/settings");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : locale === "zh"
            ? "注册失败"
            : "Registration failed",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const toggleLocale = () => setLocale(locale === "zh" ? "en" : "zh");

  return (
    <main className="relative min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.14),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.12),transparent_32%)] bg-background px-4 py-6 text-foreground transition-colors sm:px-6 sm:py-10">
      <button
        type="button"
        onClick={toggleLocale}
        className="absolute right-4 top-4 z-20 rounded-full bg-background px-3 py-2 text-sm shadow-[0_0_0_1px_rgba(0,0,0,0.08)]"
      >
        {locale === "zh" ? "English" : "中文"}
      </button>

      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-5xl items-center justify-center sm:min-h-[calc(100vh-5rem)]">
        <Card className="grid w-full max-w-4xl overflow-hidden bg-card md:grid-cols-[1fr_1.05fr]">
          <div className="bg-foreground px-6 py-8 text-background sm:px-8 sm:py-10 md:px-10 md:py-12">
            <div className="text-sm uppercase tracking-[0.3em] text-background/70">
              {locale === "zh" ? "个人工作区" : "Personal Workspace"}
            </div>
            <h1 className="mt-6 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
              {locale === "zh" ? "创建你的账户" : "Create your account"}
            </h1>
            <p className="mt-4 max-w-md text-sm leading-7 text-background/75">
              {locale === "zh"
                ? "每个账户都有独立的对话、知识库和记忆。API Key 默认保存在本地，如你选择，也可以同步到服务器。"
                : "Each account gets its own isolated conversations, knowledge base, and memories. API keys stay local by default and can be synced to the server only if you choose."}
            </p>
          </div>

          <div className="px-6 py-8 sm:px-8 sm:py-10 md:px-10 md:py-12">
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label className="text-foreground/85" htmlFor="username">
                  {locale === "zh" ? "用户名" : "Username"}
                </Label>
                <Input
                  id="username"
                  placeholder={locale === "zh" ? "你的名字" : "Your name"}
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="border-border bg-background text-foreground placeholder:text-muted-foreground"
                  required
                />
              </div>
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
                  minLength={8}
                  placeholder={
                    locale === "zh" ? "至少 8 个字符" : "At least 8 characters"
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
              <Button className="w-full" disabled={isLoading} type="submit">
                {isLoading
                  ? locale === "zh"
                    ? "创建账户中..."
                    : "Creating account..."
                  : locale === "zh"
                    ? "注册"
                    : "Register"}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground md:text-left">
              {locale === "zh" ? "已有账户？" : "Already have an account?"}{" "}
              <Link
                className="font-medium text-foreground underline underline-offset-4"
                href="/auth/login"
              >
                {locale === "zh" ? "登录" : "Log in"}
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </main>
  );
}
