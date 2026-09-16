import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import ImageViewer from "@/components/ImageViewer";
import { Search, X } from "lucide-react";

type QCSubmission = {
  id: number;
  technicianId: number;
  periodId: number;
  jobId: string;
  accountNumber?: string;
  address: string;
  tapImage: string;
  groundBlockImage: string;
  bondingImage: string;
  houseImage: string;
  jobScreenshot: string;
  status: string;
  supervisorComment: string | null;
  createdAt: string;
};

type ReviewData = {
  qcId: number;
  status: "approved" | "declined";
  comment?: string;
};

export default function QCReview() {
  const { toast } = useToast();
  const [comments, setComments] = useState<Record<number, string>>({});
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const [selectedImages, setSelectedImages] = useState<{ title: string; url: string }[]>([]);
  const [initialImageIndex, setInitialImageIndex] = useState(0);
  
  // Search functionality
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Fetch pending QC submissions
  const pendingQCsQuery = useQuery<QCSubmission[]>({
    queryKey: ['/api/qc-submissions/pending'],
  });
  
  // Fetch technicians for displaying names
  const techniciansQuery = useQuery<any>({
    queryKey: ['/api/technicians/progress'],
  });
  
  // Review mutation
  const reviewMutation = useMutation({
    mutationFn: async (data: ReviewData) => {
      const response = await apiRequest("POST", "/api/qc-submissions/review", data);
      const result = await response.json();
      return result;
    },
    onSuccess: (data) => {
      // Invalidate pending submissions
      queryClient.invalidateQueries({ queryKey: ['/api/qc-submissions/pending'] });
      
      // Invalidate technician progress data
      queryClient.invalidateQueries({ queryKey: ['/api/technicians/progress'] });
      
      // Invalidate the specific technician's submissions
      queryClient.invalidateQueries({ 
        queryKey: [`/api/qc-submissions/technician/${data.technicianId}`] 
      });
      
      // Invalidate all submissions for the current period
      if (data.periodId) {
        queryClient.invalidateQueries({ 
          queryKey: [`/api/qc-periods/${data.periodId}/submissions`] 
        });
      }
    },
  });
  
  const handleComment = (qcId: number, comment: string) => {
    setComments((prev) => ({ ...prev, [qcId]: comment }));
  };
  
  const handleReview = (qcId: number, status: "approved" | "declined") => {
    const comment = comments[qcId] || undefined;
    
    reviewMutation.mutate(
      { qcId, status, comment },
      {
        onSuccess: () => {
          toast({
            title: `QC ${status === "approved" ? "Approved" : "Declined"}`,
            description: `The QC submission has been ${status === "approved" ? "approved" : "declined"}.`,
            variant: status === "approved" ? "default" : "destructive",
          });
          
          // Clear comment for this QC
          setComments((prev) => {
            const newComments = { ...prev };
            delete newComments[qcId];
            return newComments;
          });
        },
        onError: () => {
          toast({
            title: "Error",
            description: `Failed to ${status} the QC submission.`,
            variant: "destructive",
          });
        }
      }
    );
  };
  
  const getTechnicianName = (techId: number) => {
    if (!techniciansQuery.data) return "Unknown";
    const tech = techniciansQuery.data.find((t: any) => t.technician.id === techId);
    return tech ? tech.technician.name : "Unknown";
  };
  
  // Filter submissions based on search query
  const filteredSubmissions = useMemo(() => {
    if (!pendingQCsQuery.data || !searchQuery.trim()) {
      return pendingQCsQuery.data || [];
    }
    
    const query = searchQuery.toLowerCase().trim();
    
    return pendingQCsQuery.data.filter(qc => {
      const techName = getTechnicianName(qc.technicianId).toLowerCase();
      const techId = qc.technicianId.toString();
      const jobId = qc.jobId.toLowerCase();
      const accountNumber = (qc.accountNumber || qc.address).toLowerCase();
      
      return (
        techName.includes(query) || 
        techId.includes(query) || 
        jobId.includes(query) || 
        accountNumber.includes(query)
      );
    });
  }, [pendingQCsQuery.data, searchQuery, techniciansQuery.data]);
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };
  
  // Function to open the image viewer
  const openImageViewer = (qc: QCSubmission, initialType: string) => {
    // Create an array of images from the QC submission
    const images = [
      { title: 'Onsite photo 1', url: qc.tapImage },
      { title: 'Onsite photo 2', url: qc.groundBlockImage },
      { title: 'Onsite photo 3', url: qc.bondingImage },
      { title: 'Onsite photo 4', url: qc.houseImage },
      { title: 'Job Screenshot', url: qc.jobScreenshot }
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
      case 'jobScreenshot':
        initialIndex = 4;
        break;
      default:
        initialIndex = 0;
    }
    
    setSelectedImages(images);
    setInitialImageIndex(initialIndex);
    setIsImageViewerOpen(true);
  };

  if (pendingQCsQuery.isLoading || techniciansQuery.isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <h1 className="text-2xl font-semibold text-gray-900">QC Review</h1>
        <div className="py-4">
          <Card className="p-6">
            <Skeleton className="h-5 w-48 mb-2" />
            <Skeleton className="h-4 w-64 mb-6" />
            
            {[1, 2].map((i) => (
              <div key={i} className="mb-8">
                <div className="flex justify-between mb-4">
                  <div>
                    <Skeleton className="h-4 w-32 mb-1" />
                    <Skeleton className="h-3 w-48 mb-1" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                  <div className="flex space-x-2">
                    <Skeleton className="h-8 w-20" />
                    <Skeleton className="h-8 w-20" />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-4">
                  {[1, 2, 3, 4].map((j) => (
                    <div key={j}>
                      <Skeleton className="h-3 w-16 mb-1" />
                      <Skeleton className="h-24 w-full rounded" />
                    </div>
                  ))}
                </div>
                
                <Skeleton className="h-20 w-full" />
              </div>
            ))}
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
      <h1 className="text-2xl font-semibold text-gray-900">QC Review</h1>
      
      <div className="py-4">
        <Card className="bg-white shadow overflow-hidden">
          <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center">
                  Pending QC Reviews
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="ml-2 h-8 w-8 p-0 rounded-full"
                    onClick={() => setShowSearch(!showSearch)}
                  >
                    {showSearch ? <X size={18} /> : <Search size={18} />}
                  </Button>
                </h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">
                  Review and approve technician QC submissions
                </p>
              </div>
              
              {pendingQCsQuery.data && pendingQCsQuery.data.length > 0 && (
                <div className="text-sm text-gray-500 font-medium">
                  {pendingQCsQuery.data.length} {pendingQCsQuery.data.length === 1 ? 'submission' : 'submissions'} pending
                </div>
              )}
            </div>
            
            {showSearch && (
              <div className="mt-4 flex">
                <div className="relative flex-grow">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>
                  <Input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by tech name, job number, tech ID, or account number..."
                    className="pl-10 pr-4 py-2 w-full focus:ring-primary-500 focus:border-primary-500"
                    autoFocus
                  />
                </div>
                
                {searchQuery && (
                  <Button 
                    variant="ghost" 
                    className="ml-2 p-2" 
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear search"
                  >
                    <X size={16} />
                  </Button>
                )}
              </div>
            )}
          </div>
          
          {pendingQCsQuery.data && pendingQCsQuery.data.length > 0 ? (
            <>
              {/* Search results info */}
              {searchQuery && (
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                  <div className="text-sm text-gray-600">
                    {filteredSubmissions.length === 0 ? (
                      "No matching submissions found"
                    ) : filteredSubmissions.length === 1 ? (
                      "1 submission found"
                    ) : (
                      `${filteredSubmissions.length} submissions found`
                    )}
                    {searchQuery && <span className="font-medium"> for "{searchQuery}"</span>}
                  </div>
                </div>
              )}
              
              {filteredSubmissions.length > 0 ? (
                <ul className="divide-y divide-gray-200">
                  {filteredSubmissions.map((qc) => (
                    <li key={qc.id}>
                      <div className="px-4 py-4 sm:px-6">
                        <div>
                          <div>
                            <h4 className="text-sm font-medium text-blue-600 dark:text-blue-400 truncate">
                              Job #{qc.jobId} - {getTechnicianName(qc.technicianId)}
                            </h4>
                            <p className="mt-1 text-sm text-gray-500">Account #{qc.accountNumber || qc.address}</p>
                            <p className="mt-1 text-xs text-gray-500">
                              Submitted on {formatDate(qc.createdAt)}
                            </p>
                          </div>
                          <div className="mt-3 flex space-x-3">
                            <Button 
                              size="default"
                              className="bg-green-600 hover:bg-green-700 px-5 py-2 font-medium"
                              onClick={() => handleReview(qc.id, "approved")}
                              disabled={reviewMutation.isPending}
                            >
                              Approve
                            </Button>
                            <Button 
                              size="default"
                              variant="destructive"
                              className="px-5 py-2 font-medium"
                              onClick={() => handleReview(qc.id, "declined")}
                              disabled={reviewMutation.isPending}
                            >
                              Decline
                            </Button>
                          </div>
                        </div>
                        
                        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                          <div>
                            <p className="text-xs font-medium text-gray-500 mb-1">Onsite photo 1</p>
                            <div 
                              className="h-24 w-full rounded bg-gray-200 relative overflow-hidden cursor-pointer transition-all hover:shadow-md hover:opacity-90"
                              onClick={() => openImageViewer(qc, 'tap')}
                            >
                              <img src={qc.tapImage} alt="Onsite photo 1" className="h-full w-full object-cover" />
                            </div>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-gray-500 mb-1">Onsite photo 2</p>
                            <div 
                              className="h-24 w-full rounded bg-gray-200 relative overflow-hidden cursor-pointer transition-all hover:shadow-md hover:opacity-90"
                              onClick={() => openImageViewer(qc, 'groundBlock')}
                            >
                              <img src={qc.groundBlockImage} alt="Onsite photo 2" className="h-full w-full object-cover" />
                            </div>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-gray-500 mb-1">Onsite photo 3</p>
                            <div 
                              className="h-24 w-full rounded bg-gray-200 relative overflow-hidden cursor-pointer transition-all hover:shadow-md hover:opacity-90"
                              onClick={() => openImageViewer(qc, 'bonding')}
                            >
                              <img src={qc.bondingImage} alt="Onsite photo 3" className="h-full w-full object-cover" />
                            </div>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-gray-500 mb-1">Onsite photo 4</p>
                            <div 
                              className="h-24 w-full rounded bg-gray-200 relative overflow-hidden cursor-pointer transition-all hover:shadow-md hover:opacity-90"
                              onClick={() => openImageViewer(qc, 'house')}
                            >
                              <img src={qc.houseImage} alt="Onsite photo 4" className="h-full w-full object-cover" />
                            </div>
                          </div>
                        </div>
                        
                        <div className="mt-4">
                          <label htmlFor={`comment-${qc.id}`} className="block text-sm font-medium text-gray-700">Comment</label>
                          <div className="mt-1">
                            <Textarea
                              id={`comment-${qc.id}`}
                              rows={2}
                              value={comments[qc.id] || ""}
                              onChange={(e) => handleComment(qc.id, e.target.value)}
                              className="shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md"
                              placeholder="Add a comment (required for declining)"
                              disabled={reviewMutation.isPending}
                            />
                          </div>
                        </div>
                        
                        <div className="mt-2">
                          <p className="text-xs font-medium text-gray-500 mb-1">Job Screenshot</p>
                          <div 
                            className="mt-1 h-36 w-full rounded bg-gray-100 relative overflow-hidden cursor-pointer transition-all hover:shadow-md hover:opacity-90"
                            onClick={() => openImageViewer(qc, 'jobScreenshot')}
                          >
                            <img 
                              src={qc.jobScreenshot} 
                              alt="Job Screenshot" 
                              className="h-full w-full object-contain"
                            />
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-4 py-6 text-center text-gray-500">
                  No matching QCs found for your search
                </div>
              )}
            </>
          ) : (
            <div className="px-4 py-6 text-center text-gray-500">
              No pending QCs to review
            </div>
          )}
        </Card>
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
