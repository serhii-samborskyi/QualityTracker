import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronRight,
  Calendar,
  Check,
  X,
  Clock,
  ArrowRight,
  FileText
} from "lucide-react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDate } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import QCSubmissionCard from "@/components/QCSubmissionCard";
// Using shared schema types directly since this is a simple component
type QCPeriod = {
  id: number;
  startDate: string;
  endDate: string;
  createdById: number;
  requiredQCs: number;
  isActive: boolean;
  isArchived: boolean;
  createdAt: string;
};

type QCSubmission = {
  id: number;
  technicianId: number;
  periodId: number;
  jobId: string;
  accountNumber?: string;
  address: string;
  status: string;
  supervisorComment?: string;
  reviewedAt?: string;
  tapImage: string;
  groundBlockImage: string;
  bondingImage: string;
  houseImage: string;
  jobScreenshot: string;
  createdAt: string;
  technician?: {
    id: number;
    name: string;
    username: string;
  };
};

// Archive page for reviewing past QC periods
export default function Archive() {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null);
  
  // Get archived QC periods
  const { 
    data: archivedPeriods = [],
    isLoading: isLoadingPeriods 
  } = useQuery<QCPeriod[]>({
    queryKey: ['/api/qc-periods/archived'],
    staleTime: 60 * 1000
  });
  
  // Get submissions for a selected period
  const {
    data: periodSubmissions = [],
    isLoading: isLoadingSubmissions,
    refetch: refetchPeriodSubmissions
  } = useQuery<QCSubmission[]>({
    queryKey: ['/api/qc-periods', selectedPeriodId, 'submissions'],
    queryFn: async ({ queryKey }) => {
      const [_, periodId] = queryKey;
      if (!periodId) return [];
      
      const response = await fetch(`/api/qc-periods/${periodId}/submissions`);
      if (!response.ok) {
        throw new Error('Failed to fetch submissions for period');
      }
      return response.json();
    },
    enabled: !!selectedPeriodId,
    staleTime: 60 * 1000
  });
  
  // Calculate period stats
  const calculatePeriodStats = (submissions: QCSubmission[] = []) => {
    const total = submissions.length;
    const approved = submissions.filter(s => s.status === 'approved').length;
    const declined = submissions.filter(s => s.status === 'declined').length;
    const pending = submissions.filter(s => s.status === 'pending').length;
    
    return { total, approved, declined, pending };
  };
  
  // Format date range
  const formatDateRange = (startDate: string, endDate: string) => {
    return `${formatDate(new Date(startDate))} - ${formatDate(new Date(endDate))}`;
  };
  
  // Handle period selection
  const handlePeriodSelect = (periodId: number) => {
    setSelectedPeriodId(periodId);
  };
  
  const stats = calculatePeriodStats(periodSubmissions);
  
  const selectedPeriod = archivedPeriods?.find(p => p.id === selectedPeriodId);
  
  if (isLoadingPeriods) {
    return (
      <div className="container flex items-center justify-center h-[80vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!archivedPeriods || archivedPeriods.length === 0) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center mb-6">
          <h1 className="text-2xl font-bold text-center text-primary">Archive</h1>
        </div>
        
        <Card className="w-full">
          <CardHeader>
            <CardTitle>No Archived Periods</CardTitle>
            <CardDescription>
              There are no archived QC periods available for review.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center py-12">
            <Calendar className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-60" />
            <p className="text-muted-foreground">
              Archived periods will appear here once they've been marked as archived.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex items-center mb-6">
        <h1 className="text-2xl font-bold text-primary">Archive</h1>
      </div>
      
      <div className={`grid ${isMobile ? 'grid-cols-1 gap-6' : 'grid-cols-3 gap-6'}`}>
        {/* Periods List */}
        <div className={isMobile ? 'col-span-1' : 'col-span-1'}>
          <Card>
            <CardHeader>
              <CardTitle>Archived Periods</CardTitle>
              <CardDescription>
                Select a period to view submissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[60vh]">
                <div className="space-y-3">
                  {archivedPeriods.map((period) => (
                    <Card 
                      key={period.id}
                      className={`cursor-pointer hover:bg-muted/50 transition-colors ${
                        selectedPeriodId === period.id ? 'bg-muted/80 border-primary/50' : ''
                      }`}
                      onClick={() => handlePeriodSelect(period.id)}
                    >
                      <CardHeader className="p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-sm font-medium">
                              {formatDateRange(period.startDate, period.endDate)}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Required QCs: {period.requiredQCs}
                            </p>
                          </div>
                          <ChevronRight className={`h-5 w-5 text-primary transition-transform ${
                            selectedPeriodId === period.id ? 'rotate-90' : ''
                          }`} />
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
        
        {/* Period Details & Submissions */}
        <div className={isMobile ? 'col-span-1' : 'col-span-2'}>
          {selectedPeriod ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  Period: {formatDateRange(selectedPeriod.startDate, selectedPeriod.endDate)}
                </CardTitle>
                <CardDescription>
                  Required QCs: {selectedPeriod.requiredQCs}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4 mb-6">
                  <div className="col-span-1 bg-blue-100 dark:bg-blue-900/30 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold">{stats.total}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                  <div className="col-span-1 bg-green-100 dark:bg-green-900/30 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.approved}</p>
                    <p className="text-xs text-muted-foreground">Approved</p>
                  </div>
                  <div className="col-span-1 bg-red-100 dark:bg-red-900/30 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.declined}</p>
                    <p className="text-xs text-muted-foreground">Declined</p>
                  </div>
                  <div className="col-span-1 bg-amber-100 dark:bg-amber-900/30 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.pending}</p>
                    <p className="text-xs text-muted-foreground">Pending</p>
                  </div>
                </div>
                
                <div className="mt-6">
                  <Tabs defaultValue="all">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="all">All</TabsTrigger>
                      <TabsTrigger value="approved">Approved</TabsTrigger>
                      <TabsTrigger value="declined">Declined</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="all">
                      <ScrollArea className="h-[50vh] mt-2">
                        {isLoadingSubmissions ? (
                          <div className="flex justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                          </div>
                        ) : !periodSubmissions || periodSubmissions.length === 0 ? (
                          <div className="text-center py-12">
                            <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-60" />
                            <p className="text-muted-foreground">No submissions found for this period</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {periodSubmissions.map((submission) => (
                              <QCSubmissionCard 
                                key={submission.id}
                                submission={submission}
                                isReviewMode={false}
                                isReadOnly={true}
                              />
                            ))}
                          </div>
                        )}
                      </ScrollArea>
                    </TabsContent>
                    
                    <TabsContent value="approved">
                      <ScrollArea className="h-[50vh] mt-2">
                        {isLoadingSubmissions ? (
                          <div className="flex justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                          </div>
                        ) : !periodSubmissions || periodSubmissions.filter(s => s.status === 'approved').length === 0 ? (
                          <div className="text-center py-12">
                            <Check className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-60" />
                            <p className="text-muted-foreground">No approved submissions found</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {periodSubmissions
                              .filter(s => s.status === 'approved')
                              .map((submission) => (
                                <QCSubmissionCard 
                                  key={submission.id}
                                  submission={submission}
                                  isReviewMode={false}
                                  isReadOnly={true}
                                />
                              ))}
                          </div>
                        )}
                      </ScrollArea>
                    </TabsContent>
                    
                    <TabsContent value="declined">
                      <ScrollArea className="h-[50vh] mt-2">
                        {isLoadingSubmissions ? (
                          <div className="flex justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                          </div>
                        ) : !periodSubmissions || periodSubmissions.filter(s => s.status === 'declined').length === 0 ? (
                          <div className="text-center py-12">
                            <X className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-60" />
                            <p className="text-muted-foreground">No declined submissions found</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {periodSubmissions
                              .filter(s => s.status === 'declined')
                              .map((submission) => (
                                <QCSubmissionCard 
                                  key={submission.id}
                                  submission={submission}
                                  isReviewMode={false}
                                  isReadOnly={true}
                                />
                              ))}
                          </div>
                        )}
                      </ScrollArea>
                    </TabsContent>
                  </Tabs>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Select a Period</CardTitle>
                <CardDescription>
                  Choose an archived period from the left to view its details
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center py-12">
                <Calendar className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-60" />
                <p className="text-muted-foreground">
                  Period details and submissions will appear here
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
