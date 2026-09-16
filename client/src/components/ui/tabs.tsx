import * as React from "react";
import { cn } from "@/lib/utils";

type TabsContextValue = {
  value: string;
  setValue: (value: string) => void;
};

const TabsContext = React.createContext<TabsContextValue | null>(null);

export function Tabs({ defaultValue, value, onValueChange, children, className }: {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const [internalValue, setInternalValue] = React.useState(defaultValue ?? "");
  const actualValue = value ?? internalValue;
  const setValue = (nextValue: string) => {
    setInternalValue(nextValue);
    onValueChange?.(nextValue);
  };

  return <TabsContext.Provider value={{ value: actualValue, setValue }}><div className={className}>{children}</div></TabsContext.Provider>;
}

export function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground", className)} {...props} />;
}

export function TabsTrigger({ value, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }) {
  const context = React.useContext(TabsContext);
  const active = context?.value === value;
  return (
    <button
      className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium", active && "bg-background text-foreground shadow-sm", className)}
      onClick={() => context?.setValue(value)}
      {...props}
    />
  );
}

export function TabsContent({ value, className, ...props }: React.HTMLAttributes<HTMLDivElement> & { value: string }) {
  const context = React.useContext(TabsContext);
  if (context?.value !== value) return null;
  return <div className={cn("mt-2", className)} {...props} />;
}
