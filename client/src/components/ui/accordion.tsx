import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type AccordionContextValue = {
  value?: string;
  setValue: (value?: string) => void;
};

const AccordionContext = React.createContext<AccordionContextValue | null>(null);
const AccordionItemContext = React.createContext<string | null>(null);

export function Accordion({ defaultValue, children, className }: {
  type?: "single" | "multiple";
  collapsible?: boolean;
  defaultValue?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [value, setValue] = React.useState<string | undefined>(defaultValue);
  return <AccordionContext.Provider value={{ value, setValue }}><div className={className}>{children}</div></AccordionContext.Provider>;
}

export function AccordionItem({ value, className, ...props }: React.HTMLAttributes<HTMLDivElement> & { value: string }) {
  return <AccordionItemContext.Provider value={value}><div className={cn("border-b", className)} {...props} /></AccordionItemContext.Provider>;
}

export function AccordionTrigger({ className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const context = React.useContext(AccordionContext);
  const itemValue = React.useContext(AccordionItemContext);
  const open = context?.value === itemValue;

  return (
    <button
      className={cn("flex w-full items-center justify-between py-4 font-medium transition-all hover:underline", className)}
      onClick={() => context?.setValue(open ? undefined : itemValue ?? undefined)}
      {...props}
    >
      {children}
      <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")} />
    </button>
  );
}

export function AccordionContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const context = React.useContext(AccordionContext);
  const itemValue = React.useContext(AccordionItemContext);
  if (context?.value !== itemValue) return null;
  return <div className={cn("pb-4 pt-0", className)} {...props} />;
}
