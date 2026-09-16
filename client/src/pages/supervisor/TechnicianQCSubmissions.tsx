import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getTechnicianQCSubmissionsById } from "@/lib/api";
import { getTechnicians } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, Hash, FileCheck, AlertTriangle, Loader2, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import ImageViewer from "@/components/ImageViewer";

interface QCSubmission {
  id: number;
  technicianId: number;
  periodId: number;
  jobId: string;
  accountNumber?: string;
  address: string;
  status: string;
  tapImage: string;
  groundBlockImage: string;
  bondingImage: string;
  houseImage: string;
  jobScreenshot: string;
  supervisorComment: string | null;
  createdAt: string;
}

interface Technician {
  id: number;
  username: string;
  name: string;
  techId: string;
  role: string;
}

export default function TechnicianQCSubmissions() {
  const [, setLocation] = useLocation();
  const params = useParams<{ technicianId: string }>();
  const technicianId = parseInt(params.technicianId, 10);
  
  const [viewerOpen, setViewerOpen] = useState(false);
  const [currentImages, setCurrentImages] = useState<{ title: string; url: string }[]>([]);
  const [initialIndex, setInitialIndex] = useState(0);
  
  // Fetch technician details
  const { data: technicians } = useQuery<Technician[]>({
    queryKey: ["/api/technicians"],
    queryFn: getTechnicians,
  });
  
  const technician = technicians?.find(tech => tech.id === technicianId);
  
  // Fetch technician's QC submissions
  const { 
    data: submissions, 
    isLoading, 
    error 
  } = useQuery<QCSubmission[]>({
    queryKey: [`/api/qc-submissions/technician/${technicianId}`],
    queryFn: () => getTechnicianQCSubmissionsById(technicianId),
    enabled: !isNaN(technicianId),
  });
  
  // Group submissions by status
  const pendingSubmissions = submissions?.filter(sub => sub.status === 'pending') || [];
  const approvedSubmissions = submissions?.filter(sub => sub.status === 'approved') || [];
  const declinedSubmissions = submissions?.filter(sub => sub.status === 'declined') || [];
  
  // Function to view images for a submission
  const viewImages = (submission: QCSubmission, initialImageIndex: number = 0) => {
    const images = [
      { title: "Onsite photo 1", url: submission.tapImage },
      { title: "Onsite photo 2", url: submission.groundBlockImage },
      { title: "Onsite photo 3", url: submission.bondingImage },
      { title: "Onsite photo 4", url: submission.houseImage },
      { title: "Job Screenshot", url: submission.jobScreenshot },
    ];
    
    setCurrentImages(images);
    setInitialIndex(initialImageIndex);
    setViewerOpen(true);
  };
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Return to dashboard or previous screen
  const goBack = () => {
    setLocation("/supervisor");
  };
  
  if (isNaN(technicianId)) {
    return (
      <div className="container mx-auto py-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Invalid Technician ID</AlertTitle>
          <AlertDescription>
            The provided technician ID is invalid.
            <Button variant="outline" size="sm" className="mt-2" onClick={goBack}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Return to Dashboard
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  
  if (isLoading) {
    return (
      <div className="container mx-auto py-6 flex justify-center items-center min-h-[50vh]">
        <div className="flex flex-col items-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading QC submissions...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="container mx-auto py-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load QC submissions. Please try again later.
            <Button variant="outline" size="sm" className="mt-2" onClick={goBack}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Return to Dashboard
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      <div className="flex items-center mb-6">
        <Button variant="outline" size="sm" className="mr-4" onClick={goBack}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0A3D73]">
            {technician ? `${technician.name} (${technician.techId})` : 'Technician'} QC Submissions
          </h1>
          <p className="text-[#0A3D73]">
            {submissions?.length || 0} total submissions
          </p>
        </div>
      </div>
      
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">
            All ({submissions?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="pending">
            Pending ({pendingSubmissions.length})
          </TabsTrigger>
          <TabsTrigger value="approved">
            Approved ({approvedSubmissions.length})
          </TabsTrigger>
          <TabsTrigger value="declined">
            Declined ({declinedSubmissions.length})
          </TabsTrigger>
        </TabsList>
        
        {/* All Submissions */}
        <TabsContent value="all" className="mt-6">
          {submissions && submissions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {submissions.map((submission) => (
                <SubmissionCard 
                  key={submission.id} 
                  submission={submission} 
                  viewImages={viewImages} 
                  formatDate={formatDate}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <FileCheck className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">No QC Submissions</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                This technician hasn't submitted any QCs yet.
              </p>
            </div>
          )}
        </TabsContent>
        
        {/* Pending Submissions */}
        <TabsContent value="pending" className="mt-6">
          {pendingSubmissions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendingSubmissions.map((submission) => (
                <SubmissionCard 
                  key={submission.id} 
                  submission={submission} 
                  viewImages={viewImages} 
                  formatDate={formatDate}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <FileCheck className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">No Pending Submissions</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                There are no pending QC submissions to review.
              </p>
            </div>
          )}
        </TabsContent>
        
        {/* Approved Submissions */}
        <TabsContent value="approved" className="mt-6">
          {approvedSubmissions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {approvedSubmissions.map((submission) => (
                <SubmissionCard 
                  key={submission.id} 
                  submission={submission} 
                  viewImages={viewImages} 
                  formatDate={formatDate}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <FileCheck className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">No Approved Submissions</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                There are no approved QC submissions.
              </p>
            </div>
          )}
        </TabsContent>
        
        {/* Declined Submissions */}
        <TabsContent value="declined" className="mt-6">
          {declinedSubmissions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {declinedSubmissions.map((submission) => (
                <SubmissionCard 
                  key={submission.id} 
                  submission={submission} 
                  viewImages={viewImages} 
                  formatDate={formatDate}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <FileCheck className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">No Declined Submissions</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                There are no declined QC submissions.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
      
      {/* Image viewer modal */}
      <ImageViewer
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        images={currentImages}
        initialIndex={initialIndex}
      />
    </div>
  );
}

// Submission Card Component
function SubmissionCard({ 
  submission, 
  viewImages, 
  formatDate 
}: { 
  submission: QCSubmission; 
  viewImages: (submission: QCSubmission, initialImageIndex?: number) => void;
  formatDate: (dateString: string) => string;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2 px-6">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg font-semibold">Job: {submission.jobId}</CardTitle>
          <StatusBadge status={submission.status} />
        </div>
        <CardDescription className="flex items-center gap-1">
          <Hash className="h-3 w-3" />
          Account {submission.accountNumber || submission.address}
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-2 px-6">
        <div className="grid grid-cols-5 gap-1 mb-2">
          <div className="relative aspect-square bg-background rounded overflow-hidden cursor-pointer"
            onClick={() => viewImages(submission, 0)}>
            <img src={submission.tapImage} alt="Onsite photo 1" className="w-full h-full object-cover hover:opacity-90 transition" />
          </div>
          <div className="relative aspect-square bg-background rounded overflow-hidden cursor-pointer"
            onClick={() => viewImages(submission, 1)}>
            <img src={submission.groundBlockImage} alt="Onsite photo 2" className="w-full h-full object-cover hover:opacity-90 transition" />
          </div>
          <div className="relative aspect-square bg-background rounded overflow-hidden cursor-pointer"
            onClick={() => viewImages(submission, 2)}>
            <img src={submission.bondingImage} alt="Onsite photo 3" className="w-full h-full object-cover hover:opacity-90 transition" />
          </div>
          <div className="relative aspect-square bg-background rounded overflow-hidden cursor-pointer"
            onClick={() => viewImages(submission, 3)}>
            <img src={submission.houseImage} alt="Onsite photo 4" className="w-full h-full object-cover hover:opacity-90 transition" />
          </div>
          <div className="relative aspect-square bg-background rounded overflow-hidden cursor-pointer"
            onClick={() => viewImages(submission, 4)}>
            <img src={submission.jobScreenshot} alt="Job Screenshot" className="w-full h-full object-cover hover:opacity-90 transition" />
          </div>
        </div>
        
        {submission.supervisorComment && (
          <div className="bg-muted p-2 rounded text-sm mb-2">
            <p className="font-semibold">Supervisor Comment:</p>
            <p>{submission.supervisorComment}</p>
          </div>
        )}
        
        <div className="flex items-center text-xs text-muted-foreground mt-1">
          <Calendar className="h-3 w-3 mr-1" />
          <span>Submitted: {formatDate(submission.createdAt)}</span>
        </div>
      </CardContent>
      <CardFooter className="pt-0 px-6">
        <Button variant="outline" size="sm" className="w-full" onClick={() => viewImages(submission)}>
          <ExternalLink className="h-4 w-4 mr-2" />
          View Images
        </Button>
      </CardFooter>
    </Card>
  );
}

// Status Badge Component
function StatusBadge({ status }: { status: string }) {
  let variant: "default" | "secondary" | "destructive" | "outline" = "outline";
  let icon = null;
  
  switch (status) {
    case "approved":
      variant = "default";
      icon = <FileCheck className="h-3 w-3 mr-1" />;
      break;
    case "declined":
      variant = "destructive";
      icon = <AlertTriangle className="h-3 w-3 mr-1" />;
      break;
    default:
      variant = "secondary";
      break;
  }
  
  return (
    <Badge variant={variant} className="capitalize flex items-center">
      {icon}
      {status}
    </Badge>
  );
}
