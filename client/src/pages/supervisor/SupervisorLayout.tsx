import { useState, useEffect, createContext, useContext } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import PullToRefresh from "@/components/PullToRefresh";
import NotificationIndicator from "@/components/notifications/NotificationIndicator";
import { 
  Home,
  CheckSquare,
  Calendar,
  Settings,
  Menu,
  Users,
  Archive,
  RefreshCw,
  Code
} from "lucide-react";

// Create a context to manage the mobile menu state
type MobileMenuContextType = {
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (isOpen: boolean) => void;
};

const MobileMenuContext = createContext<MobileMenuContextType>({
  isMobileMenuOpen: false,
  setIsMobileMenuOpen: () => {},
});

type NavItemProps = {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  current: boolean;
};

function NavItem({ href, icon, children, current }: NavItemProps) {
  const [, navigate] = useLocation();
  const { setIsMobileMenuOpen } = useContext(MobileMenuContext);
  const baseClasses = "group flex items-center rounded-2xl px-3 py-3 text-base font-semibold transition";
  const activeClasses = "bg-teal-600 text-white shadow-sm shadow-teal-200";
  const inactiveClasses = "text-slate-600 hover:bg-teal-50 hover:text-teal-800";
  
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    // Close mobile menu
    setIsMobileMenuOpen(false);
    // Then navigate
    setTimeout(() => {
      navigate(href);
    }, 100);
  };
  
  return (
    <a 
      href={href} 
      onClick={handleClick}
      className={`${baseClasses} ${current ? activeClasses : inactiveClasses}`}
    >
      <div className={`mr-3 h-5 w-5 ${current ? "text-white" : "text-teal-600"}`}>{icon}</div>
      {children}
    </a>
  );
}

