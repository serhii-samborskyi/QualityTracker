import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitQC, getTechnicianProgress, getTechnicianQCSubmissions } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import StatusBadge from "@/components/StatusBadge";

export default function TechnicianDashboard() {
  const [jobId, setJobId] = useState("");
  const [address, setAddress] = useState("");
  const [isApartment, setIsApartment] = useState(false);
  const [files, setFiles] = useState<Record<string, File | null>>({});

  const progressQuery = useQuery({
    queryKey: ["/api/technicians/my-progress"],
    queryFn: getTechnicianProgress,
  });

  const submissionsQuery = useQuery({
    queryKey: ["/api/qc-submissions/technician"],
    queryFn: getTechnicianQCSubmissions,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("jobId", jobId);
      formData.append("address", address);
      formData.append("isApartment", String(isApartment));
      Object.entries(files).forEach(([key, file]) => {
        if (file) formData.append(key, file);
      });
      return submitQC(formData);
    },
    onSuccess: () => {
      setJobId("");
      setAddress("");
      setFiles({});
      queryClient.invalidateQueries({ queryKey: ["/api/qc-submissions/technician"] });
      queryClient.invalidateQueries({ queryKey: ["/api/technicians/my-progress"] });
    },
  });

  const fileInput = (name: string, label: string, required = true) => (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}{required ? "" : " (optional)"}</Label>
      <Input id={name} type="file" accept="image/*" onChange={(event) => setFiles((current) => ({ ...current, [name]: event.target.files?.[0] ?? null }))} />
    </div>
  );

  return (
    <div className="container mx-auto max-w-5xl p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>My QC Progress</CardTitle>
          <CardDescription>Approved submissions in the current QC period.</CardDescription>
        </CardHeader>
        <CardContent>
          {progressQuery.data ? (
            <div className="flex items-center justify-between rounded-md border p-4">
              <div>
                <p className="text-2xl font-semibold">{progressQuery.data.submittedCount} / {progressQuery.data.requiredCount}</p>
                <p className="text-sm text-muted-foreground">Approved QCs</p>
              </div>
              <StatusBadge status={progressQuery.data.status} statusIcon={progressQuery.data.statusIcon} />
            </div>
          ) : <p>No active QC period found.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Submit QC</CardTitle>
          <CardDescription>Upload images for supervisor review.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="jobId">Job ID</Label>
              <Input id="jobId" value={jobId} onChange={(event) => setJobId(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" value={address} onChange={(event) => setAddress(event.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isApartment} onChange={(event) => setIsApartment(event.target.checked)} />
            Apartment install
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            {fileInput("tapImage", "Tap image")}
            {fileInput("houseImage", "House image")}
            {fileInput("jobScreenshot", "Job screenshot")}
            {fileInput("groundBlockImage", "Ground block image", !isApartment)}
            {fileInput("bondingImage", "Bonding image", !isApartment)}
          </div>
          <Button disabled={!jobId || !address || submitMutation.isPending} onClick={() => submitMutation.mutate()}>
            {submitMutation.isPending ? "Submitting..." : "Submit QC"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent submissions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(submissionsQuery.data ?? []).map((submission: any) => (
            <div key={submission.id} className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="font-medium">Job {submission.jobId}</p>
                <p className="text-sm text-muted-foreground">{submission.address}</p>
              </div>
              <StatusBadge status={submission.status} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
