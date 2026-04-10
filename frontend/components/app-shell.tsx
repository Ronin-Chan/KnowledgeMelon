"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Brain, BookOpen, Home, MessageSquare, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
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
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const t = useT();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-foreground shadow-sm"
          aria-label={t("navHome")}
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      <aside className="hidden w-72 shrink-0 flex-col border-r border-sidebar-border bg-sidebar-background/95 backdrop-blur md:flex">
        <div className="px-5 py-5 border-b border-sidebar-border">
          <div className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
            {t("appName")}
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            {t("appTagline")}
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">{renderNavItems()}</nav>

        <div className="p-4 border-t border-sidebar-border" />
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
          </div>
        </DialogContent>
      </Dialog>

      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
