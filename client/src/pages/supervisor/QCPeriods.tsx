import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type QCPeriod = {
  id: number;
  startDate: string;
  endDate: string;
  requiredQCs: number;
  isActive: boolean;
  isArchived: boolean;
};

export default function QCPeriods() {
  const { toast } = useToast();
  const today = new Date();
  const nextMonth = new Date(today);
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  const [startDate, setStartDate] = useState(today.toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(nextMonth.toISOString().slice(0, 10));
  const [requiredQCs, setRequiredQCs] = useState(4);

  const { data: periods = [], isLoading } = useQuery<QCPeriod[]>({
    queryKey: ["/api/qc-periods"],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/qc-periods", {
        startDate,
        endDate,
        requiredQCs,
        isActive: true,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/qc-periods"] });
      queryClient.invalidateQueries({ queryKey: ["/api/qc-periods/current"] });
      toast({ title: "QC period created" });
    },
  });

  const setActiveMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("POST", `/api/qc-periods/${id}/set-active`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/qc-periods"] });
      queryClient.invalidateQueries({ queryKey: ["/api/qc-periods/current"] });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("POST", `/api/qc-periods/${id}/archive`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/qc-periods"] });
      queryClient.invalidateQueries({ queryKey: ["/api/qc-periods/archived"] });
    },
  });

  return (
    <div className="container mx-auto max-w-5xl p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">QC Periods</h1>
        <p className="text-muted-foreground">Create and manage technician QC review windows.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create active period</CardTitle>
          <CardDescription>The new period will be marked active for incoming QC submissions.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="startDate">Start date</Label>
            <Input id="startDate" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endDate">End date</Label>
            <Input id="endDate" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="requiredQCs">Required QCs</Label>
            <Input id="requiredQCs" type="number" min={1} value={requiredQCs} onChange={(event) => setRequiredQCs(Number(event.target.value))} />
          </div>
          <div className="flex items-end">
            <Button className="w-full" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create period"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing periods</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? <p>Loading periods...</p> : null}
          {periods.map((period) => (
            <div key={period.id} className="flex flex-col gap-3 rounded-md border p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{formatDate(new Date(period.startDate))} - {formatDate(new Date(period.endDate))}</p>
                  {period.isActive ? <Badge>Active</Badge> : null}
                  {period.isArchived ? <Badge variant="outline">Archived</Badge> : null}
                </div>
                <p className="text-sm text-muted-foreground">Required QCs: {period.requiredQCs}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={period.isArchived || period.isActive} onClick={() => setActiveMutation.mutate(period.id)}>
                  Set active
                </Button>
                <Button variant="outline" size="sm" disabled={period.isArchived} onClick={() => archiveMutation.mutate(period.id)}>
                  Archive
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
