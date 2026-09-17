import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import ProgressBar from "@/components/ProgressBar";
import StatusBadge from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import ImageViewer from "@/components/ImageViewer";
import { getOnsitePhotoItems } from "@/lib/qc-images";

type TechnicianProgress = {
  technician: {
    id: number;
    name: string;
    username: string;
    techId?: string;  // Adding techId as optional
    role?: string;
    oneSignalToken?: string | null;
  };
  submittedCount: number;
  requiredCount: number;
  status: string;
};

export default function Dashboard() {
  const { toast } = useToast();
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const [selectedImages, setSelectedImages] = useState<{ title: string; url: string }[]>([]);
  const [initialImageIndex, setInitialImageIndex] = useState(0);
  
  // Fetch current period
  const periodQuery = useQuery<any>({
    queryKey: ['/api/qc-periods/current'],
  });
  
  // Fetch technician progress
  const progressQuery = useQuery<TechnicianProgress[]>({
    queryKey: ['/api/technicians/progress'],
    enabled: !!periodQuery.data,
  });
  
  // Fetch pending QCs
  const pendingQCsQuery = useQuery<any[]>({
    queryKey: ['/api/qc-submissions/pending'],
  });
  
  // Fetch status icons
  const statusIconsQuery = useQuery<any[]>({
    queryKey: ['/api/status-icons'],
  });
  
  const getStatusIcon = (status: string) => {
    if (!statusIconsQuery.data) return null;
    return statusIconsQuery.data.find(icon => icon.name === status);
  };
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };
  
  // Function to open the image viewer
  function openImageViewer(qc: any, initialIndex: number) {
    const images = getOnsitePhotoItems(qc);
    setSelectedImages(images);
    setInitialImageIndex(initialIndex);
    setIsImageViewerOpen(true);
  }

  if (periodQuery.isLoading || progressQuery.isLoading || statusIconsQuery.isLoading) {
    return (
      <div className="admin-page">
        <h1 className="admin-title">Dashboard</h1>
        <div className="py-4">
          <div className="admin-panel">
            <div className="admin-panel-header">
              <Skeleton className="h-6 w-64 mb-2" />
              <Skeleton className="h-4 w-48" />
            </div>
            <ul className="divide-y divide-slate-100">
              {[1, 2, 3].map((i) => (
                <li key={i}>
                  <div className="px-5 py-5 sm:px-6">
                    <div className="flex items-center justify-between mb-3">
                      <Skeleton className="h-6 w-48" />
                      <Skeleton className="h-9 w-28 rounded-full" />
                    </div>
                    
                    <div className="admin-soft-panel">
                      <Skeleton className="h-7 w-36 mb-2" />
                      <Skeleton className="h-5 w-64 mb-6" />
                      
                      <div className="flex justify-between items-center mb-3">
                        <Skeleton className="h-5 w-48" />
                        <Skeleton className="h-5 w-12" />
                      </div>
                      
                      <Skeleton className="h-2.5 w-full rounded-full mb-4" />
                      <Skeleton className="h-8 w-32" />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }
  
  // Error handling
  if (periodQuery.error || progressQuery.error) {
    return (
      <div className="admin-page">
        <h1 className="admin-title">Dashboard</h1>
        <div className="py-4">
          <Card className="admin-panel">
            <CardContent className="pt-6">
              <p className="font-medium text-rose-600">Error loading data. Please try again later.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  
  // No active period
  if (!periodQuery.data) {
    return (
      <div className="admin-page">
        <h1 className="admin-title">Dashboard</h1>
        <div className="py-4">
          <Card className="admin-panel">
            <CardContent className="pt-6">
              <p className="mb-4 text-slate-700">No active QC period found.</p>
              <Link href="/supervisor/periods">
                <Button className="admin-primary-button mt-2">
                  Create QC Period
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <h1 className="admin-title">Dashboard</h1>
      <div className="py-4">
        
        <div className="admin-panel">
          <div className="admin-panel-header">
            <h3 className="admin-section-title">
              QC Period: {formatDate(periodQuery.data.startDate)} - {formatDate(periodQuery.data.endDate)}
            </h3>
            <p className="admin-subtitle max-w-2xl">
              Required QCs per technician: {periodQuery.data.requiredQCs}
            </p>
          </div>
          
          {progressQuery.data && progressQuery.data.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {progressQuery.data.map((tech) => (
                <li key={tech.technician.id}>
                  <div className="px-5 py-5 sm:px-6">
                    {/* Tech info header with name */}
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h4 className="text-lg font-semibold text-slate-950">
                        {tech.technician.name} {tech.technician.techId && <span className="text-slate-500">({tech.technician.techId})</span>}
                      </h4>
                      <Link href={`/supervisor/technician/${tech.technician.id}`}>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="admin-secondary-button px-5"
                        >
                          View QCs
                        </Button>
                      </Link>
                    </div>
                    
                    {/* Card for progress data - styled similar to the design */}
                    <div className="admin-soft-panel">
                      <h3 className="mb-1 text-2xl font-semibold text-slate-950">Progress</h3>
                      <p className="mb-6 text-sm text-slate-500">
                        QC Period: {formatDate(periodQuery.data.startDate)} - {formatDate(periodQuery.data.endDate)}
                      </p>
                      
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-base font-medium text-slate-700">
                          Progress: {tech.submittedCount} of {tech.requiredCount} QCs approved
                        </span>
                        <span className="text-lg font-semibold text-teal-700">
                          {Math.round((tech.submittedCount / tech.requiredCount) * 100)}%
                        </span>
                      </div>
                      
                      <ProgressBar 
                        value={(tech.submittedCount / tech.requiredCount) * 100} 
                        status={tech.status}
                      />
                      
                      <div className="mt-5 flex items-center space-x-2">
                        <StatusBadge
                          status={tech.status}
                          statusIcon={getStatusIcon(tech.status)}
                        />
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-5 py-8 text-center">
              <p className="font-medium text-slate-700">No technicians found</p>
              <p className="mt-1 text-sm text-slate-500">Technicians will appear here once they register in the system</p>
            </div>
          )}
        </div>

        {/* QC Review Section */}
        <div className="admin-panel mt-8">
          <div className="admin-panel-header">
            <h3 className="admin-section-title">
              Pending QC Reviews
            </h3>
            <p className="admin-subtitle max-w-2xl">
              Review and approve technician QC submissions
            </p>
          </div>
          
          {pendingQCsQuery.isLoading ? (
            <div className="px-5 py-8">
              <div className="space-y-6">
                <div>
                  <Skeleton className="h-6 w-48 mb-2" />
                  <Skeleton className="h-4 w-72 mb-2" />
                  <Skeleton className="h-4 w-56" />
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mt-5">
                  <Skeleton className="h-24 w-full rounded-lg" />
                  <Skeleton className="h-24 w-full rounded-lg" />
                  <Skeleton className="h-24 w-full rounded-lg hidden sm:block" />
                  <Skeleton className="h-24 w-full rounded-lg hidden sm:block" />
                </div>
                <Skeleton className="h-10 w-full rounded-md mt-2" />
              </div>
            </div>
          ) : pendingQCsQuery.data && pendingQCsQuery.data.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {pendingQCsQuery.data.slice(0, 2).map((qc) => (
                <li key={qc.id}>
                  <div className="px-5 py-5 sm:px-6">
                    <div>
                      <div>
                        <h4 className="truncate text-base font-semibold text-slate-950">
                          Job #{qc.jobId} - {(() => {
                            const technician = progressQuery.data?.find(t => t.technician.id === qc.technicianId)?.technician;
                            return technician ? 
                              `${technician.name} ${technician.techId ? `(${technician.techId})` : ''}` : 
                              'Unknown';
                          })()}
                        </h4>
                        <p className="mt-1 text-sm text-slate-600">Account #{qc.accountNumber || qc.address}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Submitted on {new Date(qc.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      
                      <div className="mt-4 flex justify-center space-x-4">
                        <Link href="/supervisor/review">
                          <Button size="default" className="admin-success-button px-6">
                            Approve
                          </Button>
                        </Link>
                        <Link href="/supervisor/review">
                          <Button size="default" variant="outline" className="rounded-2xl border-rose-200 bg-white px-6 font-semibold text-rose-600 hover:bg-rose-50">
                            Decline
                          </Button>
                        </Link>
                      </div>
                    </div>
                    
                    <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
                      {getOnsitePhotoItems(qc).map((image, index) => (
                        <div key={image.title}>
                          <p className="mb-1 text-xs font-semibold text-slate-500">{image.title}</p>
                          <div
                            className="admin-thumb relative h-24 w-full cursor-pointer hover:opacity-90"
                            onClick={() => openImageViewer(qc, index)}
                          >
                            <img src={image.url} alt={image.title} className="h-full w-full object-cover" />
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <Link href="/supervisor/review">
                      <Button 
                        variant="outline"
                        size="sm" 
                        className="admin-secondary-button mt-5 w-full"
                      >
                        Go to QC Review Page
                      </Button>
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-5 py-8 text-center">
              <p className="font-medium text-slate-700">No pending QCs to review</p>
              <p className="mt-1 text-sm text-slate-500">New QC submissions will appear here for your review</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Image Viewer Modal */}
      <ImageViewer
        isOpen={isImageViewerOpen}
        onClose={() => setIsImageViewerOpen(false)}
        images={selectedImages}
        initialIndex={initialImageIndex}
      />
    </div>
  );
}
