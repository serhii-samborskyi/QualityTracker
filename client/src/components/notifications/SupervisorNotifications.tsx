import { useMutation } from "@tanstack/react-query";
import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { sendQCReminders } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function SupervisorNotifications() {
  const { toast } = useToast();
  const reminderMutation = useMutation({
    mutationFn: sendQCReminders,
    onSuccess: () => {
      toast({ title: "Reminders sent", description: "Technician reminders were queued." });
    },
    onError: () => {
      toast({ title: "Reminder failed", description: "Unable to send reminders.", variant: "destructive" });
    },
  });

  return (
    <div className="container mx-auto max-w-3xl p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellRing className="h-5 w-5" />
            Notifications
          </CardTitle>
          <CardDescription>Send QC reminders to technicians with push notifications enabled.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => reminderMutation.mutate()} disabled={reminderMutation.isPending}>
            {reminderMutation.isPending ? "Sending..." : "Send QC reminders"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
