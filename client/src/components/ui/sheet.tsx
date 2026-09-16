import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type SheetContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const SheetContext = React.createContext<SheetContextValue | null>(null);

export function Sheet({ open, defaultOpen = false, onOpenChange, children }: {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const actualOpen = open ?? internalOpen;
  const setOpen = (nextOpen: boolean) => {
    setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };

  return <SheetContext.Provider value={{ open: actualOpen, setOpen }}>{children}</SheetContext.Provider>;
}

export function SheetTrigger({ asChild, children }: { asChild?: boolean; children: React.ReactElement }) {
  const context = React.useContext(SheetContext);
  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<any>;
    return React.cloneElement(child, {
      onClick: (event: React.MouseEvent) => {
        child.props.onClick?.(event);
        context?.setOpen(true);
      },
    });
  }
  return <button onClick={() => context?.setOpen(true)}>{children}</button>;
}

export function SheetContent({ className, children, side: _side, ...props }: React.HTMLAttributes<HTMLDivElement> & { side?: "left" | "right" | "top" | "bottom" }) {
  const context = React.useContext(SheetContext);
  if (!context?.open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50">
      <div className={cn("fixed inset-y-0 left-0 w-80 max-w-[85vw] bg-background p-6 shadow-lg", className)} {...props}>
        <button className="absolute right-4 top-4" onClick={() => context.setOpen(false)}>
          <X className="h-4 w-4" />
        </button>
        {children}
      </div>
    </div>
  );
}
