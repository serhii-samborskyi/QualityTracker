import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type CheckboxProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> & {
  onCheckedChange?: (checked: boolean) => void;
};

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, defaultChecked, onCheckedChange, ...props }, ref) => (
    <label className={cn("inline-flex h-4 w-4 items-center justify-center rounded border border-primary bg-background", className)}>
      <input
        ref={ref}
        type="checkbox"
        className="sr-only"
        checked={checked}
        defaultChecked={defaultChecked}
        onChange={(event) => onCheckedChange?.(event.target.checked)}
        {...props}
      />
      {checked ? <Check className="h-3 w-3" /> : null}
    </label>
  ),
);
Checkbox.displayName = "Checkbox";
