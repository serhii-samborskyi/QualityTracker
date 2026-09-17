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
  onsiteImages?: string[] | null;
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
      <div className="admin-page flex h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!archivedPeriods || archivedPeriods.length === 0) {
    return (
      <div className="admin-page">
        <div className="admin-page-header">
          <div>
            <h1 className="admin-title">Archive</h1>
            <p className="admin-subtitle">Review past QC periods and historical submissions.</p>
          </div>
        </div>
        
        <Card className="admin-panel w-full">
          <CardHeader>
            <CardTitle className="text-slate-950">No Archived Periods</CardTitle>
            <CardDescription>
              There are no archived QC periods available for review.
            </CardDescription>
          </CardHeader>
          <CardContent className="py-12 text-center">
            <Calendar className="mx-auto mb-4 h-16 w-16 text-teal-600 opacity-70" />
            <p className="text-slate-500">
              Archived periods will appear here once they've been marked as archived.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-title">Archive</h1>
          <p className="admin-subtitle">Review past QC periods and historical submissions.</p>
        </div>
      </div>
      
      <div className={`grid ${isMobile ? 'grid-cols-1 gap-6' : 'grid-cols-3 gap-6'}`}>
        {/* Periods List */}
        <div className={isMobile ? 'col-span-1' : 'col-span-1'}>
          <Card className="admin-panel">
            <CardHeader>
              <CardTitle className="text-slate-950">Archived Periods</CardTitle>
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
                      className={`cursor-pointer border-slate-100 bg-white transition-colors hover:bg-teal-50/70 ${
                        selectedPeriodId === period.id ? 'border-teal-300 bg-teal-50 shadow-sm' : ''
                      }`}
                      onClick={() => handlePeriodSelect(period.id)}
                    >
                      <CardHeader className="p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-sm font-semibold text-slate-950">
                              {formatDateRange(period.startDate, period.endDate)}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              Required QCs: {period.requiredQCs}
                            </p>
                          </div>
                          <ChevronRight className={`h-5 w-5 text-teal-600 transition-transform ${
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
            <Card className="admin-panel">
              <CardHeader>
                <CardTitle className="text-slate-950">
                  Period: {formatDateRange(selectedPeriod.startDate, selectedPeriod.endDate)}
                </CardTitle>
                <CardDescription>
                  Required QCs: {selectedPeriod.requiredQCs}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="admin-stat">
                    <p className="text-2xl font-bold text-slate-950">{stats.total}</p>
                    <p className="text-xs text-slate-500">Total</p>
                  </div>
                  <div className="admin-stat bg-emerald-50">
                    <p className="text-2xl font-bold text-emerald-700">{stats.approved}</p>
                    <p className="text-xs text-emerald-700/70">Approved</p>
                  </div>
                  <div className="admin-stat bg-rose-50">
                    <p className="text-2xl font-bold text-rose-700">{stats.declined}</p>
                    <p className="text-xs text-rose-700/70">Declined</p>
                  </div>
                  <div className="admin-stat bg-amber-50">
                    <p className="text-2xl font-bold text-amber-700">{stats.pending}</p>
                    <p className="text-xs text-amber-700/70">Pending</p>
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
                            <FileText className="mx-auto mb-4 h-16 w-16 text-teal-600 opacity-70" />
                            <p className="text-slate-500">No submissions found for this period</p>
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
                            <Check className="mx-auto mb-4 h-16 w-16 text-emerald-600 opacity-70" />
                            <p className="text-slate-500">No approved submissions found</p>
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
                            <X className="mx-auto mb-4 h-16 w-16 text-rose-600 opacity-70" />
                            <p className="text-slate-500">No declined submissions found</p>
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
            <Card className="admin-panel">
              <CardHeader>
                <CardTitle className="text-slate-950">Select a Period</CardTitle>
                <CardDescription>
                  Choose an archived period from the left to view its details
                </CardDescription>
              </CardHeader>
              <CardContent className="py-12 text-center">
                <Calendar className="mx-auto mb-4 h-16 w-16 text-teal-600 opacity-70" />
                <p className="text-slate-500">
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
