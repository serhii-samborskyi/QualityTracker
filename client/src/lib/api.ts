import { apiRequest } from "./queryClient";

// Auth API
export const login = async (username: string, password: string) => {
  const response = await apiRequest("POST", "/api/auth/login", { username, password });
  return response.json();
};

export const getSupervisorRegistrationStatus = async () => {
  const response = await fetch("/api/auth/supervisor-registration-status", {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to get supervisor registration status");
  }

  return response.json() as Promise<{
    enabled: boolean;
    hasSupervisor: boolean;
    requiresCode: boolean;
    recoveryEnabled: boolean;
    hasRegistrationCode: boolean;
  }>;
};

export const registerSupervisor = async (data: {
  username: string;
  password: string;
  confirmPassword: string;
  name: string;
  registrationCode?: string;
}) => {
  const response = await apiRequest("POST", "/api/auth/register-supervisor", data);
  return response.json();
};

export const logout = async () => {
  const response = await apiRequest("POST", "/api/auth/logout", {});
  return response.json();
};

export const getCurrentUser = async () => {
  const response = await fetch("/api/auth/me", {
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error("Failed to get current user");
  }
  
  return response.json();
};

// QC Period API
export const createQCPeriod = async (data: {
  startDate: string;
  endDate: string;
  requiredQCs: number;
}) => {
  const response = await apiRequest("POST", "/api/qc-periods", data);
  return response.json();
};

export const getQCPeriods = async () => {
  const response = await fetch("/api/qc-periods", {
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error("Failed to get QC periods");
  }
  
  return response.json();
};

export const getCurrentQCPeriod = async () => {
  const response = await fetch("/api/qc-periods/current", {
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error("Failed to get current QC period");
  }
  
  return response.json();
};

// QC Submission API
export const submitQC = async (formData: FormData) => {
  const response = await fetch("/api/qc-submissions", {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error("Failed to submit QC");
  }
  
  return response.json();
};

export const getTechnicianQCSubmissions = async () => {
  const response = await fetch("/api/qc-submissions/technician", {
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error("Failed to get technician QC submissions");
  }
  
  return response.json();
};

export const getPendingQCSubmissions = async () => {
  const response = await fetch("/api/qc-submissions/pending", {
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error("Failed to get pending QC submissions");
  }
  
  return response.json();
};

export const reviewQCSubmission = async (data: {
  qcId: number;
  status: "approved" | "declined";
  comment?: string;
}) => {
  const response = await apiRequest("POST", "/api/qc-submissions/review", data);
  return response.json();
};

// Progress API
export const getTechnicianProgress = async () => {
  const response = await fetch("/api/technicians/my-progress", {
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error("Failed to get technician progress");
  }
  
  return response.json();
};

export const getAllTechniciansProgress = async () => {
  const response = await fetch("/api/technicians/progress", {
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error("Failed to get all technicians progress");
  }
  
  return response.json();
};

// Status Icon API
export const getStatusIcons = async () => {
  const response = await fetch("/api/status-icons", {
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error("Failed to get status icons");
  }
  
  return response.json();
};

export const addStatusIcon = async (formData: FormData) => {
  const response = await fetch("/api/status-icons", {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error("Failed to add status icon");
  }
  
  return response.json();
};

// OneSignal API
export const getOneSignalConfig = async () => {
  const response = await fetch("/api/config/onesignal", {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to get OneSignal configuration");
  }

  return response.json() as Promise<{ appId: string; enabled: boolean }>;
};

export const saveOneSignalToken = async (token: string) => {
  const response = await apiRequest("POST", "/api/settings/onesignal", { token });
  return response.json();
};

export const getUserOneSignalStatus = async () => {
  const response = await apiRequest("GET", "/api/settings/onesignal/status");
  if (!response.ok) {
    throw new Error("Failed to get OneSignal status");
  }
  return response.json();
};

export const removeOneSignalSubscription = async () => {
  const response = await apiRequest("DELETE", "/api/settings/onesignal");
  if (!response.ok) {
    throw new Error("Failed to remove OneSignal subscription");
  }
  return response.json();
};

export const subscribeOneSignalToken = async (token: string) => {
  const response = await apiRequest("POST", "/api/settings/onesignal/subscribe", { token });
  return response.json();
};

export const unsubscribeOneSignalToken = async () => {
  const response = await apiRequest("POST", "/api/settings/onesignal/unsubscribe", {});
  return response.json();
};

export const sendQCReminders = async () => {
  const response = await apiRequest("POST", "/api/notifications/send-reminders", {});
  return response.json();
};

// Technician Management API
export const getTechnicians = async () => {
  const response = await fetch("/api/technicians", {
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error("Failed to get technicians");
  }
  
  return response.json();
};

export const addTechnician = async (data: {
  username: string;
  password: string;
  name: string;
  techId: string;
}) => {
  const response = await apiRequest("POST", "/api/technicians", data);
  return response.json();
};

export const deleteTechnician = async (id: number) => {
  const response = await apiRequest("DELETE", `/api/technicians/${id}`, {});
  return response.json();
};

export const cleanTechnicianQCs = async (id: number) => {
  const response = await apiRequest("DELETE", `/api/technicians/${id}/qc-submissions`, {});
  return response.json();
};

// Get QC submissions for a specific technician
export const getTechnicianQCSubmissionsById = async (technicianId: number) => {
  const response = await fetch(`/api/qc-submissions/technician/${technicianId}`, {
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error("Failed to get technician's QC submissions");
  }
  
  return response.json();
};

// Get QC images by job ID and technician ID
export const getQCImagesByJobAndTechnician = async (jobId: string, technicianId: number) => {
  try {
    console.log(`Fetching QC images for jobId=${jobId}, technicianId=${technicianId}`);
    
    const response = await fetch(`/api/qc-images/${jobId}/${technicianId}`, {
      credentials: "include",
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to get QC images: ${response.status} ${response.statusText}`);
      console.error(`Error details: ${errorText}`);
      throw new Error(`Failed to get QC images: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('QC images data received:', data);
    
    return data as {
      id: number;
      jobId: string;
      accountNumber?: string;
      technicianId: number;
      onsiteImageUrls?: string[];
      tapImage?: string | null;
      groundBlockImage?: string | null;
      bondingImage?: string | null;
      houseImage?: string | null;
      jobScreenshot: string;
      status: string;
    };
  } catch (error) {
    console.error('Error in getQCImagesByJobAndTechnician:', error);
    throw error;
  }
};

// Get test QC images (for debugging)
export const getTestQCImages = async () => {
  try {
    console.log('Fetching test QC images');
    
    const response = await fetch('/api/test-qc-images', {
      credentials: "include",
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to get test QC images: ${response.status} ${response.statusText}`);
      console.error(`Error details: ${errorText}`);
      throw new Error(`Failed to get test QC images: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Test QC images data received:', data);
    
    return data;
  } catch (error) {
    console.error('Error in getTestQCImages:', error);
    throw error;
  }
};
