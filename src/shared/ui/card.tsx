import { cn } from "@/shared/utils/cn";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section
      className={cn(
        "rounded-lg border border-border bg-surface-raised/85 p-5 backdrop-blur-[2px] transition-colors duration-150",
        className
      )}
    >
      {children}
    </section>
  );
}

export function CardHeader({ title, eyebrow, action }: { title: string; eyebrow?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        {eyebrow ? (
          <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.08em] text-tertiary">{eyebrow}</p>
        ) : null}
        <h2 className="text-base font-semibold text-primary">{title}</h2>
      </div>
      {action}
    </div>
  );
}
