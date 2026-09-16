import type { Express, Request, Response, NextFunction, RequestHandler } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import multer from "multer";
import path from "path";
import fs from "fs";
import session from "express-session";
import express from "express";
import { 
  loginSchema, 
  registerSupervisorSchema,
  insertQCPeriodSchema, 
  insertQCSubmissionSchema,
  reviewQCSchema,
  insertStatusIconSchema,
  addTechnicianSchema,
  deleteTechnicianSchema,
  InsertQCPeriod,
  qcSubmissions
} from "@shared/schema";
import { z } from "zod";
import { eq } from "drizzle-orm";

// Extend session types
declare module 'express-session' {
  interface SessionData {
    userId: number;
  }
}

// Configure multer for file uploads
const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), "qualitytracker-uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max size
  },
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png|svg/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Only image files are allowed!"));
  }
});

// Interface for authenticated request
interface AuthenticatedRequest extends Request {
  user: {
    id: number;
    role: string;
  };
}

// Middleware to check if user is authenticated
const isAuthenticated: RequestHandler = async (req, res, next) => {
  const userId = req.session?.userId;
  
  console.log("Session check:", { 
    sessionExists: !!req.session, 
    userId: userId || "not set",
    sessionID: req.sessionID
  });
  
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  const user = await storage.getUser(userId);
  if (!user) {
    console.log(`User with ID ${userId} not found in database`);
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  console.log(`User authenticated: ${user.username} (${user.role})`);
  
  (req as any).user = {
    id: user.id,
    role: user.role
  };
  
  // Refresh the session to extend its life
  if (req.session) {
    req.session.touch();
  }
  
  next();
};

// Middleware to check if user is a supervisor
const isSupervisor: RequestHandler = (req, res, next) => {
  if ((req as any).user?.role !== "supervisor") {
    return res.status(403).json({ message: "Forbidden: Supervisor role required" });
  }
  
  next();
};

// Middleware to check if user is a technician
const isTechnician: RequestHandler = (req, res, next) => {
  if ((req as any).user?.role !== "technician") {
    return res.status(403).json({ message: "Forbidden: Technician role required" });
  }
  
  next();
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up session with PostgreSQL storage
  app.use(
    session({
      store: storage.sessionStore,
      secret: process.env.SESSION_SECRET || 'quality-tracker-secret',
      resave: true, // Changed to true to ensure session is saved
      saveUninitialized: true, // Changed to true to save all sessions
      rolling: true, // Refresh expiration date on each request
      cookie: { 
        secure: false, // Disabled secure for development
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year in milliseconds
        httpOnly: true,
        path: '/',
        sameSite: 'lax' // Changed from 'none' to 'lax' for better compatibility
      }
    })
  );
  
  // Serve uploaded files
  app.use('/uploads', express.static(uploadDir));

  app.get('/api/config/onesignal', (_req, res) => {
    const appId = process.env.ONESIGNAL_APP_ID || process.env.VITE_ONESIGNAL_APP_ID || "";
    res.json({
      appId,
      enabled: Boolean(appId),
    });
  });
  
  // Authentication routes
  app.get('/api/auth/supervisor-registration-status', async (_req, res) => {
    try {
      const users = await storage.getAllUsers();
      const hasSupervisor = users.some(user => user.role === "supervisor");
      const recoveryEnabled = process.env.SUPERVISOR_REGISTRATION_ENABLED === "true";
      const hasRegistrationCode = Boolean(process.env.SUPERVISOR_REGISTRATION_CODE?.trim());

      res.json({
        enabled: !hasSupervisor || recoveryEnabled,
        hasSupervisor,
        requiresCode: hasSupervisor,
        recoveryEnabled,
        hasRegistrationCode,
      });
    } catch (error) {
      console.error("Error checking supervisor registration status:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post('/api/auth/register-supervisor', async (req, res) => {
    try {
      const registrationData = registerSupervisorSchema.parse(req.body);
      const users = await storage.getAllUsers();
      const hasSupervisor = users.some(user => user.role === "supervisor");
      const recoveryEnabled = process.env.SUPERVISOR_REGISTRATION_ENABLED === "true";
      const registrationCode = process.env.SUPERVISOR_REGISTRATION_CODE?.trim();

      if (hasSupervisor && !recoveryEnabled) {
        return res.status(403).json({
          message: "Supervisor registration is disabled. Enable SUPERVISOR_REGISTRATION_ENABLED to create a recovery supervisor.",
        });
      }

      if (hasSupervisor) {
        if (!registrationCode) {
          return res.status(403).json({
            message: "Supervisor recovery registration requires SUPERVISOR_REGISTRATION_CODE.",
          });
        }

        if (registrationData.registrationCode !== registrationCode) {
          return res.status(403).json({ message: "Invalid supervisor registration code" });
        }
      }

      const existingUser = await storage.getUserByUsername(registrationData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Email already in use" });
      }

      const newSupervisor = await storage.createUser({
        username: registrationData.username,
        password: registrationData.password,
        name: registrationData.name,
        role: "supervisor",
        techId: null,
        oneSignalToken: null,
      });

      req.session.userId = newSupervisor.id;
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          return res.status(500).json({ message: "Supervisor created, but login session could not be saved" });
        }

        res.status(201).json({
          id: newSupervisor.id,
          username: newSupervisor.username,
          name: newSupervisor.name,
          role: newSupervisor.role,
        });
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      console.error("Error registering supervisor:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = loginSchema.parse(req.body);
      
      const user = await storage.checkPassword(username, password);
      
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      // Set user in session
      req.session.userId = user.id;
      
      // Explicitly save the session
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          return res.status(500).json({ message: "Error saving session" });
        }
        
        // Return user data after successful session save
        res.json({ 
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role
        });
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Error logging out" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });
  
  app.get('/api/auth/me', isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({ 
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role
      });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Update user credentials endpoint (username and password)
  app.put('/api/auth/credentials', isAuthenticated, isSupervisor, async (req, res) => {
    try {
      const { username, password, confirmPassword } = req.body;
      
      if (!username) {
        return res.status(400).json({ message: "Username is required" });
      }
      
      // If password is being updated, make sure confirmation matches
      if (password) {
        if (!confirmPassword) {
          return res.status(400).json({ message: "Password confirmation is required" });
        }
        
        if (password !== confirmPassword) {
          return res.status(400).json({ message: "Passwords do not match" });
        }
        
        // Simple password validation
        if (password.length < 8) {
          return res.status(400).json({ message: "Password must be at least 8 characters long" });
        }
      }
      
      // Update the user credentials
      const updatedUser = await storage.updateUserCredentials(
        (req as any).user.id,
        username,
        password || undefined
      );
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({ 
        id: updatedUser.id,
        username: updatedUser.username,
        name: updatedUser.name,
        role: updatedUser.role,
        message: "Credentials updated successfully"
      });
    } catch (error: any) {
      if (error.message === "Username already taken") {
        return res.status(400).json({ message: "Username already taken by another user" });
      }
      
      console.error("Error updating credentials:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // QC Period routes (Supervisor only)
  app.post('/api/qc-periods', isAuthenticated, isSupervisor, async (req, res) => {
    try {
      const periodData = insertQCPeriodSchema.parse({
        ...req.body,
        createdById: (req as any).user.id
      });
      
      const newPeriod = await storage.createQCPeriod(periodData);
      
      res.status(201).json(newPeriod);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get('/api/qc-periods', isAuthenticated, async (req, res) => {
    try {
      const periods = await storage.getQCPeriods();
      res.json(periods);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get('/api/qc-periods/current', isAuthenticated, async (req, res) => {
    try {
      const currentPeriod = await storage.getCurrentQCPeriod();
      if (!currentPeriod) {
        return res.status(404).json({ message: "No active QC period found" });
      }
      res.json(currentPeriod);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get('/api/qc-periods/active', isAuthenticated, isSupervisor, async (req, res) => {
    try {
      const activePeriods = await storage.getActiveQCPeriods();
      res.json(activePeriods);
    } catch (error) {
      console.error('Error fetching active QC periods:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get('/api/qc-periods/archived', isAuthenticated, isSupervisor, async (req, res) => {
    try {
      const archivedPeriods = await storage.getArchivedQCPeriods();
      res.json(archivedPeriods);
    } catch (error) {
      console.error('Error fetching archived QC periods:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post('/api/qc-periods', isAuthenticated, isSupervisor, async (req, res) => {
    try {
      const { startDate, endDate, requiredQCs, isActive } = req.body;
      
      if (!startDate || !endDate || !requiredQCs) {
        return res.status(400).json({ message: "Start date, end date, and required QCs are required" });
      }
      
      // Set all existing periods to inactive if this one should be active
      if (isActive) {
        await storage.setActiveQCPeriod(-1); // Deactivate all first
      }
      
      const newPeriod = await storage.createQCPeriod({
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        createdById: (req as any).user.id,
        requiredQCs: Number(requiredQCs),
        isActive: Boolean(isActive),
        isArchived: false
      });
      
      // Set the new period as active if requested
      if (isActive) {
        await storage.setActiveQCPeriod(newPeriod.id);
      }
      
      res.status(201).json(newPeriod);
    } catch (error) {
      console.error('Error creating QC period:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.put('/api/qc-periods/:id', isAuthenticated, isSupervisor, async (req, res) => {
    try {
      const periodId = parseInt(req.params.id, 10);
      if (isNaN(periodId)) {
        return res.status(400).json({ message: "Invalid period ID" });
      }
      
      const { startDate, endDate, requiredQCs, isActive } = req.body;
      const updateData: Partial<InsertQCPeriod> = {};
      
      if (startDate) updateData.startDate = new Date(startDate);
      if (endDate) updateData.endDate = new Date(endDate);
      if (requiredQCs !== undefined) updateData.requiredQCs = Number(requiredQCs);
      
      // Update the period
      const updatedPeriod = await storage.updateQCPeriod(periodId, updateData);
      
      if (!updatedPeriod) {
        return res.status(404).json({ message: "QC period not found" });
      }
      
      // Set this period as the active one if requested
      if (isActive) {
        await storage.setActiveQCPeriod(periodId);
      }
      
      res.json(updatedPeriod);
    } catch (error) {
      console.error('Error updating QC period:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post('/api/qc-periods/:id/set-active', isAuthenticated, isSupervisor, async (req, res) => {
    try {
      const periodId = parseInt(req.params.id, 10);
      if (isNaN(periodId)) {
        return res.status(400).json({ message: "Invalid period ID" });
      }
      
      const success = await storage.setActiveQCPeriod(periodId);
      
      if (!success) {
        return res.status(500).json({ message: "Failed to set period as active" });
      }
      
      res.json({ message: "Period set as active successfully" });
    } catch (error) {
      console.error('Error setting QC period as active:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post('/api/qc-periods/:id/archive', isAuthenticated, isSupervisor, async (req, res) => {
    try {
      const periodId = parseInt(req.params.id, 10);
      if (isNaN(periodId)) {
        return res.status(400).json({ message: "Invalid period ID" });
      }
      
      const success = await storage.archiveQCPeriod(periodId);
      
      if (!success) {
        return res.status(500).json({ message: "Failed to archive period" });
      }
      
      res.json({ message: "Period archived successfully" });
    } catch (error) {
      console.error('Error archiving QC period:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get('/api/qc-periods/:id/submissions', isAuthenticated, isSupervisor, async (req, res) => {
    try {
      const periodId = parseInt(req.params.id, 10);
      if (isNaN(periodId)) {
        return res.status(400).json({ message: "Invalid period ID" });
      }
      
      const submissions = await storage.getQCSubmissionsByPeriodId(periodId);
      res.json(submissions);
    } catch (error) {
      console.error('Error fetching QC submissions for period:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // QC Submission routes
  app.post('/api/qc-submissions', 
    isAuthenticated, 
    isTechnician,
    upload.fields([
      { name: 'tapImage', maxCount: 1 },
      { name: 'groundBlockImage', maxCount: 1 },
      { name: 'bondingImage', maxCount: 1 },
      { name: 'houseImage', maxCount: 1 },
      { name: 'jobScreenshot', maxCount: 1 }
    ]),
    async (req, res) => {
      try {
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        const isApartment = req.body.isApartment === 'true';
        
        // Check required images
        if (!files.tapImage || !files.houseImage || !files.jobScreenshot) {
          return res.status(400).json({ message: "Tap image, house image, and job screenshot are required" });
        }
        
        // For regular installations (not apartments), require ground block and bonding
        if (!isApartment && (!files.groundBlockImage || !files.bondingImage)) {
          return res.status(400).json({ 
            message: "Ground block and bonding images are required for non-apartment installations" 
          });
        }
        
        const currentPeriod = await storage.getCurrentQCPeriod();
        if (!currentPeriod) {
          return res.status(400).json({ message: "No active QC period found" });
        }
        
        // Create submission data with required fields
        const submissionData: any = {
          technicianId: (req as any).user.id,
          periodId: currentPeriod.id,
          jobId: req.body.jobId,
          address: req.body.address,
          tapImage: `/uploads/${files.tapImage[0].filename}`,
          houseImage: `/uploads/${files.houseImage[0].filename}`,
          jobScreenshot: `/uploads/${files.jobScreenshot[0].filename}`
        };
        
        // Add optional fields if present
        if (files.groundBlockImage) {
          submissionData.groundBlockImage = `/uploads/${files.groundBlockImage[0].filename}`;
        }
        
        if (files.bondingImage) {
          submissionData.bondingImage = `/uploads/${files.bondingImage[0].filename}`;
        }
        
        console.log('About to validate submission data:', submissionData);

        // Explicitly set to null (which will be stored as NULL in the database)
        // if the field is missing and it's an apartment installation
        if (isApartment) {
          if (!submissionData.groundBlockImage || submissionData.groundBlockImage === "undefined") {
            submissionData.groundBlockImage = null;
            console.log('Setting groundBlockImage to null for apartment installation');
          }
          
          if (!submissionData.bondingImage || submissionData.bondingImage === "undefined") {
            submissionData.bondingImage = null;
            console.log('Setting bondingImage to null for apartment installation');
          }
        }
        
        const validatedData = insertQCSubmissionSchema.parse(submissionData);
        console.log('Validated data:', validatedData);
        const newSubmission = await storage.createQCSubmission(validatedData);
        
        // Notify supervisors of new submission
        try {
          const { notifySupervisorsOfNewQC } = await import('./onesignal');
          console.log(`Sending notification to supervisors about QC submission ${newSubmission.id}`);
          await notifySupervisorsOfNewQC(newSubmission.id);
          console.log('Notification sent successfully');
        } catch (notifyError) {
          console.error('Error sending notification:', notifyError);
          // Continue even if notification fails
        }
        
        res.status(201).json(newSubmission);
      } catch (error) {
        if (error instanceof z.ZodError) {
          console.error('Validation error:', error.errors);
          return res.status(400).json({ message: error.errors });
        }
        console.error('Error in QC submission:', error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );
  
  app.get('/api/qc-submissions', isAuthenticated, isSupervisor, async (req, res) => {
    try {
      const submissions = await storage.getQCSubmissions();
      res.json(submissions);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get('/api/qc-submissions/pending', isAuthenticated, isSupervisor, async (req, res) => {
    try {
      const pendingSubmissions = await storage.getPendingQCSubmissions();
      res.json(pendingSubmissions);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get('/api/qc-submissions/technician', isAuthenticated, isTechnician, async (req, res) => {
    try {
      const submissions = await storage.getQCSubmissionsByTechnicianId((req as any).user.id);
      res.json(submissions);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Get QC submissions for a specific technician by ID (for supervisors)
  app.get('/api/qc-submissions/technician/:technicianId', isAuthenticated, isSupervisor, async (req, res) => {
    try {
      const technicianId = parseInt(req.params.technicianId, 10);
      if (isNaN(technicianId)) {
        return res.status(400).json({ message: "Invalid technician ID" });
      }
      
      // Check if technician exists
      const technician = await storage.getUser(technicianId);
      if (!technician) {
        return res.status(404).json({ message: "Technician not found" });
      }
      
      const submissions = await storage.getQCSubmissionsByTechnicianId(technicianId);
      res.json(submissions);
    } catch (error) {
      console.error("Error fetching technician QC submissions by ID:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post('/api/qc-submissions/review', isAuthenticated, isSupervisor, async (req, res) => {
    try {
      console.log('Received QC review request:', req.body);
      const reviewData = reviewQCSchema.parse(req.body);
      
      console.log(`Processing review for QC ID: ${reviewData.qcId}, status: ${reviewData.status}`);
      
      const submission = await storage.getQCSubmissionById(reviewData.qcId);
      if (!submission) {
        console.log(`QC submission not found with ID: ${reviewData.qcId}`);
        return res.status(404).json({ message: "QC submission not found" });
      }
      
      console.log(`Found QC submission:`, {
        id: submission.id,
        technicianId: submission.technicianId,
        periodId: submission.periodId,
        currentStatus: submission.status
      });
      
      const updatedSubmission = await storage.updateQCSubmissionStatus(
        reviewData.qcId,
        reviewData.status,
        reviewData.comment
      );
      
      // Check if we have a valid updated submission
      if (!updatedSubmission) {
        console.error('Failed to update QC submission - no submission returned');
        return res.status(500).json({ message: "Failed to update QC submission" });
      }
      
      // Log the success since we know updatedSubmission exists
      console.log('Submission updated successfully:', {
        id: updatedSubmission.id,
        newStatus: updatedSubmission.status,
        technicianId: updatedSubmission.technicianId
      });
      
      // Notify the technician of the review
      try {
        const { notifyTechnicianOfQCReview } = await import('./onesignal');
        console.log(`Sending notification to technician about QC review (status: ${updatedSubmission.status})`);
        await notifyTechnicianOfQCReview(
          updatedSubmission.id,
          updatedSubmission.status,
          updatedSubmission.supervisorComment || undefined
        );
        console.log('Review notification sent successfully');
      } catch (notifyError) {
        console.error('Error sending notification:', notifyError);
        // Continue even if notification fails
      }
      
      // Return the updated submission
      res.json(updatedSubmission);
    } catch (error) {
      console.error('Error processing QC review:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Status Icon routes
  app.post('/api/status-icons', isAuthenticated, isSupervisor, upload.single('icon'), async (req, res) => {
    try {
      console.log('Status icon request:', { 
        name: req.body.name, 
        hasFile: !!req.file, 
        fileSize: req.file ? req.file.size : 0 
      });
      
      // Check if an icon with this name already exists (case insensitive)
      const statusIcons = await storage.getStatusIcons();
      console.log('Found', statusIcons.length, 'existing status icons');
      
      // First try exact name match, then case insensitive
      let existingIcon = statusIcons.find(icon => icon.name === req.body.name);
      if (!existingIcon) {
        existingIcon = statusIcons.find(icon => 
          icon.name.toLowerCase() === req.body.name.toLowerCase()
        );
      }
      
      // If we found an existing icon, this is an update operation
      if (existingIcon) {
        // This is an update to an existing icon
        console.log('Updating existing status icon:', existingIcon.name, 'with ID:', existingIcon.id);
        
        // Keep existing icon path by default
        let iconPath = existingIcon.iconPath;
        
        // If a new file was uploaded, use that instead
        if (req.file) {
          iconPath = `/uploads/${req.file.filename}`;
          console.log('New icon file uploaded, path:', iconPath);
        } else {
          console.log('No new icon file, keeping existing icon path:', iconPath);
        }
        
        // Create the updated icon data
        const iconData = {
          name: req.body.name, // Use the exact case from the request
          iconPath: iconPath
        };
        
        try {
          // Validate and update
          const validatedData = insertStatusIconSchema.parse(iconData);
          const updatedIcon = await storage.updateStatusIcon(existingIcon.id, validatedData);
          
          console.log('Status icon updated successfully:', updatedIcon);
          return res.json(updatedIcon);
        } catch (err) {
          console.error('Error updating status icon:', err);
          return res.status(400).json({ message: "Failed to update status icon" });
        }
      }
      
      // This is a new icon creation (not an update), so file is required
      if (!req.file) {
        console.log('Error: New icon requires an image file');
        return res.status(400).json({ message: "Icon image is required for new status icons" });
      }
      
      try {
        const iconData = {
          name: req.body.name,
          iconPath: `/uploads/${req.file.filename}`
        };
        
        const validatedData = insertStatusIconSchema.parse(iconData);
        const newIcon = await storage.createStatusIcon(validatedData);
        
        console.log('New status icon created:', newIcon);
        res.status(201).json(newIcon);
      } catch (err) {
        console.error('Error creating new status icon:', err);
        return res.status(400).json({ message: "Failed to create status icon" });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('Validation error:', error.errors);
        return res.status(400).json({ message: error.errors });
      }
      console.error('Error handling status icon:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get('/api/status-icons', isAuthenticated, async (req, res) => {
    try {
      const icons = await storage.getStatusIcons();
      res.json(icons);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Endpoint to reset status icons (supervisor only)
  app.post('/api/status-icons/reset', isAuthenticated, isSupervisor, async (req, res) => {
    try {
      console.log('=====================================================');
      console.log('RESETTING STATUS ICONS - START');
      console.log('=====================================================');
      
      // Get existing icons for logging
      const existingIcons = await storage.getStatusIcons();
      console.log('Current status icons before reset:', existingIcons.map(i => ({ id: i.id, name: i.name })));
      
      // Delete all existing icons
      await storage.resetStatusIcons();
      
      // Double-check deletion
      const checkAfterDeletion = await storage.getStatusIcons();
      console.log('Status icons after deletion (should be empty):', checkAfterDeletion.length);
      
      // Initialize the default icons with the 5-level system
      await storage.initDefaultStatusIcons();
      
      // Return the new icons
      const icons = await storage.getStatusIcons();
      console.log('Status icons reset complete. New icons:', icons.map(i => ({ id: i.id, name: i.name })));
      console.log('Total icons created:', icons.length);
      console.log('=====================================================');
      console.log('RESETTING STATUS ICONS - COMPLETE');
      console.log('=====================================================');
      
      res.json(icons);
    } catch (error) {
      console.error("Error resetting status icons:", error);
      res.status(500).json({ message: "Failed to reset status icons" });
    }
  });
  
  // Special endpoint just for updating status icon text
  app.post('/api/status-icons/update-text', isAuthenticated, isSupervisor, async (req, res) => {
    try {
      console.log('Status icon text update request:', req.body);
      
      const { name, newName } = req.body;
      
      if (!name || !newName) {
        return res.status(400).json({ message: "Both name and newName are required" });
      }
      
      // Find the existing icon
      const statusIcons = await storage.getStatusIcons();
      const existingIcon = statusIcons.find(icon => icon.name === name);
      
      if (!existingIcon) {
        return res.status(404).json({ message: "Status icon not found" });
      }
      
      // Update only the name, keep the same icon path
      const updatedIcon = await storage.updateStatusIcon(existingIcon.id, {
        name: newName,
        iconPath: existingIcon.iconPath
      });
      
      console.log('Status icon text updated successfully:', updatedIcon);
      res.json(updatedIcon);
    } catch (error) {
      console.error('Error updating status icon text:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Technician Management Routes
  app.get('/api/technicians', isAuthenticated, isSupervisor, async (req, res) => {
    try {
      const technicians = await storage.getTechnicians();
      res.json(technicians);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post('/api/technicians', isAuthenticated, isSupervisor, async (req, res) => {
    try {
      const technicianData = addTechnicianSchema.parse(req.body);
      
      // Check if the email already exists
      const existingUser = await storage.getUserByUsername(technicianData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Email already in use" });
      }
      
      // Check if tech ID already exists
      const existingTechId = await storage.getUserByTechId(technicianData.techId);
      if (existingTechId) {
        return res.status(400).json({ message: "Tech ID already in use" });
      }
      
      const newTechnician = await storage.createUser({
        username: technicianData.username,
        password: technicianData.password, // Will be hashed in storage
        name: technicianData.name,
        techId: technicianData.techId,
        role: "technician",
        oneSignalToken: null
      });
      
      res.status(201).json(newTechnician);
    } catch (error) {
      console.error("Error creating technician:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.delete('/api/technicians/:id', isAuthenticated, isSupervisor, async (req, res) => {
    try {
      const techId = parseInt(req.params.id, 10);
      if (isNaN(techId)) {
        return res.status(400).json({ message: "Invalid technician ID" });
      }
      
      // Check if technician exists and is actually a technician
      const technician = await storage.getUser(techId);
      if (!technician) {
        return res.status(404).json({ message: "Technician not found" });
      }
      
      if (technician.role !== "technician") {
        return res.status(400).json({ message: "Cannot delete a non-technician user" });
      }
      
      const deleted = await storage.deleteUser(techId);
      if (!deleted) {
        return res.status(500).json({ message: "Failed to delete technician" });
      }
      
      res.status(200).json({ message: "Technician deleted successfully" });
    } catch (error) {
      console.error("Error deleting technician:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Clean QC submissions for a specific technician
  app.delete('/api/technicians/:id/qc-submissions', isAuthenticated, isSupervisor, async (req, res) => {
    try {
      const technicianId = parseInt(req.params.id, 10);
      if (isNaN(technicianId)) {
        return res.status(400).json({ message: "Invalid technician ID" });
      }
      
      // Check if technician exists and is actually a technician
      const technician = await storage.getUser(technicianId);
      if (!technician) {
        return res.status(404).json({ message: "Technician not found" });
      }
      
      if (technician.role !== "technician") {
        return res.status(400).json({ message: "Cannot clean QC submissions for a non-technician user" });
      }
      
      // Get the current QC period
      const currentPeriod = await storage.getCurrentQCPeriod();
      if (!currentPeriod) {
        return res.status(404).json({ message: "No active QC period found" });
      }
      
      // Get all submissions for this technician in the current period
      const submissions = await storage.getQCSubmissionsByTechnicianId(technicianId);
      
      // Delete each submission
      let deletedCount = 0;
      for (const submission of submissions) {
        // We would need to add this method to storage.ts
        const deleted = await db
          .delete(qcSubmissions)
          .where(eq(qcSubmissions.id, submission.id))
          .returning();
        
        if (deleted.length > 0) {
          deletedCount++;
        }
      }
      
      res.status(200).json({ 
        message: `Successfully cleaned ${deletedCount} QC submissions for ${technician.name}`,
        deletedCount
      });
    } catch (error) {
      console.error("Error cleaning QC submissions:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Progress routes
  app.get('/api/technicians/progress', isAuthenticated, isSupervisor, async (req, res) => {
    try {
      const currentPeriod = await storage.getCurrentQCPeriod();
      if (!currentPeriod) {
        return res.status(404).json({ message: "No active QC period found" });
      }
      
      const techniciansProgress = await storage.getAllTechniciansProgress(currentPeriod.id);
      res.json(techniciansProgress);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get('/api/technicians/my-progress', isAuthenticated, isTechnician, async (req, res) => {
    try {
      const currentPeriod = await storage.getCurrentQCPeriod();
      if (!currentPeriod) {
        return res.status(404).json({ message: "No active QC period found" });
      }
      
      const progress = await storage.getTechnicianProgress((req as any).user.id, currentPeriod.id);
      
      const statusIcon = await storage.getStatusIconByName(progress.status);
      
      res.json({
        ...progress,
        currentPeriod,
        statusIcon
      });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // API endpoint to get QC images by job ID and technician ID (or tech_id) - requires supervisor authentication
  app.get('/api/qc-images/:jobId/:techId', isAuthenticated, isSupervisor, async (req, res) => {
    try {
      const jobId = req.params.jobId;
      const techId = req.params.techId;
      
      console.log(`Received request for QC images with jobId=${jobId}, techId=${techId}`);
      
      if (!jobId || !techId) {
        console.log('Invalid parameters provided');
        return res.status(400).json({ 
          message: "Invalid parameters. Job ID and tech ID are required." 
        });
      }
      
      let submission;
      
      // Check if the tech_id is numeric - could be either DB ID or tech_id
      const isNumericId = !isNaN(parseInt(techId, 10));
      
      if (isNumericId) {
        // First try to find by technician database ID
        const technicianId = parseInt(techId, 10);
        submission = await storage.getQCSubmissionByJobIdAndTechId(jobId, technicianId);
        
        if (!submission) {
          // If not found, try to find by tech_id
          const technician = await storage.getUserByTechId(techId);
          if (technician) {
            submission = await storage.getQCSubmissionByJobIdAndTechId(jobId, technician.id);
          }
        }
      } else {
        // Try to find by tech_id string
        const technician = await storage.getUserByTechId(techId);
        if (technician) {
          submission = await storage.getQCSubmissionByJobIdAndTechId(jobId, technician.id);
        }
      }
      
      if (!submission) {
        console.log('No submission found with the provided parameters');
        return res.status(404).json({ 
          message: "No QC submission found with the provided job ID and tech ID" 
        });
      }
      
      // Only show approved QC submissions
      if (submission.status !== 'approved') {
        console.log(`Found submission ${submission.id} but status is ${submission.status}, not approved`);
        return res.status(403).json({
          message: "Only approved QC submissions can be accessed through this API"
        });
      }
      
      console.log(`Found submission: ${submission.id}`);
      
      // Build absolute URLs for the images with proper domain detection
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      const host = req.get('host') || 'localhost:5000';
      const baseUrl = `${protocol}://${host}`;
      
      // Make sure URLs are properly formatted with the domain - use arrow function to avoid strict mode issues
      const getAbsoluteUrl = (relativeUrl: string | null): string => {
        if (!relativeUrl) return '';
        // Check if URL starts with a slash, if not add one
        const normalizedPath = relativeUrl.startsWith('/') ? relativeUrl : `/${relativeUrl}`;
        return `${baseUrl}${normalizedPath}`;
      };
      
      // Return the complete absolute URLs in a JSON response
      const imageUrls = {
        id: submission.id,
        jobId: submission.jobId,
        technicianId: submission.technicianId,
        tapImageUrl: getAbsoluteUrl(submission.tapImage),
        groundBlockImageUrl: getAbsoluteUrl(submission.groundBlockImage),
        bondingImageUrl: getAbsoluteUrl(submission.bondingImage),
        houseImageUrl: getAbsoluteUrl(submission.houseImage),
        jobScreenshotUrl: getAbsoluteUrl(submission.jobScreenshot),
        status: submission.status
      };
      
      console.log('Returning full absolute image URLs');
      res.json(imageUrls);
    } catch (error) {
      console.error('Error fetching QC images:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Test endpoint that works with any parameters for debugging
  app.get('/api/test-qc-images', isAuthenticated, isSupervisor, async (req, res) => {
    try {
      console.log('Test QC images endpoint called');
      
      // Get first submission as a test
      const submissions = await storage.getQCSubmissions();
      
      if (submissions.length === 0) {
        return res.status(404).json({ message: "No submissions found in the system" });
      }
      
      // Find an approved submission for testing
      let submission = submissions.find(sub => sub.status === 'approved');
      if (!submission) {
        // If no approved submissions are found, use the first one but warn in the response
        submission = submissions[0];
        console.log(`No approved submissions found, using ID ${submission.id} with status: ${submission.status}`);
      } else {
        console.log(`Using approved test submission: ${submission.id}`);
      }
      
      // Build absolute URLs for the images with proper domain detection
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      const host = req.get('host') || 'localhost:5000';
      const baseUrl = `${protocol}://${host}`;
      
      // Make sure URLs are properly formatted with the domain - use arrow function to avoid strict mode issues
      const getAbsoluteUrl = (relativeUrl: string | null): string => {
        if (!relativeUrl) return '';
        // Check if URL starts with a slash, if not add one
        const normalizedPath = relativeUrl.startsWith('/') ? relativeUrl : `/${relativeUrl}`;
        return `${baseUrl}${normalizedPath}`;
      };
      
      // Return the complete absolute URLs in a JSON response
      const imageUrls = {
        id: submission.id,
        jobId: submission.jobId,
        technicianId: submission.technicianId,
        tapImageUrl: getAbsoluteUrl(submission.tapImage),
        groundBlockImageUrl: getAbsoluteUrl(submission.groundBlockImage),
        bondingImageUrl: getAbsoluteUrl(submission.bondingImage),
        houseImageUrl: getAbsoluteUrl(submission.houseImage),
        jobScreenshotUrl: getAbsoluteUrl(submission.jobScreenshot),
        status: submission.status
      };
      
      console.log('Returning full absolute image URLs for test');
      res.json(imageUrls);
    } catch (error) {
      console.error('Error in test QC images endpoint:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // OneSignal Token setting
  app.post('/api/settings/onesignal', isAuthenticated, async (req, res) => {
    try {
      const { token } = req.body;
      
      console.log('Received OneSignal token save request:', { 
        userId: (req as any).user.id, 
        token: token,
        tokenLength: token ? token.length : 0
      });
      
      if (!token) {
        return res.status(400).json({ message: "OneSignal token is required" });
      }
      
      const updatedUser = await storage.updateUserOneSignalToken((req as any).user.id, token);
      console.log('Updated user with OneSignal token:', updatedUser);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error saving OneSignal token:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Get OneSignal status
  app.get('/api/settings/onesignal/status', isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).user.id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const isSubscribed = !!user.oneSignalToken && user.oneSignalToken.length > 0;
      
      res.status(200).json({ 
        isSubscribed,
        token: isSubscribed ? user.oneSignalToken : undefined 
      });
    } catch (error) {
      console.error('Error getting OneSignal status:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Remove OneSignal subscription
  app.delete('/api/settings/onesignal', isAuthenticated, async (req, res) => {
    try {
      const user = await storage.updateUserOneSignalToken((req as any).user.id, "");
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      console.log('Removed OneSignal token for user:', user.id);
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error removing OneSignal token:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // OneSignal Subscribe endpoint
  app.post('/api/settings/onesignal/subscribe', isAuthenticated, async (req, res) => {
    try {
      const { token } = req.body;
      
      console.log('OneSignal subscription request:', {
        userId: (req as any).user.id,
        hasToken: !!token
      });

      // If no token is provided in the body, use the existing one from the user
      // or proceed with subscribing without a token (will be set later)
      let oneSignalToken = token;
      
      if (!oneSignalToken) {
        const user = await storage.getUser((req as any).user.id);
        if (user && user.oneSignalToken) {
          oneSignalToken = user.oneSignalToken;
        }
      }
      
      // Update the user with the OneSignal token
      const updatedUser = await storage.updateUserOneSignalToken(
        (req as any).user.id, 
        oneSignalToken || ""
      );
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const isSubscribed = !!updatedUser.oneSignalToken && updatedUser.oneSignalToken.length > 0;
      
      console.log('OneSignal subscription updated:', {
        userId: updatedUser.id,
        isSubscribed,
        tokenLength: updatedUser.oneSignalToken ? updatedUser.oneSignalToken.length : 0
      });
      
      res.status(200).json({ 
        isSubscribed,
        token: isSubscribed ? updatedUser.oneSignalToken : undefined
      });
    } catch (error) {
      console.error('Error in OneSignal subscribe:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // OneSignal Unsubscribe endpoint
  app.post('/api/settings/onesignal/unsubscribe', isAuthenticated, async (req, res) => {
    try {
      const updatedUser = await storage.updateUserOneSignalToken((req as any).user.id, "");
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      console.log('User unsubscribed from OneSignal:', updatedUser.id);
      
      res.status(200).json({ 
        isSubscribed: false
      });
    } catch (error) {
      console.error('Error in OneSignal unsubscribe:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Route to send reminders to technicians who haven't completed their QCs
  app.post('/api/notifications/send-reminders', isAuthenticated, isSupervisor, async (req, res) => {
    try {
      const currentPeriod = await storage.getCurrentQCPeriod();
      
      if (!currentPeriod) {
        return res.status(404).json({ message: 'No active QC period found' });
      }
      
      // Dynamic import to avoid circular dependency issues
      const { sendQCReminders } = await import('./onesignal');
      await sendQCReminders(currentPeriod.id);
      
      res.status(200).json({ message: 'Reminders sent successfully' });
    } catch (error) {
      console.error('Error sending reminders:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });
  
  // Test endpoint to send a push notification to the current user
  app.post('/api/notifications/test', isAuthenticated, async (req, res) => {
    try {
      // Get user's OneSignal token
      const user = await storage.getUser((req as any).user.id);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      if (!user.oneSignalToken) {
        return res.status(400).json({ 
          message: 'No OneSignal token found for this user. Please enable notifications first.' 
        });
      }
      
      // Dynamic import to avoid circular dependency issues
      const { sendPushNotification } = await import('./onesignal');
      const success = await sendPushNotification(
        user.id,
        'Test Notification',
        'This is a test notification from Quality Tracker.',
        { type: 'test' }
      );
      
      if (success) {
        res.status(200).json({ message: 'Test notification sent successfully' });
      } else {
        res.status(500).json({ message: 'Failed to send test notification' });
      }
    } catch (error) {
      console.error('Error sending test notification:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
