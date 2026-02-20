import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
  {
    variants: {
      variant: {
        default: "",
        warning: "",
        danger: "",
        info: "",
        outline:
          "border border-[color:var(--border)] text-[color:var(--muted)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const badgeStyles: Record<string, React.CSSProperties> = {
  default: { backgroundColor: 'var(--badge-default-bg)', color: 'var(--badge-default-text)' },
  warning: { backgroundColor: 'var(--badge-warning-bg)', color: 'var(--badge-warning-text)' },
  danger:  { backgroundColor: 'var(--badge-danger-bg)',  color: 'var(--badge-danger-text)'  },
  info:    { backgroundColor: 'var(--badge-info-bg)',    color: 'var(--badge-info-text)'    },
};

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, style, ...props }: BadgeProps) {
  const variantStyle = variant && variant !== 'outline' ? badgeStyles[variant] : undefined;
  return (
    <div
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      style={{ ...variantStyle, ...style }}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
