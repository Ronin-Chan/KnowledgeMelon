"use client";

import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

export function PageShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative min-h-full bg-[radial-gradient(circle_at_top,rgba(0,0,0,0.04),transparent_28%),linear-gradient(to_bottom,rgba(250,250,250,1),rgba(255,255,255,1))] dark:bg-background dark:[background-image:none]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PageContainer({
  children,
  className,
  ...props
}: {
  children: ReactNode;
  className?: string;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn(
        "mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PageSurface({
  children,
  className,
  ...props
}: {
  children: ReactNode;
  className?: string;
} & HTMLAttributes<HTMLElement>) {
  return (
    <section
      {...props}
      className={cn(
        "rounded-[28px] border border-border/70 bg-background/92 p-5 shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_2px_2px_rgba(0,0,0,0.02),0_16px_48px_-32px_rgba(0,0,0,0.24)] backdrop-blur supports-[backdrop-filter]:bg-background/88 sm:p-6",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="max-w-3xl">
        {eyebrow && (
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-muted/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            {eyebrow}
          </div>
        )}
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
