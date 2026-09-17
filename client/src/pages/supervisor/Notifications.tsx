import SupervisorNotifications from "@/components/notifications/SupervisorNotifications";

export default function Notifications() {
  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
        <h1 className="admin-title">Notification Settings</h1>
        <p className="admin-subtitle">
          Manage your notification preferences and send reminders to technicians.
        </p>
        </div>
      </div>
      
      <div className="py-4">
        <SupervisorNotifications />
      </div>
    </div>
  );
}
