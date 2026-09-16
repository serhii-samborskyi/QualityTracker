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
  function openImageViewer(qc: any, initialType: string) {
    console.log("Opening image viewer", qc, initialType);
    
    // Create an array of images from the QC submission
    const images = [
      { title: 'Tap', url: qc.tapImage },
      { title: 'Ground Block', url: qc.groundBlockImage },
      { title: 'Bonding to Meter', url: qc.bondingImage },
      { title: 'House', url: qc.houseImage }
    ];
    
    // Set the initial image index based on which thumbnail was clicked
    let initialIndex = 0;
    switch (initialType) {
      case 'tap':
        initialIndex = 0;
        break;
      case 'groundBlock':
        initialIndex = 1;
        break;
      case 'bonding':
        initialIndex = 2;
        break;
      case 'house':
        initialIndex = 3;
        break;
      default:
        initialIndex = 0;
    }
    
    console.log("Setting images:", images);
    setSelectedImages(images);
    setInitialImageIndex(initialIndex);
    setIsImageViewerOpen(true);
    console.log("Image viewer should be open now");
  }

  if (periodQuery.isLoading || progressQuery.isLoading || statusIconsQuery.isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <h1 className="text-3xl font-semibold text-gray-800">Dashboard</h1>
        <div className="py-4">
          <div className="bg-white shadow-md overflow-hidden rounded-xl border border-gray-100">
            <div className="px-5 py-5 border-b border-gray-200 sm:px-6">
              <Skeleton className="h-6 w-64 mb-2" />
              <Skeleton className="h-4 w-48" />
            </div>
            <ul className="divide-y divide-gray-200">
              {[1, 2, 3].map((i) => (
                <li key={i}>
                  <div className="px-5 py-5 sm:px-6">
                    <div className="flex items-center justify-between mb-3">
                      <Skeleton className="h-6 w-48" />
                      <Skeleton className="h-9 w-28 rounded-full" />
                    </div>
                    
                    <div className="bg-gray-900 rounded-xl p-6">
                      <Skeleton className="h-7 w-36 mb-2 bg-gray-800" />
                      <Skeleton className="h-5 w-64 mb-6 bg-gray-800" />
                      
                      <div className="flex justify-between items-center mb-3">
                        <Skeleton className="h-5 w-48 bg-gray-800" />
                        <Skeleton className="h-5 w-12 bg-gray-800" />
                      </div>
                      
                      <Skeleton className="h-2.5 w-full rounded-full mb-4 bg-gray-800" />
                      <Skeleton className="h-8 w-32 bg-gray-800" />
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <h1 className="text-3xl font-semibold text-gray-800">Dashboard</h1>
        <div className="py-4">
          <Card className="shadow-md rounded-xl border border-gray-100">
            <CardContent className="pt-6">
              <p className="text-red-500 font-medium">Error loading data. Please try again later.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  
  // No active period
  if (!periodQuery.data) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <h1 className="text-3xl font-semibold text-gray-800">Dashboard</h1>
        <div className="py-4">
          <Card className="shadow-md rounded-xl border border-gray-100">
            <CardContent className="pt-6">
              <p className="text-gray-700 mb-4">No active QC period found.</p>
              <Link href="/supervisor/periods">
                <Button className="mt-2 border border-[#4e7ac7] bg-[#4e7ac7] hover:bg-blue-700 text-white font-medium rounded-md">
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
      <h1 className="text-3xl font-semibold text-gray-800">Dashboard</h1>
      <div className="py-4">
        
        <div className="bg-white shadow-md overflow-hidden rounded-xl border border-gray-100">
          <div className="px-5 py-5 border-b border-gray-200 sm:px-6">
            <h3 className="text-xl leading-6 font-medium text-gray-800">
              QC Period: {formatDate(periodQuery.data.startDate)} - {formatDate(periodQuery.data.endDate)}
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-600">
              Required QCs per technician: {periodQuery.data.requiredQCs}
            </p>
          </div>
          
          {progressQuery.data && progressQuery.data.length > 0 ? (
            <ul className="divide-y divide-gray-200">
              {progressQuery.data.map((tech) => (
                <li key={tech.technician.id}>
                  <div className="px-5 py-5 sm:px-6">
                    {/* Tech info header with name */}
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-lg font-semibold text-gray-800">
                        {tech.technician.name} {tech.technician.techId && <span className="text-gray-500">({tech.technician.techId})</span>}
                      </h4>
                      <Link href={`/supervisor/technician/${tech.technician.id}`}>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="border border-[#4e7ac7] text-[#4e7ac7] bg-white hover:bg-blue-50 rounded-full px-6 py-2 font-medium text-sm"
                        >
                          View QCs
                        </Button>
                      </Link>
                    </div>
                    
                    {/* Card for progress data - styled similar to the design */}
                    <div className="bg-gray-900 rounded-xl p-6 text-white">
                      <h3 className="text-2xl font-semibold mb-1">Progress</h3>
                      <p className="text-gray-300 mb-6">
                        QC Period: {formatDate(periodQuery.data.startDate)} - {formatDate(periodQuery.data.endDate)}
                      </p>
                      
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-lg text-gray-200">
                          Progress: {tech.submittedCount} of {tech.requiredCount} QCs approved
                        </span>
                        <span className="text-lg font-medium text-white">
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
              <p className="text-gray-600 font-medium">No technicians found</p>
              <p className="text-gray-500 text-sm mt-1">Technicians will appear here once they register in the system</p>
            </div>
          )}
        </div>

        {/* QC Review Section */}
        <div className="mt-8 bg-white shadow-md overflow-hidden rounded-xl border border-gray-100">
          <div className="px-5 py-5 border-b border-gray-200 sm:px-6">
            <h3 className="text-xl leading-6 font-medium text-gray-800">
              Pending QC Reviews
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-600">
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
            <ul className="divide-y divide-gray-200">
              {pendingQCsQuery.data.slice(0, 2).map((qc) => (
                <li key={qc.id}>
                  <div className="px-5 py-5 sm:px-6">
                    <div>
                      <div>
                        <h4 className="text-base font-medium text-gray-800 truncate">
                          Job #{qc.jobId} - {(() => {
                            const technician = progressQuery.data?.find(t => t.technician.id === qc.technicianId)?.technician;
                            return technician ? 
                              `${technician.name} ${technician.techId ? `(${technician.techId})` : ''}` : 
                              'Unknown';
                          })()}
                        </h4>
                        <p className="mt-1 text-sm text-gray-600">{qc.address}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          Submitted on {new Date(qc.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      
                      <div className="mt-4 flex justify-center space-x-4">
                        <Link href="/supervisor/review">
                          <Button size="default" className="bg-green-600 hover:bg-green-700 px-6 py-2 font-medium">
                            Approve
                          </Button>
                        </Link>
                        <Link href="/supervisor/review">
                          <Button size="default" variant="outline" className="border-red-500 text-red-500 hover:bg-red-50 px-6 py-2 font-medium">
                            Decline
                          </Button>
                        </Link>
                      </div>
                    </div>
                    
                    <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
                      <div>
                        <p className="text-xs font-medium text-gray-600 mb-1">Tap</p>
                        <div 
                          className="h-24 w-full rounded-lg bg-gray-100 relative overflow-hidden shadow-sm border border-gray-200 cursor-pointer transition-all duration-200 hover:shadow-md hover:opacity-90"
                          onClick={() => openImageViewer(qc, 'tap')}
                        >
                          <img src={qc.tapImage} alt="Tap" className="h-full w-full object-cover" />
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-600 mb-1">Ground Block</p>
                        <div 
                          className="h-24 w-full rounded-lg bg-gray-100 relative overflow-hidden shadow-sm border border-gray-200 cursor-pointer transition-all duration-200 hover:shadow-md hover:opacity-90"
                          onClick={() => openImageViewer(qc, 'groundBlock')}
                        >
                          <img src={qc.groundBlockImage} alt="Ground Block" className="h-full w-full object-cover" />
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-600 mb-1">Bonding to Meter</p>
                        <div 
                          className="h-24 w-full rounded-lg bg-gray-100 relative overflow-hidden shadow-sm border border-gray-200 cursor-pointer transition-all duration-200 hover:shadow-md hover:opacity-90"
                          onClick={() => openImageViewer(qc, 'bonding')}
                        >
                          <img src={qc.bondingImage} alt="Bonding to Meter" className="h-full w-full object-cover" />
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-600 mb-1">House</p>
                        <div 
                          className="h-24 w-full rounded-lg bg-gray-100 relative overflow-hidden shadow-sm border border-gray-200 cursor-pointer transition-all duration-200 hover:shadow-md hover:opacity-90"
                          onClick={() => openImageViewer(qc, 'house')}
                        >
                          <img src={qc.houseImage} alt="House" className="h-full w-full object-cover" />
                        </div>
                      </div>
                    </div>
                    
                    <Link href="/supervisor/review">
                      <Button 
                        variant="outline"
                        size="sm" 
                        className="border border-[#4e7ac7] text-[#4e7ac7] hover:bg-blue-50 font-medium mt-5 w-full rounded-md"
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
              <p className="text-gray-600 font-medium">No pending QCs to review</p>
              <p className="text-gray-500 text-sm mt-1">New QC submissions will appear here for your review</p>
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
