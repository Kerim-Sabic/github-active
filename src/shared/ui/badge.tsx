import { cn } from "@/shared/utils/cn";

type BadgeTone = "neutral" | "success" | "warning" | "accent" | "danger";

const badgeToneClass = {
  neutral: "border-border bg-surface-muted text-secondary",
  success: "border-success-muted bg-success-muted text-success",
  warning: "border-warning-muted bg-warning-muted text-warning",
  accent: "border-accent-muted bg-accent-muted text-accent",
  danger: "border-danger/30 bg-danger/10 text-danger"
} as const satisfies Record<BadgeTone, string>;

export function Badge({
  tone = "neutral",
  className,
  children
}: {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span className={cn("inline-flex min-h-7 items-center rounded-md border px-2.5 py-1 text-xs font-medium", badgeToneClass[tone], className)}>
      {children}
    </span>
  );
}
