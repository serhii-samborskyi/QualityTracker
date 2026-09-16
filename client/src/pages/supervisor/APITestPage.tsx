import { useState } from "react";
import { getQCImagesByJobAndTechnician, getTestQCImages } from "@/lib/api";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function APITestPage() {
  const { toast } = useToast();
  const [jobId, setJobId] = useState("");
  const [technicianId, setTechnicianId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTest = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setResult(null);
      
      if (!jobId || !technicianId) {
        setError("Both Job ID and Technician ID are required");
        return;
      }
      
      const techId = parseInt(technicianId, 10);
      if (isNaN(techId)) {
        setError("Technician ID must be a number");
        return;
      }
      
      const data = await getQCImagesByJobAndTechnician(jobId, techId);
      setResult(data);
      
      toast({
        title: "API Call Successful",
        description: `Retrieved images for Job ID: ${jobId}`,
      });
    } catch (err) {
      console.error("Error testing API:", err);
      setError(err instanceof Error ? err.message : String(err));
      
      toast({
        title: "API Call Failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestSimple = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setResult(null);
      
      const data = await getTestQCImages();
      setResult(data);
      
      toast({
        title: "API Call Successful",
        description: "Retrieved test QC images",
      });
    } catch (err) {
      console.error("Error testing API:", err);
      setError(err instanceof Error ? err.message : String(err));
      
      toast({
        title: "API Call Failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container py-6">
      <h1 className="text-3xl font-bold mb-6">API Test Page</h1>
      
      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Test QC Images API</CardTitle>
            <CardDescription>
              Test the API endpoint that retrieves QC images by Job ID and Technician ID
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4">
              <div className="grid grid-cols-1 gap-2">
                <Label htmlFor="jobId">Job ID</Label>
                <Input
                  id="jobId"
                  placeholder="Enter Job ID"
                  value={jobId}
                  onChange={(e) => setJobId(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 gap-2">
                <Label htmlFor="technicianId">Technician ID</Label>
                <Input
                  id="technicianId"
                  placeholder="Enter Technician ID"
                  value={technicianId}
                  onChange={(e) => setTechnicianId(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={handleTestSimple} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testing...
                </>
              ) : (
                "Test Simple API"
              )}
            </Button>
            <Button onClick={handleTest} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testing...
                </>
              ) : (
                "Test API"
              )}
            </Button>
          </CardFooter>
        </Card>
        
        {error && (
          <Card className="border-red-500">
            <CardHeader>
              <CardTitle className="text-red-500">Error</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-red-50 p-4 rounded-md text-red-800 overflow-auto whitespace-pre-wrap">
                {error}
              </pre>
            </CardContent>
          </Card>
        )}
        
        {result && (
          <Card className="border-green-500">
            <CardHeader>
              <CardTitle className="text-green-500">API Response</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-green-50 p-4 rounded-md text-green-800 overflow-auto whitespace-pre-wrap">
                {JSON.stringify(result, null, 2)}
              </pre>
              
              {/* Display images if they exist */}
              {result.tapImage && (
                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Tap Image</h3>
                    <img 
                      src={result.tapImage} 
                      alt="Tap" 
                      className="rounded-md border border-gray-200 max-h-64 object-contain"
                    />
                  </div>
                  
                  {result.groundBlockImage && (
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Ground Block Image</h3>
                      <img 
                        src={result.groundBlockImage} 
                        alt="Ground Block" 
                        className="rounded-md border border-gray-200 max-h-64 object-contain"
                      />
                    </div>
                  )}
                  
                  {result.bondingImage && (
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Bonding Image</h3>
                      <img 
                        src={result.bondingImage} 
                        alt="Bonding" 
                        className="rounded-md border border-gray-200 max-h-64 object-contain"
                      />
                    </div>
                  )}
                  
                  {result.houseImage && (
                    <div>
                      <h3 className="text-lg font-semibold mb-2">House Image</h3>
                      <img 
                        src={result.houseImage} 
                        alt="House" 
                        className="rounded-md border border-gray-200 max-h-64 object-contain"
                      />
                    </div>
                  )}
                  
                  {result.jobScreenshot && (
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Job Screenshot</h3>
                      <img 
                        src={result.jobScreenshot} 
                        alt="Job Screenshot" 
                        className="rounded-md border border-gray-200 max-h-64 object-contain"
                      />
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}