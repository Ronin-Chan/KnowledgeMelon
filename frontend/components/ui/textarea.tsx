import * as React from "react";
import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md bg-background px-3 py-2 text-sm shadow-[0_0_0_1px_rgba(0,0,0,0.08)] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_0_0_2px_var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-50 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.12)] dark:focus-visible:shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_0_0_2px_hsla(212,100%,58%,1)]",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
