import { storage } from './storage';
import { User } from '@shared/schema';
import { log } from './vite';

// Get OneSignal credentials from environment variables
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID || '';
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY || '';

// Check if we have required configuration
if (!ONESIGNAL_APP_ID || !ONESIGNAL_API_KEY) {
  log('WARNING: OneSignal environment variables are missing or incomplete. Notifications will not work.', 'onesignal');
} else {
  log(`OneSignal configured with App ID: ${ONESIGNAL_APP_ID.substring(0, 8)}...`, 'onesignal');
  log(`OneSignal API Key available: ${ONESIGNAL_API_KEY ? 'Yes' : 'No'}`, 'onesignal');
}

// We'll use the fetch API directly to communicate with OneSignal
// instead of using the SDK which requires more complex configuration
// No need to initialize a client

// Function to send push notification to a specific user
export async function sendPushNotification(
  userId: number, 
  title: string, 
  message: string, 
  data?: Record<string, any>
): Promise<boolean> {
  try {
    // Check that we have API key and App ID
    if (!ONESIGNAL_APP_ID || !ONESIGNAL_API_KEY) {
      log('Cannot send push notification: OneSignal not configured', 'onesignal');
      return false;
    }
    
    const user = await storage.getUser(userId);
    if (!user) {
      log(`User ${userId} not found`, 'onesignal');
      return false;
    }
    
    if (!user.oneSignalToken) {
      log(`User ${userId} (${user.username}) has no OneSignal token registered`, 'onesignal');
      return false;
    }
    
    // Create notification
    const notification: any = {
      app_id: ONESIGNAL_APP_ID,
      include_player_ids: [user.oneSignalToken],
      headings: { en: title },
      contents: { en: message }
    };
    
    if (data) {
      notification.data = data;
    }
    
    log(`Sending notification to user ${userId} (${user.username}) with token: ${user.oneSignalToken.substring(0, 8)}...`, 'onesignal');
    
    log(`Using OneSignal API key: ${ONESIGNAL_API_KEY ? ONESIGNAL_API_KEY.substring(0, 5) + '...' : 'NOT PROVIDED'}`, 'onesignal');
    
    // Use fetch for the OneSignal REST API directly
    // API v2 app endpoint uses the REST API key directly without Basic auth
    log('Sending notification with REST API key...', 'onesignal');
    
    // Use the current OneSignal API format
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${ONESIGNAL_API_KEY}`
      },
      body: JSON.stringify(notification)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      log(`OneSignal API error: ${response.status} - ${errorText}`, 'onesignal');
      return false;
    }
    
    const responseData = await response.json();
    log(`OneSignal API response: ${JSON.stringify(responseData)}`, 'onesignal');
    
    // Check if there were any errors in the response
    if (responseData.errors && responseData.errors.length > 0) {
      const errorMessages = responseData.errors.join(', ');
      log(`OneSignal warning: ${errorMessages}`, 'onesignal');
      
      // Special handling for common issues
      if (errorMessages.includes('not subscribed')) {
        log('Player token is not subscribed. User may need to accept browser notifications.', 'onesignal');
        // We still return true since the API call itself was successful
      }
    }
    
    // Return true even with warnings since the API call was successful
    return true;
  } catch (error) {
    log(`Error sending push notification: ${error}`, 'onesignal');
    return false;
  }
}

// Function to send notification to technicians who haven't submitted all required QCs
export async function sendQCReminders(periodId: number): Promise<void> {
  try {
    const currentPeriod = await storage.getQCPeriodById(periodId);
    
    if (!currentPeriod) {
      console.log(`QC period ${periodId} not found`);
      return;
    }
    
    // Get all technicians with their progress
    const techniciansProgress = await storage.getAllTechniciansProgress(periodId);
    
    for (const progress of techniciansProgress) {
      // Only remind technicians who haven't completed all QCs
      if (progress.submittedCount < progress.requiredCount) {
        // Calculate remaining QCs
        const remaining = progress.requiredCount - progress.submittedCount;
        
        // Send reminder
        await sendPushNotification(
          progress.technician.id,
          'QC Submission Reminder',
          `You still need to submit ${remaining} more QC${remaining > 1 ? 's' : ''} by ${new Date(currentPeriod.endDate).toLocaleDateString()}.`,
          { 
            type: 'qc_reminder', 
            periodId,
            url: '/technician/submit' // Add explicit URL for direct navigation
          }
        );
      }
    }
  } catch (error) {
    console.error('Error sending QC reminders:', error);
  }
}

// Function to notify supervisors about new QC submissions
export async function notifySupervisorsOfNewQC(qcSubmissionId: number): Promise<void> {
  try {
    // Get submission details
    const submission = await storage.getQCSubmissionById(qcSubmissionId);
    
    if (!submission) {
      console.log(`QC submission ${qcSubmissionId} not found`);
      return;
    }
    
    // Get technician details
    const technician = await storage.getUser(submission.technicianId);
    
    if (!technician) {
      console.log(`Technician ${submission.technicianId} not found`);
      return;
    }
    
    // Get all supervisors
    const users = await storage.getAllUsers();
    const supervisors = users.filter(user => user.role === 'supervisor' && user.oneSignalToken);
    
    // Send notification to each supervisor with formatted technician info
    const techId = technician.techId || '';
    const technicianFullName = technician.name;

    for (const supervisor of supervisors) {
      // Format: "First Last (1234) just uploaded QC for job 5678" 
      const message = `${technicianFullName} (${techId}) just uploaded QC for job ${submission.jobId}`;
      
      await sendPushNotification(
        supervisor.id,
        'New QC Submission',
        message,
        { 
          type: 'new_qc', 
          submissionId: qcSubmissionId,
          url: '/supervisor/review' // Add explicit URL to ensure notification redirects properly
        }
      );
    }
  } catch (error) {
    console.error('Error notifying supervisors of new QC:', error);
  }
}

// Function to notify technician about QC review
export async function notifyTechnicianOfQCReview(
  qcSubmissionId: number, 
  status: string, 
  comment?: string
): Promise<void> {
  try {
    // Get submission details
    const submission = await storage.getQCSubmissionById(qcSubmissionId);
    
    if (!submission) {
      console.log(`QC submission ${qcSubmissionId} not found`);
      return;
    }
    
    // Get supervisor who reviewed the QC
    const supervisor = await storage.getUser((await storage.getCurrentSupervisor()) || 1); // Fallback to ID 1 if not found
    const supervisorName = supervisor ? supervisor.name : "your Supervisor";
    
    // Get job ID
    const jobId = submission.jobId;
    
    if (status === 'approved') {
      // For approved QCs
      // Format: "Your QC for job 1234 has been approved by John Smith"
      const message = `Your QC for job ${jobId} has been approved by ${supervisorName}`;
      
      await sendPushNotification(
        submission.technicianId,
        'QC Approved',
        message,
        { 
          type: 'qc_review', 
          submissionId: qcSubmissionId, 
          status,
          url: '/technician/submissions'
        }
      );
    } else {
      // For declined QCs with supervisor comment
      let message;
      
      if (comment && comment.trim()) {
        // Format: "QC Declined: Needs better photo quality (job 1234)"
        message = `QC Declined: ${comment} (job ${jobId})`;
      } else {
        // Format without comment: "QC Declined: Your QC for job 1234 has been declined by John Smith"
        message = `QC Declined: Your QC for job ${jobId} has been declined by ${supervisorName}`;
      }
      
      await sendPushNotification(
        submission.technicianId,
        'QC Declined',
        message,
        { 
          type: 'qc_review', 
          submissionId: qcSubmissionId, 
          status,
          url: '/technician/submissions'
        }
      );
    }
  } catch (error) {
    console.error('Error notifying technician of QC review:', error);
  }
}