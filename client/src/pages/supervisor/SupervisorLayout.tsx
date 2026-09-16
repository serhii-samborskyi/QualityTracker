import { useState, useEffect, createContext, useContext } from "react";
import { Link, useLocation } from "wouter";
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
  Bell,
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
  const baseClasses = "group flex items-center px-3 py-3 text-base font-medium rounded-md";
  const activeClasses = "text-white bg-blue-900";
  const inactiveClasses = "text-blue-100 hover:bg-[#022d45]";
  
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
      <div className="mr-3 h-6 w-6 text-blue-400">{icon}</div>
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
    { name: "API Test", href: "/supervisor/api-test", icon: <Code /> },
    { name: "Technicians", href: "/supervisor/technicians", icon: <Users /> },
    { name: "Settings", href: "/supervisor/settings", icon: <Settings /> },
  ];

  // Create context value
  const mobileMenuContextValue = {
    isMobileMenuOpen,
    setIsMobileMenuOpen
  };

  return (
    <MobileMenuContext.Provider value={mobileMenuContextValue}>
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="min-h-screen bg-gray-100">
          {/* Mobile Header */}
          <div className="bg-[#031626] lg:hidden shadow-md">
            <div className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center">
                <span className="flex h-10 w-10 rounded-md items-center justify-center bg-blue-900">
                  <CheckSquare className="h-6 w-6 text-blue-100" />
                </span>
                <h1 className="ml-3 text-2xl font-medium text-white">
                  <span className="text-blue-400 bg-blue-900/50 px-2">Quality</span> Tracker
                </h1>
              </div>
              
              <div className="flex items-center">
                <Button variant="ghost" className="text-white p-1 mr-2" onClick={handleRefresh}>
                  <RefreshCw className="h-5 w-5" />
                </Button>
                <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" className="text-white p-0 h-12 w-12">
                      <Menu className="h-8 w-8" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="bg-[#031626] text-white p-0 w-80">
                    <div className="flex items-center h-20 flex-shrink-0 px-4 bg-[#021219]">
                      <span className="flex h-10 w-10 rounded-md items-center justify-center bg-blue-900">
                        <CheckSquare className="h-6 w-6 text-blue-100" />
                      </span>
                      <h1 className="ml-3 text-2xl font-medium text-white">
                        <span className="text-blue-400 bg-blue-900/50 px-2">Quality</span> Tracker
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
                    
                    <div className="flex-shrink-0 flex border-t border-blue-900/50 p-6">
                      <div className="flex-shrink-0 w-full group block">
                        <div className="flex items-center">
                          <div>
                            <div className="inline-block h-12 w-12 rounded-full bg-blue-900 text-white text-center text-lg leading-[3rem]">
                              {user.name.charAt(0)}
                            </div>
                          </div>
                          <div className="ml-3">
                            <p className="text-base font-medium text-gray-100">{user.name}</p>
                            <Button 
                              variant="ghost" 
                              className="text-base font-medium text-blue-300 hover:text-white py-2 h-auto mt-1"
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
              <div className="flex flex-col w-64">
                <div className="flex flex-col h-0 flex-1 bg-[#031626]">
                  <div className="flex items-center h-20 flex-shrink-0 px-4 bg-[#021219]">
                    <span className="flex h-10 w-10 rounded-md items-center justify-center bg-blue-900">
                      <CheckSquare className="h-6 w-6 text-blue-100" />
                    </span>
                    <h1 className="ml-3 text-2xl font-medium text-white">
                      <span className="text-blue-400 bg-blue-900/50 px-2">Quality</span> Tracker
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
                  
                  <div className="flex-shrink-0 flex border-t border-blue-900/50 p-6">
                    <div className="flex-shrink-0 w-full group block">
                      <div className="flex items-center">
                        <div>
                          <div className="inline-block h-12 w-12 rounded-full bg-blue-900 text-white text-center text-lg leading-[3rem]">
                            {user.name.charAt(0)}
                          </div>
                        </div>
                        <div className="ml-3">
                          <p className="text-base font-medium text-gray-100">{user.name}</p>
                          <Button 
                            variant="ghost" 
                            className="text-base font-medium text-blue-300 hover:text-white py-2 h-auto mt-1"
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
                <div className="py-6">
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