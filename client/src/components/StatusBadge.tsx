import { Badge } from "@/components/ui/badge";

type StatusIcon = {
  name: string;
  iconPath: string;
} | null;

export default function StatusBadge({ status, statusIcon }: { status: string; statusIcon?: StatusIcon }) {
  return (
    <Badge variant="outline" className="gap-2 bg-white text-gray-900">
      {statusIcon?.iconPath ? <img src={statusIcon.iconPath} alt="" className="h-5 w-5 rounded-full" /> : null}
      {status}
    </Badge>
  );
}
