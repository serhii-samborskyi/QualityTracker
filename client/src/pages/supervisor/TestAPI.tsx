import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

// Component to test the QC Images API
export default function TestAPI() {
  const { toast } = useToast();
  const [jobId, setJobId] = useState("JOB123");
  const [technicianId, setTechnicianId] = useState("2");
  const [isLoading, setIsLoading] = useState(false);
  const [apiResults, setApiResults] = useState<any>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  
  // Function to test the specific API endpoint
  const testQCImagesAPI = async () => {
    setIsLoading(true);
    setApiError(null);
    setApiResults(null);
    
    try {
      console.log(`Testing API with jobId=${jobId}, techId=${technicianId}`);
      
      const response = await fetch(`/api/qc-images/${jobId}/${technicianId}`, {
        credentials: "include",
        headers: {
          "Accept": "application/json"
        }
      });
      
      console.log("Response status:", response.status);
      
      const responseText = await response.text();
      console.log("Response text:", responseText);
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`Invalid JSON response: ${responseText}`);
      }
      
      setApiResults(data);
      toast({
        title: "API Test Successful",
        description: `Retrieved ${Object.keys(data).length} items`,
      });
    } catch (error) {
      console.error("API Test Error:", error);
      setApiError(error instanceof Error ? error.message : String(error));
      toast({
        title: "API Test Failed",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Function to test the test QC images API endpoint
  const testSimpleEndpoint = async () => {
    setIsLoading(true);
    setApiError(null);
    setApiResults(null);
    
    try {
      console.log("Testing simple API endpoint");
      
      const response = await fetch("/api/test-qc-images", {
        credentials: "include",
        headers: {
          "Accept": "application/json"
        }
      });
      
      console.log("Simple API Response status:", response.status);
      
      const responseText = await response.text();
      console.log("Simple API Response text:", responseText);
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`Invalid JSON response: ${responseText}`);
      }
      
      setApiResults(data);
      toast({
        title: "Simple API Test Successful",
        description: `Retrieved ${Object.keys(data).length} items`,
      });
    } catch (error) {
      console.error("Simple API Test Error:", error);
      setApiError(error instanceof Error ? error.message : String(error));
      toast({
        title: "Simple API Test Failed",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Function to get all submissions to find valid test data
  const getSubmissionsForTesting = async () => {
    setIsLoading(true);
    setApiError(null);
    
    try {
      console.log("Fetching all QC submissions for testing...");
      
      const response = await fetch("/api/qc-submissions", {
        credentials: "include",
        headers: {
          "Accept": "application/json"
        }
      });
      
      console.log("Submissions Response status:", response.status);
      
      if (!response.ok) {
        throw new Error(`Failed to get submissions: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log("Found submissions:", data);
      
      if (data.length > 0) {
        // Get the first submission as an example
        const firstSubmission = data[0];
        setJobId(firstSubmission.jobId);
        setTechnicianId(String(firstSubmission.technicianId));
        
        toast({
          title: "Found Test Data",
          description: `Using Job ID: ${firstSubmission.jobId}, Tech ID: ${firstSubmission.technicianId}`,
        });
      } else {
        toast({
          title: "No Test Data",
          description: "No submissions found to use for testing",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching submissions:", error);
      setApiError(error instanceof Error ? error.message : String(error));
      toast({
        title: "Error Fetching Test Data",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">API Testing Tool</h1>
      
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>API Testing</CardTitle>
            <CardDescription>
              Test the QC Images API endpoint with different parameters
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="jobId">Job ID</Label>
                  <Input
                    id="jobId"
                    value={jobId}
                    onChange={(e) => setJobId(e.target.value)}
                    placeholder="Enter Job ID"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="technicianId">Technician ID</Label>
                  <Input
                    id="technicianId"
                    value={technicianId}
                    onChange={(e) => setTechnicianId(e.target.value)}
                    placeholder="Enter Technician ID"
                  />
                </div>
              </div>
              
              <div className="flex justify-between mt-4">
                <Button 
                  variant="outline" 
                  onClick={getSubmissionsForTesting}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Finding Test Data...
                    </>
                  ) : "Find Test Data"}
                </Button>
                <div className="space-x-2">
                  <Button 
                    variant="outline" 
                    onClick={testSimpleEndpoint}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Testing...
                      </>
                    ) : "Test Simple API"}
                  </Button>
                  <Button 
                    onClick={testQCImagesAPI}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Testing...
                      </>
                    ) : "Test QC Images API"}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {apiError && (
          <Card className="border-red-500">
            <CardHeader>
              <CardTitle className="text-red-500">API Error</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-red-50 p-4 rounded-md text-red-800 overflow-auto whitespace-pre-wrap">
                {apiError}
              </pre>
            </CardContent>
          </Card>
        )}
        
        {apiResults && (
          <Card className="border-green-500">
            <CardHeader>
              <CardTitle className="text-green-500">API Results</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="json">
                  <AccordionTrigger>View JSON Response</AccordionTrigger>
                  <AccordionContent>
                    <pre className="bg-green-50 p-4 rounded-md text-green-800 overflow-auto whitespace-pre-wrap">
                      {JSON.stringify(apiResults, null, 2)}
                    </pre>
                  </AccordionContent>
                </AccordionItem>
                
                {apiResults.tapImage && (
                  <AccordionItem value="images">
                    <AccordionTrigger>View Images</AccordionTrigger>
                    <AccordionContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div>
                          <h3 className="text-lg font-semibold mb-2">Tap Image</h3>
                          <img 
                            src={apiResults.tapImage} 
                            alt="Tap" 
                            className="rounded-md border border-gray-200 max-h-64 object-contain"
                          />
                        </div>
                        
                        {apiResults.groundBlockImage && (
                          <div>
                            <h3 className="text-lg font-semibold mb-2">Ground Block Image</h3>
                            <img 
                              src={apiResults.groundBlockImage} 
                              alt="Ground Block" 
                              className="rounded-md border border-gray-200 max-h-64 object-contain"
                            />
                          </div>
                        )}
                        
                        {apiResults.bondingImage && (
                          <div>
                            <h3 className="text-lg font-semibold mb-2">Bonding Image</h3>
                            <img 
                              src={apiResults.bondingImage} 
                              alt="Bonding" 
                              className="rounded-md border border-gray-200 max-h-64 object-contain"
                            />
                          </div>
                        )}
                        
                        {apiResults.houseImage && (
                          <div>
                            <h3 className="text-lg font-semibold mb-2">House Image</h3>
                            <img 
                              src={apiResults.houseImage} 
                              alt="House" 
                              className="rounded-md border border-gray-200 max-h-64 object-contain"
                            />
                          </div>
                        )}
                        
                        {apiResults.jobScreenshot && (
                          <div>
                            <h3 className="text-lg font-semibold mb-2">Job Screenshot</h3>
                            <img 
                              src={apiResults.jobScreenshot} 
                              alt="Job Screenshot" 
                              className="rounded-md border border-gray-200 max-h-64 object-contain"
                            />
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}