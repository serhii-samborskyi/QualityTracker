import { useMutation, useQuery } from "@tanstack/react-query";
import { Bell, BellOff, CheckCircle2, Loader2, Send, TriangleAlert } from "lucide-react";
import { getOneSignalConfig, getUserOneSignalStatus, subscribeOneSignalToken, unsubscribeOneSignalToken } from "@/lib/api";
import { requestOneSignalPermission, getOneSignalStatus, isOneSignalAvailable } from "@/lib/one-signal-utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function OneSignalStatus() {
  const { toast } = useToast();
  const configQuery = useQuery({
    queryKey: ["/api/config/onesignal"],
    queryFn: getOneSignalConfig,
  });
  const statusQuery = useQuery({
    queryKey: ["/api/settings/onesignal/status"],
    queryFn: getUserOneSignalStatus,
  });

  const subscribeMutation = useMutation({
    mutationFn: async () => {
      const granted = await requestOneSignalPermission();
      if (!granted) {
        throw new Error("Browser notification permission was not granted");
      }

      const browserStatus = await getOneSignalStatus();
      const token = browserStatus.token || browserStatus.userId;
      if (!token) {
        throw new Error("OneSignal did not return a subscription id");
      }

      return subscribeOneSignalToken(token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/onesignal/status"] });
      toast({
        title: "Notifications enabled",
        description: "This device will receive Quality Tracker notifications.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Could not enable notifications",
        description: error?.message || "Please check browser notification permissions.",
        variant: "destructive",
      });
    },
  });

  const unsubscribeMutation = useMutation({
    mutationFn: unsubscribeOneSignalToken,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/onesignal/status"] });
      toast({
        title: "Notifications disabled",
        description: "This device was removed from push notifications.",
      });
    },
  });

  const configured = Boolean(configQuery.data?.enabled);
  const subscribed = Boolean(statusQuery.data?.isSubscribed);
  const loading = configQuery.isLoading || statusQuery.isLoading;

  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-3xl border border-slate-100 bg-slate-50 p-6">
        <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
        <span className="text-sm text-slate-600">Checking notification status...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-3xl border border-slate-100 bg-slate-50 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className={`rounded-2xl p-3 ${subscribed ? "bg-emerald-100 text-emerald-700" : "bg-white text-slate-600"}`}>
              {subscribed ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-slate-950">Push notifications</h3>
                <Badge variant={subscribed ? "default" : "outline"}>
                  {subscribed ? "Enabled" : "Disabled"}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {subscribed
                  ? "This browser is subscribed and can receive QC alerts."
                  : "Subscribe this browser to receive new QC and review alerts."}
              </p>
            </div>
          </div>

          {subscribed ? (
            <Button
              variant="outline"
              onClick={() => unsubscribeMutation.mutate()}
              disabled={unsubscribeMutation.isPending}
              className="admin-secondary-button shrink-0"
            >
              {unsubscribeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellOff className="h-4 w-4" />}
              Disable
            </Button>
          ) : (
            <Button
              onClick={() => subscribeMutation.mutate()}
              disabled={!configured || subscribeMutation.isPending}
              className="admin-primary-button shrink-0"
            >
              {subscribeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
              Enable
            </Button>
          )}
        </div>

        {!configured && (
          <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Add `ONESIGNAL_APP_ID` and `ONESIGNAL_API_KEY` in Coolify to enable push notifications.</span>
          </div>
        )}

        {configured && !isOneSignalAvailable() && (
          <div className="flex items-start gap-2 rounded-2xl border border-teal-200 bg-teal-50 p-3 text-sm text-teal-800">
            <Send className="mt-0.5 h-4 w-4 shrink-0" />
            <span>If the enable button does not prompt immediately, refresh once so the OneSignal SDK can finish loading.</span>
          </div>
        )}

        {subscribed && (
          <div className="flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            <span>Saved to your account.</span>
          </div>
        )}
    </div>
  );
}
