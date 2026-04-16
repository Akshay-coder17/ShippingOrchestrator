/**
 * UI Component Library - Button, Card, Input, etc.
 */

import React from "react";
import clsx from "clsx";

export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "secondary" | "ghost";
    size?: "sm" | "md" | "lg";
  }
>(({ className, variant = "primary", size = "md", ...props }, ref) => {
  const variants = {
    primary:
      "bg-accent text-black hover:bg-opacity-90 font-semibold enabled:hover:shadow-lg enabled:hover:shadow-accent/50",
    secondary: "bg-white/10 text-text-primary hover:bg-white/20",
    ghost: "text-text-primary hover:bg-white/5",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg",
  };

  return (
    <button
      ref={ref}
      className={clsx(
        "rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
});

Button.displayName = "Button";

export const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { glassmorphism?: boolean }
>(({ className, glassmorphism = true, ...props }, ref) => (
  <div
    ref={ref}
    className={clsx(
      "rounded-xl border transition-all duration-200",
      glassmorphism
        ? "bg-bg-card border-border backdrop-blur-md"
        : "bg-white/5 border-white/10",
      className
    )}
    {...props}
  />
));

Card.displayName = "Card";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={clsx(
      "w-full px-4 py-2 rounded-lg bg-white/5 border border-border text-text-primary placeholder:text-text-primary/50",
      "focus:outline-none focus:border-accent focus:shadow-lg focus:shadow-accent/20",
      "transition-all duration-200",
      className
    )}
    {...props}
  />
));

Input.displayName = "Input";

export const Badge = ({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger";
}) => {
  const variants = {
    default: "bg-accent/20 text-accent",
    success: "bg-accent-green/20 text-accent-green",
    warning: "bg-accent-orange/20 text-accent-orange",
    danger: "bg-red-500/20 text-red-400",
  };

  return (
    <span className={clsx("px-2 py-1 rounded-md text-xs font-semibold", variants[variant])}>
      {children}
    </span>
  );
};

export const LoadingSpinner = () => (
  <div className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-accent border-t-transparent" />
);

export const GlowingBorder = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={clsx(
      "relative p-1 rounded-lg",
      className
    )}
    style={{
      background: "linear-gradient(135deg, #00d4ff, #0099ff)",
    }}
  >
    <div className="bg-bg-primary rounded-lg p-4">{children}</div>
  </div>
);
