import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/shared/utils/cn";

const buttonVariants = cva(
  "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-transparent px-4 text-sm font-medium transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary: "bg-accent text-on-accent shadow-[0_0_0_1px_oklch(100%_0_0_/_0.12)_inset,0_10px_28px_oklch(68%_0.12_205_/_0.22)] hover:bg-accent-strong hover:shadow-[0_0_0_1px_oklch(100%_0_0_/_0.18)_inset,0_14px_34px_oklch(68%_0.12_205_/_0.28)]",
        secondary: "border-border bg-surface-raised text-primary hover:border-border-strong hover:bg-surface-hover",
        ghost: "text-secondary hover:bg-surface-hover hover:text-primary",
        danger: "bg-danger text-on-accent hover:bg-danger-strong"
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-5 text-base",
        icon: "h-10 w-10 px-0"
      }
    },
    defaultVariants: {
      variant: "primary",
      size: "md"
    }
  }
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
  };

export function Button({ asChild, className, loading, variant, size, children, disabled, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  if (asChild) {
    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), className)}
        aria-busy={loading || undefined}
        {...props}
      >
        {children}
      </Comp>
    );
  }

  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}
      {children}
    </Comp>
  );
}
