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
    <label className="grid gap-1.5 text-sm text-secondary" htmlFor={inputId}>
      <span className="text-[12px] font-medium text-primary">{label}</span>
      <input
        id={inputId}
        className={cn(
          "h-9 rounded-md border border-border bg-surface px-3 text-[13px] text-primary outline-none transition-colors placeholder:text-tertiary focus:border-accent focus:ring-0",
          className
        )}
        {...props}
      />
      {helper ? <span className="text-[11px] text-tertiary">{helper}</span> : null}
    </label>
  );
}
