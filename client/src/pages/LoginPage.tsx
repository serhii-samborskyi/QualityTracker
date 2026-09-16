import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { InstallAppDialog, UseInstallPrompt } from "@/components/InstallAppDialog";
import { getSupervisorRegistrationStatus, registerSupervisor } from "@/lib/api";
import { Download, UserPlus } from "lucide-react";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional(),
});

const supervisorRegistrationSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  username: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(8, "Please confirm your password"),
  registrationCode: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type LoginFormValues = z.infer<typeof loginSchema>;
type SupervisorRegistrationValues = z.infer<typeof supervisorRegistrationSchema>;
type SupervisorRegistrationStatus = Awaited<ReturnType<typeof getSupervisorRegistrationStatus>>;

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [registrationStatus, setRegistrationStatus] = useState<SupervisorRegistrationStatus | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { login } = useAuth();
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const { showInstallPrompt, setShowInstallPrompt } = UseInstallPrompt();
  const [isStandaloneMode, setIsStandaloneMode] = useState(false);
  
  // Check if the app is already running in standalone/PWA mode
  useEffect(() => {
    const checkStandaloneMode = () => {
      const isInStandaloneMode = 
        window.matchMedia('(display-mode: standalone)').matches || 
        (window.navigator as any).standalone === true;
      
      setIsStandaloneMode(isInStandaloneMode);
    };
    
    checkStandaloneMode();
    
    // Listen for changes in display mode
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleChange = (e: MediaQueryListEvent) => {
      setIsStandaloneMode(e.matches);
    };
    
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    }
    
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      }
    };
  }, []);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
      rememberMe: false,
    },
  });

  const registrationForm = useForm<SupervisorRegistrationValues>({
    resolver: zodResolver(supervisorRegistrationSchema),
    defaultValues: {
      name: "",
      username: "",
      password: "",
      confirmPassword: "",
      registrationCode: "",
    },
  });

  useEffect(() => {
    getSupervisorRegistrationStatus()
      .then(setRegistrationStatus)
      .catch(() => setRegistrationStatus(null));
  }, []);

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    try {
      const user = await login(data.username, data.password);
      if (user.role === "supervisor") {
        setLocation("/supervisor");
      } else {
        setLocation("/technician");
      }
    } catch (error) {
      toast({
        title: "Login failed",
        description: "Invalid username or password",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onRegisterSupervisor = async (data: SupervisorRegistrationValues) => {
    setIsRegistering(true);
    try {
      const user = await registerSupervisor(data);
      toast({
        title: "Supervisor registered",
        description: "Your supervisor account is ready.",
      });

      if (user.role === "supervisor") {
        setLocation("/supervisor");
      }
    } catch (error: any) {
      toast({
        title: "Registration failed",
        description: error?.message || "Unable to register supervisor",
        variant: "destructive",
      });
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gray-100">
      <Card className="w-full max-w-md shadow-xl rounded-xl overflow-hidden bg-[#031626] text-gray-100 border-none">
        <CardContent className="pt-12 pb-10 px-8 space-y-8">
          <div className="text-center space-y-3">
            <h2 className="text-3xl font-bold relative">
              <span className="text-blue-500 bg-blue-900/30 px-2">Quality</span><span className="text-gray-100"> Tracker</span>
            </h2>
            <p className="text-gray-400">
              {authMode === "login" ? "Sign in to your account" : "Register a supervisor account"}
            </p>
          </div>

          {authMode === "login" ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-5">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-medium text-gray-200">Username</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Enter username or email"
                          className="h-14 text-base rounded-full border border-gray-700 bg-[#031626] text-white px-6"
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage className="text-sm text-red-400" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-medium text-gray-200">Password</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          placeholder="Enter password"
                          className="h-14 text-base rounded-full border border-gray-700 bg-[#031626] text-white px-6"
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage className="text-sm text-red-400" />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex items-center">
                <FormField
                  control={form.control}
                  name="rememberMe"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-3">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={isLoading}
                          id="remember-me"
                          className="w-5 h-5 border-gray-600 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                        />
                      </FormControl>
                      <label
                        htmlFor="remember-me"
                        className="ml-2 block text-base text-gray-400"
                      >
                        Remember me
                      </label>
                    </FormItem>
                  )}
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-14 text-lg font-semibold rounded-full bg-blue-500 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 mt-4"
              >
                {isLoading ? "Signing in..." : "Sign in"}
              </Button>

              {registrationStatus?.enabled && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setAuthMode("register")}
                  className="w-full h-12 text-base text-blue-300 hover:bg-blue-900/20 flex items-center justify-center gap-2"
                >
                  <UserPlus className="h-5 w-5" />
                  Register supervisor
                </Button>
              )}
              
              {!isStandaloneMode && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowInstallDialog(true)}
                  className="w-full h-14 text-lg font-semibold rounded-full border-blue-500 text-blue-500 hover:bg-blue-900/20 mt-4 flex items-center justify-center gap-2"
                >
                  <Download className="h-5 w-5" />
                  Install App
                </Button>
              )}
            </form>
          </Form>
          ) : (
          <Form {...registrationForm}>
            <form onSubmit={registrationForm.handleSubmit(onRegisterSupervisor)} className="space-y-5">
              <FormField
                control={registrationForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-medium text-gray-200">Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Your name"
                        className="h-12 text-base rounded-full border border-gray-700 bg-[#031626] text-white px-6"
                        disabled={isRegistering}
                      />
                    </FormControl>
                    <FormMessage className="text-sm text-red-400" />
                  </FormItem>
                )}
              />

              <FormField
                control={registrationForm.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-medium text-gray-200">Email</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        placeholder="supervisor@example.com"
                        className="h-12 text-base rounded-full border border-gray-700 bg-[#031626] text-white px-6"
                        disabled={isRegistering}
                      />
                    </FormControl>
                    <FormMessage className="text-sm text-red-400" />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={registrationForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-medium text-gray-200">Password</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          className="h-12 text-base rounded-full border border-gray-700 bg-[#031626] text-white px-6"
                          disabled={isRegistering}
                        />
                      </FormControl>
                      <FormMessage className="text-sm text-red-400" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={registrationForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-medium text-gray-200">Confirm</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          className="h-12 text-base rounded-full border border-gray-700 bg-[#031626] text-white px-6"
                          disabled={isRegistering}
                        />
                      </FormControl>
                      <FormMessage className="text-sm text-red-400" />
                    </FormItem>
                  )}
                />
              </div>

              {registrationStatus?.requiresCode && (
                <FormField
                  control={registrationForm.control}
                  name="registrationCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-medium text-gray-200">Registration code</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          placeholder="Code from Coolify env"
                          className="h-12 text-base rounded-full border border-gray-700 bg-[#031626] text-white px-6"
                          disabled={isRegistering}
                        />
                      </FormControl>
                      <FormMessage className="text-sm text-red-400" />
                    </FormItem>
                  )}
                />
              )}

              {registrationStatus?.requiresCode && !registrationStatus.hasRegistrationCode && (
                <p className="rounded-md border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
                  Add SUPERVISOR_REGISTRATION_CODE in Coolify before registering a recovery supervisor.
                </p>
              )}

              <Button
                type="submit"
                disabled={isRegistering}
                className="w-full h-14 text-lg font-semibold rounded-full bg-blue-500 hover:bg-blue-600"
              >
                {isRegistering ? "Creating..." : "Create supervisor"}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={() => setAuthMode("login")}
                className="w-full h-12 text-base text-blue-300 hover:bg-blue-900/20"
              >
                Back to sign in
              </Button>
            </form>
          </Form>
          )}
        </CardContent>
      </Card>
      
      {/* Installation dialog */}
      <InstallAppDialog 
        isOpen={showInstallDialog || showInstallPrompt} 
        onClose={() => {
          setShowInstallDialog(false);
          setShowInstallPrompt(false);
        }} 
      />
    </div>
  );
}
