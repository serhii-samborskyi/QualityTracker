import { useState } from "react";
import { Button } from "@/components/ui/button";

export function UseInstallPrompt() {
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  return { showInstallPrompt, setShowInstallPrompt };
}

export function InstallAppDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-w-sm rounded-lg bg-white p-6 text-gray-900 shadow-xl">
        <h2 className="text-lg font-semibold">Install Quality Tracker</h2>
        <p className="mt-2 text-sm text-gray-600">
          Use your browser menu to install this app on your device.
        </p>
        <Button className="mt-4 w-full" onClick={onClose}>Close</Button>
      </div>
    </div>
  );
}
