import { cn } from "@/shared/utils/cn";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn("rounded-lg border border-border bg-surface-raised p-5 shadow-soft", className)}>{children}</section>;
}

export function CardHeader({ title, eyebrow, action }: { title: string; eyebrow?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        {eyebrow ? <p className="mb-1 text-xs font-medium uppercase text-tertiary">{eyebrow}</p> : null}
        <h2 className="text-lg font-semibold text-primary">{title}</h2>
      </div>
      {action}
    </div>
  );
}
