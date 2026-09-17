import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Trash2, AlertCircle, Eraser } from "lucide-react";
import { addTechnician, deleteTechnician, getTechnicians, cleanTechnicianQCs } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { queryClient } from "@/lib/queryClient";

// Interface for our technician type
interface Technician {
  id: number;
  username: string;
  name: string;
  techId: string;
  role: string;
}

// Define the technician form schema
const technicianFormSchema = z.object({
  username: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  techId: z.string().regex(/^\d{4}$/, "Tech ID must be exactly 4 digits"),
});

type TechnicianFormValues = z.infer<typeof technicianFormSchema>;

export default function TechnicianManagement() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [cleanQCConfirmId, setCleanQCConfirmId] = useState<number | null>(null);

  // Set up form
  const form = useForm<TechnicianFormValues>({
    resolver: zodResolver(technicianFormSchema),
    defaultValues: {
      username: "",
      password: "",
      name: "",
      techId: "",
    },
  });

  // Query for technicians
  const { data: technicians, isLoading, error } = useQuery<Technician[]>({
    queryKey: ["/api/technicians"],
    queryFn: getTechnicians,
  });

  // Mutation for adding a technician
  const addTechnicianMutation = useMutation({
    mutationFn: addTechnician,
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Technician added successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/technicians"] });
      setIsAddDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add technician",
        variant: "destructive",
      });
    },
  });

  // Mutation for deleting a technician
  const deleteTechnicianMutation = useMutation({
    mutationFn: deleteTechnician,
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Technician deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/technicians"] });
      setDeleteConfirmId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete technician",
        variant: "destructive",
      });
    },
  });
  
  // Mutation for cleaning QC submissions
  const cleanQCMutation = useMutation({
    mutationFn: cleanTechnicianQCs,
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: data.message || "QC submissions cleaned successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/technicians/progress"] });
      setCleanQCConfirmId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to clean QC submissions",
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  function onSubmit(data: TechnicianFormValues) {
    addTechnicianMutation.mutate(data);
  }

  // Confirm deletion of a technician
  const confirmDelete = (id: number) => {
    deleteTechnicianMutation.mutate(id);
  };
  
  // Confirm cleaning QC submissions for a technician
  const confirmCleanQC = (id: number) => {
    cleanQCMutation.mutate(id);
  };

  return (
    <div className="admin-page space-y-6">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-title">Technician Management</h1>
          <p className="admin-subtitle">Add, remove, and manage technicians</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="admin-primary-button">Add Technician</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Technician</DialogTitle>
              <DialogDescription>
                Fill out the form below to add a new technician to the system.
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="john.doe@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="******" {...field} />
                      </FormControl>
                      <FormDescription>
                        Password must be at least 6 characters
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="techId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tech ID</FormLabel>
                      <FormControl>
                        <Input placeholder="1234" maxLength={4} {...field} />
                      </FormControl>
                      <FormDescription>
                        4-digit unique identifier (e.g., 1234)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="button" variant="outline" className="admin-secondary-button" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="admin-primary-button" disabled={addTechnicianMutation.isPending}>
                    {addTechnicianMutation.isPending ? "Adding..." : "Add Technician"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load technicians. Please try again later.
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="admin-panel animate-pulse">
              <CardHeader className="bg-muted/50 h-12"></CardHeader>
              <CardContent className="pt-4">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-muted rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {technicians?.map((technician: Technician) => (
            <Card key={technician.id} className="admin-panel transition-colors hover:border-teal-200 hover:bg-teal-50/30">
              <CardHeader className="pb-2 px-6">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg text-slate-950">{technician.name}</CardTitle>
                  <Badge variant="outline" className="border-teal-200 bg-teal-50 font-mono text-xs text-teal-800">
                    {technician.techId}
                  </Badge>
                </div>
                <CardDescription className="truncate font-mono text-xs">{technician.username}</CardDescription>
              </CardHeader>
              <CardFooter className="flex justify-end gap-2 pt-2 px-6">
                {/* Clean QC Dialog */}
                <Dialog>
                  <DialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="admin-secondary-button"
                      onClick={() => setCleanQCConfirmId(technician.id)}
                    >
                      <Eraser className="h-4 w-4 mr-2" />
                      Clean QC
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Confirm QC Cleanup</DialogTitle>
                      <DialogDescription>
                        Are you sure you want to delete all QC submissions for {technician.name}? This action cannot be undone.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="outline" className="admin-secondary-button" onClick={() => setCleanQCConfirmId(null)}>
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => confirmCleanQC(technician.id)}
                        disabled={cleanQCMutation.isPending}
                      >
                        {cleanQCMutation.isPending ? "Cleaning..." : "Clean QC Submissions"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                
                {/* Delete Technician Dialog */}
                <Dialog>
                  <DialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="rounded-2xl border-rose-200 bg-white font-semibold text-rose-600 hover:bg-rose-50"
                      onClick={() => setDeleteConfirmId(technician.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Confirm Deletion</DialogTitle>
                      <DialogDescription>
                        Are you sure you want to delete {technician.name}? This action cannot be undone.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="outline" className="admin-secondary-button" onClick={() => setDeleteConfirmId(null)}>
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => confirmDelete(technician.id)}
                        disabled={deleteTechnicianMutation.isPending}
                      >
                        {deleteTechnicianMutation.isPending ? "Deleting..." : "Delete"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardFooter>
            </Card>
          ))}

          {technicians?.length === 0 && (
            <div className="admin-empty-state col-span-full">
              <p className="mb-4">No technicians found</p>
              <Button variant="outline" className="admin-secondary-button" onClick={() => setIsAddDialogOpen(true)}>Add Your First Technician</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
