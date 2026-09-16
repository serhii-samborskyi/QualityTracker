/**
 * Utility functions for OneSignal integration
 */

// Define types for OneSignal
declare global {
  interface Window {
    OneSignal: any & {
      // Existing methods
      push: (callback: () => void) => void;
      isPushNotificationsEnabled: (callback: (isEnabled: boolean) => void) => void;
      getUserId: () => Promise<string>;
      registerForPushNotifications: (options?: any) => Promise<void>;
      on: (event: string, callback: (data: any) => void) => void;
      init: (options: any) => void;
      showNativePrompt: () => Promise<void> | void;
      showSlidedownPrompt: (options?: any) => void;
      showCategorySlidedown: (options?: any) => void;
      
      // New Notifications API
      Notifications?: {
        permission: Promise<"granted" | "denied" | "default">;
        getSubscription: () => Promise<{id: string}>;
      };
    };
    
    // Add to disable popups
    __ONESIGNAL_DISABLE_PROMPTS: boolean;
    OneSignalDeferred?: Array<(oneSignal: any) => void | Promise<void>>;
    __QUALITY_TRACKER_ONESIGNAL_APP_ID?: string;
    __QUALITY_TRACKER_ONESIGNAL_READY?: boolean;
  }
}

// Stop OneSignal popups globally
if (typeof window !== 'undefined') {
  window.__ONESIGNAL_DISABLE_PROMPTS = true;
}

// Define types for OneSignal status
export interface OneSignalStatus {
  isSubscribed: boolean;
  userId?: string;
  token?: string;
}

/**
 * Check if OneSignal is available in the window
 */
export const isOneSignalAvailable = (): boolean => {
  return typeof window !== 'undefined' && 'OneSignal' in window;
};

const getOneSignal = () => {
  if (!isOneSignalAvailable()) return null;
  return window.OneSignal as any;
};

/**
 * Get the current OneSignal subscription status directly from the browser
 * @returns Promise<OneSignalStatus>
 */
export const getOneSignalStatus = async (): Promise<OneSignalStatus> => {
  if (!isOneSignalAvailable()) {
    return { isSubscribed: false };
  }

  try {
    const oneSignal = getOneSignal();
    const pushSubscription = oneSignal?.User?.PushSubscription;

    if (pushSubscription) {
      const token = pushSubscription.id || pushSubscription.token;
      const optedIn = Boolean(pushSubscription.optedIn ?? token);
      return {
        isSubscribed: optedIn && Boolean(token),
        userId: token,
        token,
      };
    }

    // Get subscription status
    const isSubscribed = await new Promise<boolean>((resolve) => {
      window.OneSignal.isPushNotificationsEnabled((isEnabled: boolean) => {
        resolve(isEnabled);
      });
    });

    // If subscribed, get the userId
    let userId: string | undefined;
    if (isSubscribed) {
      try {
        userId = await window.OneSignal.getUserId();
      } catch (error) {
        console.error('Error getting OneSignal user ID:', error);
      }
    }

    return { isSubscribed, userId };
  } catch (error) {
    console.error('Error checking OneSignal status:', error);
    return { isSubscribed: false };
  }
};

/**
 * Request OneSignal permission
 * @returns Promise<boolean> - Whether the subscription was successful
 */
export const requestOneSignalPermission = async (): Promise<boolean> => {
  if (!isOneSignalAvailable()) {
    console.error('OneSignal not available');
    return false;
  }

  console.log('Requesting OneSignal permission...');

  try {
    const oneSignal = getOneSignal();
    const pushSubscription = oneSignal?.User?.PushSubscription;

    if (oneSignal?.Notifications?.requestPermission) {
      window.__ONESIGNAL_DISABLE_PROMPTS = false;
      const permission = await oneSignal.Notifications.requestPermission();
      if (permission !== true && permission !== "granted") {
        window.__ONESIGNAL_DISABLE_PROMPTS = true;
        return false;
      }

      if (pushSubscription?.optIn) {
        await pushSubscription.optIn();
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
      window.__ONESIGNAL_DISABLE_PROMPTS = true;
      return (await getOneSignalStatus()).isSubscribed;
    }

    // Show prompt approach - actually request permissions
    await new Promise<void>((resolve) => {
      window.OneSignal.push(() => {
        console.log('Requesting notification permission with native browser prompt');
        
        // Temporary remove global disabling flag to allow the prompt
        window.__ONESIGNAL_DISABLE_PROMPTS = false;
        
        // Force the native browser prompt to show
        Promise.resolve(window.OneSignal.showNativePrompt())
          .then(() => {
            console.log('Native prompt shown');
          })
          .catch((err: unknown) => {
            console.error('Error showing native prompt:', err);
          });
        
        // Also try registering directly
        window.OneSignal.registerForPushNotifications({
          modalPrompt: true, // Try using OneSignal's custom prompt too
          httpPermissionRequest: {
            enable: true // Try HTTP prompt as well
          }
        }).then(() => {
          console.log('Browser prompt registration successful');
          resolve();
        }).catch((error: any) => {
          console.error('Error with browser registration:', error);
          resolve(); // Resolve anyway to continue
        }).finally(() => {
          // Re-enable the global disabling flag after this explicit request
          window.__ONESIGNAL_DISABLE_PROMPTS = true;
        });
      });
    });

    // Wait a moment for OneSignal to update internal state
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check if the registration was successful
    const status = await getOneSignalStatus();
    console.log('OneSignal status after registration:', status);
    
    return status.isSubscribed;
  } catch (error) {
    console.error('Error requesting OneSignal permission:', error);
    return false;
  }
};
