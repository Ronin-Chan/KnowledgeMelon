"use client";

import { useEffect } from "react";
import { useSettingsStore } from "@/stores/settings";

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const locale = useSettingsStore((state) => state.locale);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = locale === "en" ? "en" : "zh-CN";
  }, [locale]);

  return <>{children}</>;
}

