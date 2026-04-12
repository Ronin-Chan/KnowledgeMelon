"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Brain,
  BookOpen,
  Home,
  Menu,
  MessageSquare,
  Settings,
} from "lucide-react";
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
            "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-all",
            active
              ? "bg-foreground text-background shadow-[0_0_0_1px_rgba(0,0,0,0.08)]"
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
      <header className="sticky top-0 z-30 flex items-center justify-between bg-background/90 px-4 py-3 backdrop-blur md:hidden">
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs uppercase tracking-[0.24em] text-muted-foreground">
            {t("appName")}
          </div>
          <div className="mt-1 w-full whitespace-normal text-sm leading-6 text-muted-foreground">
            {t("appTagline")}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleLocale}
            className="min-w-[5.5rem] whitespace-nowrap rounded-full bg-background px-3 py-2 text-xs leading-none text-foreground shadow-[0_0_0_1px_rgba(0,0,0,0.08)]"
          >
            {locale === "zh" ? "English" : "中文"}
          </button>
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-background text-foreground shadow-[0_0_0_1px_rgba(0,0,0,0.08)]"
            aria-label={t("navHome")}
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      <aside className="hidden w-64 shrink-0 flex-col bg-sidebar-background/95 backdrop-blur md:sticky md:top-0 md:flex md:h-screen md:overflow-y-auto md:shadow-[1px_0_0_0_rgba(0,0,0,0.08)]">
        <div className="px-5 py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                {t("appName")}
              </div>
            </div>
          <button
            type="button"
            onClick={toggleLocale}
            className="min-w-[5.5rem] whitespace-nowrap rounded-full bg-background px-3 py-2 text-xs leading-none text-foreground shadow-[0_0_0_1px_rgba(0,0,0,0.08)]"
          >
            {locale === "zh" ? "English" : "简体中文"}
          </button>
          </div>
          <div className="mt-2 w-full whitespace-normal text-sm leading-6 text-muted-foreground">
            {t("appTagline")}
          </div>
        </div>

        <nav className="flex-1 space-y-2 px-3 py-3">{renderNavItems()}</nav>

        <div className="p-4">
          {user ? (
            <div className="space-y-3 rounded-3xl bg-background p-3 shadow-[0_0_0_1px_rgba(0,0,0,0.08)]">
              <div className="rounded-2xl bg-muted/40 px-3 py-3">
                <div className="text-sm font-medium text-foreground">
                  {user.username}
                </div>
                <div className="text-xs text-muted-foreground">{user.email}</div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full rounded-2xl bg-foreground px-3 py-2.5 text-sm text-background transition-colors hover:opacity-90"
              >
                {locale === "zh" ? "登出" : "Logout"}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <Link
                href="/auth/login"
                className="block rounded-2xl bg-background px-3 py-2.5 text-sm text-center text-muted-foreground shadow-[0_0_0_1px_rgba(0,0,0,0.08)] transition-colors hover:text-foreground"
              >
                {locale === "zh" ? "登录" : "Login"}
              </Link>
              <Link
                href="/auth/register"
                className="block rounded-2xl bg-foreground px-3 py-2.5 text-sm text-center text-background shadow-[0_0_0_1px_rgba(0,0,0,0.08)]"
              >
                {locale === "zh" ? "注册" : "Register"}
              </Link>
            </div>
          )}
        </div>
      </aside>

      <Dialog open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <DialogContent className="left-0 top-0 h-dvh w-[min(20rem,85vw)] max-w-none translate-x-0 translate-y-0 rounded-none rounded-r-3xl p-0">
          <DialogTitle className="sr-only">{t("appName")}</DialogTitle>
          <div className="flex h-full flex-col bg-sidebar-background/95">
            <div className="px-5 py-5">
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                  {t("appName")}
                </div>
                <div className="mt-1 w-full whitespace-normal text-sm leading-6 text-muted-foreground">
                  {t("appTagline")}
                </div>
              </div>
            </div>
            <nav className="flex-1 space-y-2 px-3 py-3">
              {renderNavItems(() => setMobileNavOpen(false))}
            </nav>
            {user && (
              <div className="p-4">
                <div className="rounded-3xl bg-background p-3 shadow-[0_0_0_1px_rgba(0,0,0,0.08)]">
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
                  className="mt-3 w-full rounded-2xl bg-foreground px-3 py-2.5 text-sm text-background transition-colors hover:opacity-90"
                >
                  {locale === "zh" ? "登出" : "Logout"}
                </button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <main className="min-w-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(0,0,0,0.035),transparent_26%),linear-gradient(to_bottom,rgba(250,250,250,1),rgba(255,255,255,1))] dark:bg-background dark:[background-image:none]">
        {children}
      </main>
    </div>
  );
}
