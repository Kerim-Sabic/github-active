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
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em]",
        badgeToneClass[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
