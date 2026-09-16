import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import StatusBadge from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Eye, EyeOff } from "lucide-react";

import OneSignalStatus from "@/components/notifications/OneSignalStatus";

export default function Settings() {
  const { toast } = useToast();
  const [editingIcon, setEditingIcon] = useState<{ id: number, name: string } | null>(null);
  const [newName, setNewName] = useState("");
  const [isResettingIcons, setIsResettingIcons] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  
  // User credential state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Fetch current user info
  const { data: currentUser } = useQuery<{id: number; username: string; name: string; role: string}>({
    queryKey: ['/api/auth/me'],
  });
  
  // Set username from current user when data is loaded
  React.useEffect(() => {
    if (currentUser?.username) {
      setUsername(currentUser.username);
    }
  }, [currentUser]);
  
  // Mutation to update user credentials
  const updateCredentialsMutation = useMutation({
    mutationFn: async (credentials: { username: string; password?: string; confirmPassword?: string }) => {
      const response = await apiRequest("PUT", "/api/auth/credentials", credentials);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Credentials Updated",
        description: "Your username and password have been updated successfully",
      });
      // Clear password fields after successful update
      setPassword("");
      setConfirmPassword("");
      // Refresh user data
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update credentials",
        variant: "destructive",
      });
    }
  });
  
  // Function to handle credentials form submission
  const handleCredentialsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim()) {
      toast({
        title: "Username Required",
        description: "Please enter a username",
        variant: "destructive",
      });
      return;
    }
    
    // If password is provided, make sure it matches confirmation
    if (password) {
      if (password.length < 8) {
        toast({
          title: "Password Too Short",
          description: "Password must be at least 8 characters long",
          variant: "destructive",
        });
        return;
      }
      
      if (password !== confirmPassword) {
        toast({
          title: "Passwords Don't Match",
          description: "Password and confirmation do not match",
          variant: "destructive",
        });
        return;
      }
    }
    
    // Update credentials
    updateCredentialsMutation.mutate({
      username: username.trim(),
      password: password || undefined,
      confirmPassword: confirmPassword || undefined
    });
  };

  // Fetch status icons
  const { data: statusIcons, isLoading, refetch } = useQuery<any[]>({
    queryKey: ['/api/status-icons'],
  });

  // Mutation to update status icon name
  const updateIconMutation = useMutation({
    mutationFn: async ({ name, newName }: { name: string, newName: string }) => {
      const response = await fetch('/api/status-icons/update-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, newName })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update status icon name');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Status Updated",
        description: "Status icon name has been updated successfully",
      });
      refetch();
      setEditingIcon(null);
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Function to handle edit form submission
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingIcon && newName.trim()) {
      updateIconMutation.mutate({
        name: editingIcon.name,
        newName: newName.trim()
      });
    }
  };

  // Function to start editing an icon
  const startEditing = (icon: { id: number, name: string }) => {
    setEditingIcon(icon);
    setNewName(icon.name);
  };

  // Function to cancel editing
  const cancelEditing = () => {
    setEditingIcon(null);
    setNewName("");
  };
  
  // Function to send a test notification
  const handleSendTestNotification = async () => {
    setIsSendingTest(true);
    
    try {
      const response = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!response.ok) {
        throw new Error('Failed to send test notification');
      }
      
      toast({
        title: "Test Notification Sent",
        description: "A test notification has been sent to your device.",
      });
    } catch (error) {
      console.error("Error sending test notification:", error);
      toast({
        title: "Failed to send test notification",
        description: "Please ensure notifications are enabled.",
        variant: "destructive"
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  // Function to reset status icons to defaults
  const resetStatusIcons = () => {
    if (confirm("Are you sure you want to reset all status icons to defaults? This will replace any custom icons and names with the new 5-level system.")) {
      setIsResettingIcons(true);
      fetch("/api/status-icons/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
        .then((res) => res.json())
        .then(() => {
          toast({
            title: "Status Icons Reset",
            description: "Status icons have been reset to defaults with the new 5-level system",
          });
          refetch();
        })
        .catch((error) => {
          console.error("Error resetting status icons:", error);
          toast({
            title: "Error",
            description: "Failed to reset status icons",
            variant: "destructive",
          });
        })
        .finally(() => {
          setIsResettingIcons(false);
        });
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <h1 className="text-3xl font-semibold text-gray-800">Settings</h1>
        <div className="py-4">
          <Card className="shadow-md rounded-xl border border-gray-100">
            <CardContent className="pt-6">
              <div className="space-y-6">
                <Skeleton className="h-8 w-64" />
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center justify-between">
                      <Skeleton className="h-10 w-32" />
                      <Skeleton className="h-10 w-24" />
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
      <h1 className="text-3xl font-semibold text-gray-800">Settings</h1>
      <div className="py-4 space-y-6">
        {/* Account Settings Card */}
        <Card className="shadow-md rounded-xl border border-gray-100">
          <CardContent className="pt-6">
            <h2 className="text-xl font-semibold text-blue-600 dark:text-blue-400 mb-6">Account Settings</h2>
            
            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  className="max-w-md"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password" className="flex items-center justify-between">
                  <span>New Password</span>
                  <span className="text-sm text-gray-500">(leave blank to keep current password)</span>
                </Label>
                <div className="relative max-w-md">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <div className="relative max-w-md">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              
              <div className="pt-2">
                <Button 
                  type="submit"
                  disabled={updateCredentialsMutation.isPending}
                  className="bg-[#4e7ac7] hover:bg-blue-700"
                >
                  {updateCredentialsMutation.isPending ? (
                    <div className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-r-transparent"></span>
                      <span>Updating...</span>
                    </div>
                  ) : "Update Credentials"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
        
        {/* Notifications Card */}
        <Card className="shadow-md rounded-xl border border-gray-100">
          <CardContent className="pt-6">
            <h2 className="text-xl font-semibold text-blue-600 dark:text-blue-400 mb-6">Push Notifications</h2>
            
            {/* OneSignal Status */}
            <div className="-mx-6 mt-4 mb-4">
              <OneSignalStatus />
            </div>

            <div className="mt-6">
              <Button 
                onClick={handleSendTestNotification} 
                disabled={isSendingTest}
                className="w-full"
                variant="default"
              >
                {isSendingTest ? (
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-r-transparent"></span>
                    <span>Sending Test...</span>
                  </div>
                ) : "Send Test Notification"}
              </Button>
            </div>
          </CardContent>
        </Card>
        
        {/* Status Icons Card */}
        <Card className="shadow-md rounded-xl border border-gray-100">
          <CardContent className="pt-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-blue-600 dark:text-blue-400">Status Icons</h2>
              <Button
                onClick={resetStatusIcons}
                disabled={isResettingIcons}
                className="border border-[#4e7ac7] bg-[#4e7ac7] hover:bg-blue-700 text-white font-medium"
              >
                {isResettingIcons ? "Resetting..." : "Reset to Defaults"}
              </Button>
            </div>
            
            <p className="text-gray-600 mb-6">
              Configure the names for the 5 status levels. These status levels will be assigned to technicians based on the number of QCs they have submitted.
            </p>
            
            {statusIcons && statusIcons.length > 0 ? (
              <div className="space-y-6">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 text-sm font-medium text-gray-600">Icon</th>
                      <th className="text-left py-2 px-3 text-sm font-medium text-gray-600">Name</th>
                      <th className="text-right py-2 px-3 text-sm font-medium text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statusIcons.map((icon) => (
                      <tr key={icon.id} className="border-b border-gray-100">
                        <td className="py-3 px-3">
                          <StatusBadge status={icon.name} statusIcon={icon} />
                        </td>
                        <td className="py-3 px-3">
                          {editingIcon && editingIcon.id === icon.id ? (
                            <form onSubmit={handleEditSubmit} className="flex items-center space-x-2">
                              <Input
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                className="max-w-xs"
                              />
                            </form>
                          ) : (
                            <span className="text-gray-800">{icon.name}</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {editingIcon && editingIcon.id === icon.id ? (
                            <div className="flex justify-end space-x-2">
                              <Button
                                size="sm"
                                type="button"
                                onClick={handleEditSubmit}
                                className="bg-green-600 hover:bg-green-700 text-white"
                                disabled={updateIconMutation.isPending}
                              >
                                {updateIconMutation.isPending ? "Saving..." : "Save"}
                              </Button>
                              <Button
                                size="sm"
                                type="button"
                                variant="outline"
                                onClick={cancelEditing}
                                className="border-gray-300 text-gray-700"
                                disabled={updateIconMutation.isPending}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              type="button"
                              variant="outline"
                              onClick={() => startEditing(icon)}
                              className="border-[#4e7ac7] text-[#4e7ac7] hover:bg-blue-50"
                            >
                              Edit
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                

              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-gray-600">No status icons found. Click "Reset to Defaults" to create the default icons.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}