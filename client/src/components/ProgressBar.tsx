import { cn } from "@/lib/utils";

export default function ProgressBar({ value, status }: { value: number; status?: string }) {
  const safeValue = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const color =
    status === "Gigabit Guru" ? "bg-emerald-500" :
    status === "Signal Master" ? "bg-teal-500" :
    status === "Ladder Expert" ? "bg-amber-500" :
    status === "Cable Keeper" ? "bg-slate-400" :
    "bg-rose-500";

  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${safeValue}%` }} />
    </div>
  );
}
