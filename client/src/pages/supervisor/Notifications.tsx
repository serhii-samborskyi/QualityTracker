import SupervisorNotifications from "@/components/notifications/SupervisorNotifications";

export default function Notifications() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="py-4">
        <h1 className="text-2xl font-semibold text-gray-900">Notification Settings</h1>
        <p className="mt-2 text-sm text-gray-500">
          Manage your notification preferences and send reminders to technicians.
        </p>
      </div>
      
      <div className="py-4">
        <SupervisorNotifications />
      </div>
    </div>
  );
}