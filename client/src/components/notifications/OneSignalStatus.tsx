import { useQuery } from "@tanstack/react-query";
import { getUserOneSignalStatus } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

export default function OneSignalStatus() {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/settings/onesignal/status"],
    queryFn: getUserOneSignalStatus,
  });

  if (isLoading) return <Badge variant="outline">Checking notifications</Badge>;

  return (
    <Badge variant={data?.isSubscribed ? "default" : "outline"}>
      {data?.isSubscribed ? "Notifications enabled" : "Notifications disabled"}
    </Badge>
  );
}
