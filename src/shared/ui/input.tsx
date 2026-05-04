import { cn } from "@/shared/utils/cn";

export function Input({
  label,
  helper,
  className,
  id,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  helper?: string;
}) {
  const inputId = id ?? props.name ?? label.toLowerCase().replace(/\s+/g, "-");

  return (
    <label className="grid gap-2 text-sm text-secondary" htmlFor={inputId}>
      <span className="font-medium text-primary">{label}</span>
      <input
        id={inputId}
        className={cn(
          "h-10 rounded-md border border-border bg-surface px-3 text-sm text-primary outline-none transition-colors placeholder:text-tertiary focus:border-accent focus:ring-2 focus:ring-accent-muted",
          className
        )}
        {...props}
      />
      {helper ? <span className="text-xs text-tertiary">{helper}</span> : null}
    </label>
  );
}
