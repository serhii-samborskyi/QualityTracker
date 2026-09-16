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
import { Download } from "lucide-react";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
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

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gray-100">
      <Card className="w-full max-w-md shadow-xl rounded-xl overflow-hidden bg-[#031626] text-gray-100 border-none">
        <CardContent className="pt-12 pb-10 px-8 space-y-8">
          <div className="text-center space-y-3">
            <h2 className="text-3xl font-bold relative">
              <span className="text-blue-500 bg-blue-900/30 px-2">Quality</span><span className="text-gray-100"> Tracker</span>
            </h2>
            <p className="text-gray-400">
              Sign in to your account
            </p>
          </div>

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
