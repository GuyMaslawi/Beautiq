import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * buttonVariants — מבוסס cva, ממופה לפלטת Allura.
 * שמות הווריאנטים המקוריים (primary/secondary/ghost/destructive, sm/md) נשמרים
 * לתאימות לאחור. נוספו כינויי shadcn (default/outline/link, lg/icon) כדי
 * שרכיבי shadcn (dialog, calendar) יעבדו מול אותו כפתור בלי לדרוס אותו.
 */
const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "text-white active:scale-[0.98] disabled:opacity-50 hover:brightness-[1.06]",
        // כינוי shadcn ל-primary (אותו עיצוב גרדיאנט)
        default: "text-white active:scale-[0.98] disabled:opacity-50 hover:brightness-[1.06]",
        secondary:
          "bg-surface text-foreground border border-border hover:bg-background-alt active:scale-[0.98] disabled:opacity-50",
        // כינוי shadcn ל-secondary
        outline:
          "bg-surface text-foreground border border-border hover:bg-background-alt active:scale-[0.98] disabled:opacity-50",
        ghost:
          "bg-transparent text-muted hover:text-foreground hover:bg-background-alt disabled:opacity-50",
        link: "text-primary underline-offset-4 hover:underline",
        destructive:
          "text-white hover:opacity-90 active:scale-[0.98] disabled:opacity-50",
      },
      size: {
        sm: "h-9 px-4 text-sm rounded-xl",
        md: "h-11 px-5 text-base rounded-xl",
        // כינוי shadcn ל-md
        default: "h-11 px-5 text-base rounded-xl",
        lg: "h-12 px-6 text-base rounded-xl",
        icon: "size-9 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    ref?: React.Ref<HTMLButtonElement>;
  };

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  style,
  ...props
}: ButtonProps) {
  const isGradient = variant === "primary" || variant === "default";
  const isDestructive = variant === "destructive";

  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      style={
        isGradient
          ? {
              background: "linear-gradient(135deg, #c97898 0%, #b86b8c 100%)",
              boxShadow: "0 2px 10px rgba(184,107,140,0.38), inset 0 1px 0 rgba(255,255,255,0.18)",
              ...style,
            }
          : isDestructive
            ? {
                background: "linear-gradient(135deg, #c85a5a 0%, #be4a4a 100%)",
                boxShadow: "0 1px 4px rgba(190,74,74,0.20)",
                ...style,
              }
            : style
      }
      {...props}
    />
  );
}

export { buttonVariants };
