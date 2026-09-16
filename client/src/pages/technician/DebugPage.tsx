import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import OneSignalStatus from "@/components/notifications/OneSignalStatus";

export default function DebugPage() {
  return (
    <div className="container mx-auto max-w-3xl p-6">
      <Card>
        <CardHeader>
          <CardTitle>Debug</CardTitle>
        </CardHeader>
        <CardContent>
          <OneSignalStatus />
        </CardContent>
      </Card>
    </div>
  );
}
