"use client";

import { MoonStar, SunMedium } from "lucide-react";
import { useSettingsStore } from "@/stores/settings";

export function ThemeToggle() {
  const theme = useSettingsStore((state) => state.theme);
  const toggleTheme = useSettingsStore((state) => state.toggleTheme);

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-3 text-sm font-medium text-foreground shadow-lg shadow-black/10 backdrop-blur transition-colors hover:bg-sidebar-accent"
      aria-label="切换主题"
    >
      {theme === "dark" ? (
        <>
          <MoonStar className="h-4 w-4" />
          深色
        </>
      ) : (
        <>
          <SunMedium className="h-4 w-4" />
          浅色
        </>
      )}
    </button>
  );
}
