import { useEffect } from "react";
import { getOneSignalConfig } from "@/lib/api";

const SDK_ID = "onesignal-sdk";

export default function OneSignalInitializer() {
  useEffect(() => {
    let cancelled = false;

    async function initializeOneSignal() {
      try {
        const config = await getOneSignalConfig();
        if (cancelled || !config.enabled || !config.appId) return;

        window.__QUALITY_TRACKER_ONESIGNAL_APP_ID = config.appId;

        const initWithSdk = async (oneSignal: any) => {
          if (cancelled || window.__QUALITY_TRACKER_ONESIGNAL_READY) return;

          try {
            window.OneSignal = oneSignal;
            await oneSignal.init({
              appId: config.appId,
              allowLocalhostAsSecureOrigin: true,
              notifyButton: { enable: false },
              promptOptions: {
                slidedown: {
                  enabled: false,
                },
              },
            });
            window.__QUALITY_TRACKER_ONESIGNAL_READY = true;
          } catch (error) {
            console.error("OneSignal initialization failed:", error);
          }
        };

        const init = () => {
          window.OneSignalDeferred = window.OneSignalDeferred || [];
          window.OneSignalDeferred.push(initWithSdk);
        };

        const existingScript = document.getElementById(SDK_ID);
        if (existingScript) {
          init();
          return;
        }

        window.OneSignalDeferred = window.OneSignalDeferred || [];
        const script = document.createElement("script");
        script.id = SDK_ID;
        script.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
        script.async = true;
        init();
        document.head.appendChild(script);
      } catch (error) {
        console.error("Unable to load OneSignal configuration:", error);
      }
    }

    initializeOneSignal();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