export default function SupervisorLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { toast } = useToast();
  
  // Check if the user is authenticated and is a supervisor
  useEffect(() => {
    if (!user || user.role !== "supervisor") {
      window.location.href = "/";
    }
  }, [user]);

  if (!user || user.role !== "supervisor") {
    return null;
  }
  
  const handleRefresh = () => {
    // Reload the current page
    window.location.reload();
    
    toast({
      title: "Refreshing",
      description: "Updating your content...",
      duration: 2000,
    });
  };

  const navItems = [
    { name: "Dashboard", href: "/supervisor", icon: <Home /> },
    { name: "QC Review", href: "/supervisor/review", icon: <CheckSquare /> },
    { name: "QC Periods", href: "/supervisor/periods", icon: <Calendar /> },
    { name: "Archive", href: "/supervisor/archive", icon: <Archive /> },
    { name: "Notifications", href: "/supervisor/notifications", icon: <NotificationIndicator /> },
    { name: "Technicians", href: "/supervisor/technicians", icon: <Users /> },
    { name: "Settings", href: "/supervisor/settings", icon: <Settings /> },
    { name: "API Test", href: "/supervisor/api-test", icon: <Code /> },
  ];

  // Create context value
  const mobileMenuContextValue = {
    isMobileMenuOpen,
    setIsMobileMenuOpen
  };

  return (
    <MobileMenuContext.Provider value={mobileMenuContextValue}>
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="min-h-screen bg-[#f6faf9] text-slate-950">
          {/* Mobile Header */}
          <div className="border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur lg:hidden">
            <div className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-100 text-teal-700">
                  <CheckSquare className="h-6 w-6" />
                </span>
                <h1 className="ml-3 text-2xl font-semibold text-slate-950">
                  <span className="text-teal-700">Quality</span> Tracker
                </h1>
              </div>
              
              <div className="flex items-center">
                <Button variant="ghost" className="mr-2 h-11 w-11 p-0 text-slate-600 hover:bg-teal-50 hover:text-teal-700" onClick={handleRefresh}>
                  <RefreshCw className="h-5 w-5" />
                </Button>
                <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" className="h-11 w-11 p-0 text-slate-700 hover:bg-teal-50 hover:text-teal-700">
                      <Menu className="h-7 w-7" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-80 bg-white p-0 text-slate-950">
                    <div className="flex h-20 flex-shrink-0 items-center border-b border-slate-100 px-4">
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-100 text-teal-700">
                        <CheckSquare className="h-6 w-6" />
                      </span>
                      <h1 className="ml-3 text-2xl font-semibold text-slate-950">
                        <span className="text-teal-700">Quality</span> Tracker
                      </h1>
                    </div>
                    
                    <nav className="flex-1 px-3 py-6 space-y-2">
                      {navItems.map((item) => (
                        <NavItem 
                          key={item.name} 
                          href={item.href} 
                          icon={item.icon} 
                          current={location === item.href}
                        >
                          {item.name}
                        </NavItem>
                      ))}
                    </nav>
                    
                    <div className="flex-shrink-0 flex border-t border-slate-100 p-6">
                      <div className="flex-shrink-0 w-full group block">
                        <div className="flex items-center">
                          <div>
                            <div className="inline-block h-12 w-12 rounded-2xl bg-teal-100 text-center text-lg font-semibold leading-[3rem] text-teal-800">
                              {user.name.charAt(0)}
                            </div>
                          </div>
                          <div className="ml-3">
                            <p className="text-base font-semibold text-slate-900">{user.name}</p>
                            <Button 
                              variant="ghost" 
                              className="mt-1 h-auto px-0 py-2 text-base font-semibold text-slate-500 hover:bg-transparent hover:text-teal-700"
                              onClick={() => {
                                setIsMobileMenuOpen(false);
                                setTimeout(() => logout(), 100);
                              }}
                            >
                              Sign Out
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </div>
          </div>

          <div className="flex h-screen overflow-hidden">
            {/* Sidebar (Desktop) */}
            <div className="hidden lg:flex lg:flex-shrink-0">
              <div className="flex w-72 flex-col border-r border-slate-200 bg-white/90 shadow-sm backdrop-blur">
                <div className="flex h-0 flex-1 flex-col">
                  <div className="flex h-20 flex-shrink-0 items-center border-b border-slate-100 px-5">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-100 text-teal-700">
                      <CheckSquare className="h-6 w-6" />
                    </span>
                    <h1 className="ml-3 text-2xl font-semibold text-slate-950">
                      <span className="text-teal-700">Quality</span> Tracker
                    </h1>
                  </div>
                  
                  <div className="flex-1 flex flex-col overflow-y-auto">
                    <nav className="flex-1 px-3 py-6 space-y-2">
                      {navItems.map((item) => (
                        <NavItem 
                          key={item.name} 
                          href={item.href} 
                          icon={item.icon} 
                          current={location === item.href}
                        >
                          {item.name}
                        </NavItem>
                      ))}
                    </nav>
                  </div>
                  
                  <div className="flex-shrink-0 flex border-t border-slate-100 p-6">
                    <div className="flex-shrink-0 w-full group block">
                      <div className="flex items-center">
                        <div>
                          <div className="inline-block h-12 w-12 rounded-2xl bg-teal-100 text-center text-lg font-semibold leading-[3rem] text-teal-800">
                            {user.name.charAt(0)}
                          </div>
                        </div>
                        <div className="ml-3">
                          <p className="text-base font-semibold text-slate-900">{user.name}</p>
                          <Button 
                            variant="ghost" 
                            className="mt-1 h-auto px-0 py-2 text-base font-semibold text-slate-500 hover:bg-transparent hover:text-teal-700"
                            onClick={logout}
                          >
                            Sign Out
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="flex flex-col w-0 flex-1 overflow-hidden">
              <main className="flex-1 relative z-0 overflow-y-auto focus:outline-none">
                <div className="py-4 lg:py-6">
                  {children}
                </div>
              </main>
            </div>
          </div>
        </div>
      </PullToRefresh>
    </MobileMenuContext.Provider>
  );
}
