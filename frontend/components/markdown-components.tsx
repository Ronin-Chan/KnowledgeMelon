"use client";

import type { Components } from "react-markdown";

import { cn } from "@/lib/utils";

export const markdownComponents: Components = {
  a: ({ href, children, className, ...props }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className={cn(
        "text-primary underline underline-offset-2 hover:opacity-80",
        className,
      )}
      {...props}
    >
      {children}
    </a>
  ),
};
