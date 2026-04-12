"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { Menu, Brain, BookOpen, Home, MessageSquare, Settings, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { useAuthStore } from "@/stores/auth";
import { useSettingsStore } from "@/stores/settings";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

const NAV_ITEMS = [
  { href: "/", labelKey: "navHome", icon: Home },
  { href: "/chat", labelKey: "navChat", icon: MessageSquare },
  { href: "/knowledge", labelKey: "navKnowledge", icon: BookOpen },
  { href: "/memories", labelKey: "navMemories", icon: Brain },
  { href: "/settings", labelKey: "navSettings", icon: Settings },
  { href: "/insights", labelKey: "navInsights", icon: BarChart3 },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useT();
  const locale = useSettingsStore((state) => state.locale);
  const setLocale = useSettingsStore((state) => state.setLocale);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { token, user, hydrated, clearAuth } = useAuthStore();
  const resetProviderSettings = useSettingsStore(
    (state) => state.resetProviderSettings,
  );
  const isProtectedRoute =
    pathname !== "/" && !pathname.startsWith("/auth/");
  const shouldRedirectToLogin = hydrated && isProtectedRoute && !token;

  useEffect(() => {
    if (shouldRedirectToLogin) {
      router.replace("/auth/login");
    }
  }, [router, shouldRedirectToLogin]);

  const handleLogout = () => {
    clearAuth();
    resetProviderSettings();
    router.push("/auth/login");
  };

  const toggleLocale = () => setLocale(locale === "zh" ? "en" : "zh");

  if (!hydrated && isProtectedRoute) {
    return null;
  }

  if (shouldRedirectToLogin) {
    return null;
  }

  const renderNavItems = (onNavigate?: () => void) =>
    NAV_ITEMS.map((item) => {
      const Icon = item.icon;
      const active =
        item.href === "/"
          ? pathname === "/"
          : pathname === item.href || pathname.startsWith(`${item.href}/`);

      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
            active
              ? "bg-foreground text-background shadow-sm"
              : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
          )}
        >
          <Icon className="h-4 w-4" />
          <span className="font-medium">{t(item.labelKey)}</span>
        </Link>
      );
    });

  return (
    <div className="min-h-screen bg-background md:flex">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur md:hidden">
        <div>
          <div className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
            {t("appName")}
          </div>
          <div className="text-sm text-muted-foreground">{t("appTagline")}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleLocale}
            className="rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground shadow-sm"
          >
            {locale === "zh" ? "EN" : "中文"}
          </button>
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-foreground shadow-sm"
            aria-label={t("navHome")}
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      <aside className="hidden w-72 shrink-0 flex-col border-r border-sidebar-border bg-sidebar-background/95 backdrop-blur md:sticky md:top-0 md:flex md:h-screen md:overflow-y-auto">
        <div className="flex items-start justify-between border-b border-sidebar-border px-5 py-5">
          <div className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
            {t("appName")}
          </div>
          <button
            type="button"
            onClick={toggleLocale}
            className="rounded-xl border border-sidebar-border bg-card px-3 py-2 text-xs text-foreground"
          >
            {locale === "zh" ? "EN" : "中文"}
          </button>
        </div>
        <div className="px-5 py-3 text-sm text-muted-foreground">
          {t("appTagline")}
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">{renderNavItems()}</nav>

        <div className="border-t border-sidebar-border p-4">
          {user ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-sidebar-border bg-card px-3 py-3">
                <div className="text-sm font-medium text-foreground">
                  {user.username}
                </div>
                <div className="text-xs text-muted-foreground">{user.email}</div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full rounded-xl border border-sidebar-border px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
              >
                {locale === "zh" ? "登出" : "Logout"}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <Link
                href="/auth/login"
                className="block rounded-xl border border-sidebar-border px-3 py-2.5 text-sm text-center text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
              >
                {locale === "zh" ? "登录" : "Login"}
              </Link>
              <Link
                href="/auth/register"
                className="block rounded-xl bg-foreground px-3 py-2.5 text-sm text-center text-background"
              >
                {locale === "zh" ? "注册" : "Register"}
              </Link>
            </div>
          )}
        </div>
      </aside>

      <Dialog open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <DialogContent className="left-0 top-0 h-dvh w-[min(20rem,85vw)] max-w-none translate-x-0 translate-y-0 rounded-none rounded-r-3xl border-r p-0">
          <DialogTitle className="sr-only">{t("appName")}</DialogTitle>
          <div className="flex h-full flex-col bg-sidebar-background/95">
            <div className="border-b border-sidebar-border px-5 py-5">
              <div className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                {t("appName")}
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                {t("appTagline")}
              </div>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1">
              {renderNavItems(() => setMobileNavOpen(false))}
            </nav>
            {user && (
              <div className="border-t border-sidebar-border p-4">
                <div className="rounded-xl border border-sidebar-border bg-card px-3 py-3">
                  <div className="text-sm font-medium text-foreground">
                    {user.username}
                  </div>
                  <div className="text-xs text-muted-foreground">{user.email}</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMobileNavOpen(false);
                    handleLogout();
                  }}
                  className="mt-3 w-full rounded-xl border border-sidebar-border px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
                >
                  {locale === "zh" ? "登出" : "Logout"}
                </button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
