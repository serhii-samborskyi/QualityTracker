import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastProps = React.HTMLAttributes<HTMLDivElement> & {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  variant?: "default" | "destructive";
};

export type ToastActionElement = React.ReactElement;

export function Toast({ className, open = true, onOpenChange, variant = "default", children, ...props }: ToastProps) {
  if (!open) return null;

  return (
    <div
      className={cn(
        "pointer-events-auto relative flex w-full items-start justify-between gap-4 overflow-hidden rounded-md border bg-background p-4 pr-8 shadow-lg",
        variant === "destructive" && "border-destructive bg-destructive text-destructive-foreground",
        className,
      )}
      {...props}
    >
      <div className="grid gap-1">{children}</div>
      <button className="absolute right-2 top-2 rounded-md opacity-70 hover:opacity-100" onClick={() => onOpenChange?.(false)}>
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ToastTitle({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("text-sm font-semibold", className)} {...props} />;
}

export function ToastDescription({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("text-sm opacity-90", className)} {...props} />;
}

export function ToastViewport({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("fixed bottom-0 right-0 z-50 flex max-h-screen w-full flex-col gap-2 p-4 sm:max-w-sm", className)} {...props} />;
}
