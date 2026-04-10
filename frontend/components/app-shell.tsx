"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brain, BookOpen, Home, MessageSquare, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

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

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="w-72 shrink-0 border-r border-sidebar-border bg-sidebar-background/95 backdrop-blur flex flex-col">
        <div className="px-5 py-5 border-b border-sidebar-border">
          <div className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
            {t("appName")}
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            {t("appTagline")}
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
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
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border" />
      </aside>

      <main className="flex-1 min-w-0 overflow-y-auto">{children}</main>
    </div>
  );
}

