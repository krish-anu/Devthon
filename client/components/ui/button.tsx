import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--background)] disabled:pointer-events-none disabled:opacity-60",
  {
    variants: {
      variant: {
        default: "bg-(--brand) text-white hover:bg-(--brand-strong)",
        secondary:
          "bg-[color:var(--surface-strong)] text-[color:var(--foreground)] hover:bg-[color:var(--surface)]",
        outline:
          "border border-[color:var(--brand)] text-[color:var(--brand)] hover:bg-[color:var(--brand)]/10",
        ghost: "text-[color:var(--brand)] hover:bg-[color:var(--brand)]/10",
        danger: "bg-rose-500 text-white hover:bg-rose-600",
        muted:
          "bg-[color:var(--surface-strong)] text-[color:var(--muted)] hover:text-[color:var(--foreground)]",
      },
      size: {
        sm: "h-9 px-4",
        md: "h-11 px-6",
        lg: "h-12 px-7 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Show loading spinner (button will be visually disabled) */
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const isDisabled = disabled || loading;

    // When `asChild` is used, `Slot` requires a single React element child. To
    // support `loading` without creating multiple child nodes (which causes
    // React.Children.only errors), inject the spinner into that single child via
    // React.cloneElement when it's safe to do so. Otherwise omit the spinner to
    // avoid runtime exceptions.
    if (asChild) {
      const slotClassName = cn(buttonVariants({ variant, size }), className, loading ? "opacity-90" : "");

      let content: React.ReactNode = children;

      try {
        if (loading && React.Children.count(children) === 1 && React.isValidElement(children)) {
          const onlyChild = React.Children.only(children) as React.ReactElement<any, any>;
          const mergedChildren = (
            <>
              <svg
                aria-hidden="true"
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-current inline-block"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              {onlyChild.props.children}
            </>
          );
          // Use cloneElement with merged children as the 3rd arg to avoid typing issues
          content = React.cloneElement(onlyChild, {}, mergedChildren);
        }
      } catch (e) {
        // If we can't safely merge, skip spinner to avoid throwing at runtime.
      }

      return (
        <Slot
          className={slotClassName}
          ref={ref}
          aria-disabled={isDisabled}
          tabIndex={isDisabled ? -1 : undefined}
          {...props}
        >
          {content}
        </Slot>
      );
    }

    return (
      <button
        className={cn(buttonVariants({ variant, size }), className, loading ? "opacity-90" : "")}
        ref={ref}
        disabled={isDisabled}
        {...props}
      >
        {loading && (
          <svg
            aria-hidden="true"
            className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        )}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
