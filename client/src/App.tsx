import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, useAuth } from "./context/AuthContext";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/LoginPage";
import SupervisorLayout from "@/pages/supervisor/SupervisorLayout";
import Dashboard from "@/pages/supervisor/Dashboard";
import QCReview from "@/pages/supervisor/QCReview";
import QCPeriods from "@/pages/supervisor/QCPeriods";
import Archive from "@/pages/supervisor/Archive";
import Notifications from "@/pages/supervisor/Notifications";
import Settings from "@/pages/supervisor/Settings";
import TechnicianManagement from "@/pages/supervisor/TechnicianManagement";
import TechnicianQCSubmissions from "@/pages/supervisor/TechnicianQCSubmissions";
import TestAPI from "@/pages/supervisor/TestAPI";
import TechnicianLayout from "@/pages/technician/TechnicianLayout";
import TechnicianDashboard from "@/pages/technician/TechnicianDashboard";
import DebugPage from "@/pages/technician/DebugPage";
import NotificationsProvider from "@/components/notifications/NotificationsProvider";
import OneSignalInitializer from "@/components/notifications/OneSignalInitializer";

function Router() {
  const { user, loading } = useAuth();
  
  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }
  
  return (
    <Switch>
      <Route path="/">
        {() => {
          // Redirect based on auth status and role
          if (!user) {
            return <LoginPage />;
          } else if (user.role === "supervisor") {
            window.location.href = "/supervisor";
            return null;
          } else {
            window.location.href = "/technician";
            return null;
          }
        }}
      </Route>
      
      {/* Supervisor Routes */}
      <Route path="/supervisor">
        {() => {
          // Protect supervisor routes
          if (!user) {
            window.location.href = "/";
            return null;
          } else if (user.role !== "supervisor") {
            return <div className="p-8 text-center">Access denied. You need supervisor privileges.</div>;
          }
          
          return (
            <SupervisorLayout>
              <Dashboard />
            </SupervisorLayout>
          );
        }}
      </Route>
      <Route path="/supervisor/review">
        {() => (
          <SupervisorLayout>
            <QCReview />
          </SupervisorLayout>
        )}
      </Route>
      <Route path="/supervisor/periods">
        {() => (
          <SupervisorLayout>
            <QCPeriods />
          </SupervisorLayout>
        )}
      </Route>
      <Route path="/supervisor/archive">
        {() => (
          <SupervisorLayout>
            <Archive />
          </SupervisorLayout>
        )}
      </Route>
      <Route path="/supervisor/notifications">
        {() => (
          <SupervisorLayout>
            <Notifications />
          </SupervisorLayout>
        )}
      </Route>
      <Route path="/supervisor/settings">
        {() => (
          <SupervisorLayout>
            <Settings />
          </SupervisorLayout>
        )}
      </Route>
      
      <Route path="/supervisor/technicians">
        {() => (
          <SupervisorLayout>
            <TechnicianManagement />
          </SupervisorLayout>
        )}
      </Route>
      
      <Route path="/supervisor/technician/:technicianId">
        {({ technicianId }) => (
          <SupervisorLayout>
            <TechnicianQCSubmissions />
          </SupervisorLayout>
        )}
      </Route>
      
      <Route path="/supervisor/api-test">
        {() => {
          // Protect API test route
          if (!user) {
            window.location.href = "/";
            return null;
          } else if (user.role !== "supervisor") {
            return <div className="p-8 text-center">Access denied. You need supervisor privileges.</div>;
          }
          
          return (
            <SupervisorLayout>
              <TestAPI />
            </SupervisorLayout>
          );
        }}
      </Route>
      
      {/* Technician Routes */}
      <Route path="/technician">
        {() => {
          // Protect technician routes
          if (!user) {
            window.location.href = "/";
            return null;
          } else if (user.role !== "technician") {
            return <div className="p-8 text-center">Access denied. You need technician privileges.</div>;
          }
          
          return (
            <TechnicianLayout>
              <TechnicianDashboard />
            </TechnicianLayout>
          );
        }}
      </Route>
      
      <Route path="/technician/debug">
        {() => {
          // Protect debug route
          if (!user) {
            window.location.href = "/";
            return null;
          } else if (user.role !== "technician") {
            return <div className="p-8 text-center">Access denied. You need technician privileges.</div>;
          }
          
          return (
            <TechnicianLayout>
              <DebugPage />
            </TechnicianLayout>
          );
        }}
      </Route>
      
      {/* Redirect /settings to /supervisor/settings */}
      <Route path="/settings">
        {() => {
          window.location.href = '/supervisor/settings';
          return null;
        }}
      </Route>

      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <NotificationsProvider />
        <OneSignalInitializer />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
