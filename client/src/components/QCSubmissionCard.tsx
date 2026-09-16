import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StatusBadge from "@/components/StatusBadge";
import { getQCViewerImages } from "@/lib/qc-images";

type QCSubmission = {
  id: number;
  jobId: string;
  accountNumber?: string;
  address: string;
  onsiteImages?: string[] | null;
  status: string;
  tapImage?: string | null;
  groundBlockImage?: string | null;
  bondingImage?: string | null;
  houseImage?: string | null;
  jobScreenshot?: string | null;
  supervisorComment?: string | null;
  createdAt?: string;
};

export default function QCSubmissionCard({ submission }: {
  submission: QCSubmission;
  isReviewMode?: boolean;
  isReadOnly?: boolean;
}) {
  const images = getQCViewerImages(submission);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-lg">Job: {submission.jobId}</CardTitle>
          <StatusBadge status={submission.status} />
        </div>
        <p className="text-sm text-muted-foreground">Account {submission.accountNumber || submission.address}</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {images.map(({ title, url }) => (
            <div key={title} className="space-y-1">
              <p className="text-xs font-medium">{title}</p>
              <img src={url} alt={title} className="h-24 w-full rounded-md object-cover" />
            </div>
          ))}
        </div>
        {submission.supervisorComment ? (
          <p className="mt-4 rounded-md bg-muted p-3 text-sm">{submission.supervisorComment}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
