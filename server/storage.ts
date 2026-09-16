import { 
  User, InsertUser, 
  QCPeriod, InsertQCPeriod, 
  QCSubmission, InsertQCSubmission,
  StatusIcon, InsertStatusIcon,
  users, qcPeriods, qcSubmissions, statusIcons
} from "@shared/schema";
import { db, pool } from "./db";
import { eq, and, desc, gte, lt } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

const PostgresSessionStore = connectPg(session);

// Set up table name and schema explicitly
const SESSION_TABLE = 'session';

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByTechId(techId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserOneSignalToken(userId: number, token: string): Promise<User | undefined>;
  updateUserCredentials(userId: number, username: string, password?: string): Promise<User | undefined>;
  checkPassword(username: string, password: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  getTechnicians(): Promise<User[]>;
  deleteUser(id: number): Promise<boolean>;
  getCurrentSupervisor(): Promise<number | undefined>; // Returns the ID of the current active supervisor
  
  // QC Period methods
  createQCPeriod(qcPeriod: InsertQCPeriod): Promise<QCPeriod>;
  getQCPeriods(): Promise<QCPeriod[]>;
  getCurrentQCPeriod(): Promise<QCPeriod | undefined>;
  getQCPeriodById(id: number): Promise<QCPeriod | undefined>;
  getArchivedQCPeriods(): Promise<QCPeriod[]>;
  getActiveQCPeriods(): Promise<QCPeriod[]>;
  archiveQCPeriod(id: number): Promise<boolean>;
  updateQCPeriod(id: number, data: Partial<InsertQCPeriod>): Promise<QCPeriod | undefined>;
  setActiveQCPeriod(id: number): Promise<boolean>;
  
  // QC Submission methods
  createQCSubmission(submission: InsertQCSubmission): Promise<QCSubmission>;
  getQCSubmissions(): Promise<QCSubmission[]>;
  getQCSubmissionById(id: number): Promise<QCSubmission | undefined>;
  getPendingQCSubmissions(): Promise<QCSubmission[]>;
  getQCSubmissionsByTechnicianId(technicianId: number): Promise<QCSubmission[]>;
  getQCSubmissionsByPeriodId(periodId: number): Promise<QCSubmission[]>;
  getQCSubmissionByJobIdAndTechId(jobId: string, technicianId: number): Promise<QCSubmission | undefined>;
  updateQCSubmissionStatus(id: number, status: string, comment?: string): Promise<QCSubmission | undefined>;
  
  // Status Icon methods
  createStatusIcon(statusIcon: InsertStatusIcon): Promise<StatusIcon>;
  getStatusIcons(): Promise<StatusIcon[]>;
  getStatusIconByName(name: string): Promise<StatusIcon | undefined>;
  updateStatusIcon(id: number, statusIcon: InsertStatusIcon): Promise<StatusIcon>;
  
  // Technician progress methods
  getTechnicianProgress(technicianId: number, periodId: number): Promise<{ 
    submittedCount: number; 
    requiredCount: number; 
    status: string;
  }>;
  
  // Get all technicians with their progress
  getAllTechniciansProgress(periodId: number): Promise<{
    technician: User;
    submittedCount: number;
    requiredCount: number;
    status: string;
  }[]>;
  
  // Session store
  sessionStore: session.Store;
  
  // Init default data
  initDefaultData(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;
  
  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      tableName: SESSION_TABLE,
      createTableIfMissing: true,
      // Custom options that might not be in the type definitions
      ...(({
        pruneSessionInterval: false  // Disable automatic pruning of old sessions
      } as any))
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async checkPassword(username: string, password: string): Promise<User | undefined> {
    const user = await this.getUserByUsername(username);
    if (!user) return undefined;
    
    const isValid = await comparePasswords(password, user.password);
    return isValid ? user : undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // Hash the password if it's provided
    if (insertUser.password) {
      insertUser.password = await hashPassword(insertUser.password);
    }
    
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUserOneSignalToken(userId: number, token: string): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set({ oneSignalToken: token })
      .where(eq(users.id, userId))
      .returning();
    return updatedUser;
  }
  
  async updateUserCredentials(userId: number, username: string, password?: string): Promise<User | undefined> {
    try {
      // First check if username is already taken by another user
      const existingUser = await this.getUserByUsername(username);
      if (existingUser && existingUser.id !== userId) {
        throw new Error("Username already taken");
      }
      
      // Prepare update data
      const updateData: Partial<User> = { username };
      
      // If password is provided, hash it
      if (password) {
        updateData.password = await hashPassword(password);
      }
      
      // Update the user
      const [updatedUser] = await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, userId))
        .returning();
        
      return updatedUser;
    } catch (error) {
      console.error("Error updating user credentials:", error);
      throw error;
    }
  }
  
  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }
  
  async getUserByTechId(techId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.techId, techId));
    return user;
  }
  
  async getTechnicians(): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(eq(users.role, "technician"))
      .orderBy(users.name);
  }
  
  async getCurrentSupervisor(): Promise<number | undefined> {
    try {
      // In a real-world scenario, we might have a way to track which supervisor is "active"
      // For now, we'll just return the first supervisor we find
      const supervisors = await db
        .select()
        .from(users)
        .where(eq(users.role, "supervisor"))
        .limit(1);
      
      if (supervisors.length > 0) {
        return supervisors[0].id;
      }
      
      return undefined;
    } catch (error) {
      console.error("Error getting current supervisor:", error);
      return undefined;
    }
  }
  
  async deleteUser(id: number): Promise<boolean> {
    try {
      // First check if user exists
      const user = await this.getUser(id);
      if (!user) return false;
      
      // Delete user
      const result = await db
        .delete(users)
        .where(eq(users.id, id));
      
      return true;
    } catch (error) {
      console.error("Error deleting user:", error);
      return false;
    }
  }

  // QC Period methods
  async createQCPeriod(qcPeriod: InsertQCPeriod): Promise<QCPeriod> {
    const [period] = await db.insert(qcPeriods).values(qcPeriod).returning();
    return period;
  }

  async getQCPeriods(): Promise<QCPeriod[]> {
    return await db.select().from(qcPeriods).orderBy(desc(qcPeriods.startDate));
  }

  async getCurrentQCPeriod(): Promise<QCPeriod | undefined> {
    try {
      // First try to find the active period
      const [activePeriod] = await db
        .select()
        .from(qcPeriods)
        .where(eq(qcPeriods.isActive, true))
        .limit(1);
      
      if (activePeriod) {
        return activePeriod;
      }
      
      // Fallback to the date-based check if no explicitly active period
      const now = new Date();
      
      // Get all periods that are not archived
      const periods = await db
        .select()
        .from(qcPeriods)
        .where(eq(qcPeriods.isArchived, false));
      
      // Then filter in JavaScript - this is less efficient but avoids SQL dialect issues
      const currentPeriod = periods.find(
        period => 
          new Date(period.startDate) <= now && 
          new Date(period.endDate) >= now
      );
      
      return currentPeriod;
    } catch (error) {
      console.error("Error in getCurrentQCPeriod:", error);
      return undefined;
    }
  }

  async getQCPeriodById(id: number): Promise<QCPeriod | undefined> {
    const [period] = await db.select().from(qcPeriods).where(eq(qcPeriods.id, id));
    return period;
  }
  
  async getArchivedQCPeriods(): Promise<QCPeriod[]> {
    return await db
      .select()
      .from(qcPeriods)
      .where(eq(qcPeriods.isArchived, true))
      .orderBy(desc(qcPeriods.endDate));
  }
  
  async getActiveQCPeriods(): Promise<QCPeriod[]> {
    return await db
      .select()
      .from(qcPeriods)
      .where(eq(qcPeriods.isArchived, false))
      .orderBy(desc(qcPeriods.startDate));
  }
  
  async archiveQCPeriod(id: number): Promise<boolean> {
    try {
      await db
        .update(qcPeriods)
        .set({ 
          isArchived: true,
          isActive: false
        })
        .where(eq(qcPeriods.id, id));
      return true;
    } catch (error) {
      console.error("Error archiving QC period:", error);
      return false;
    }
  }
  
  /**
   * Update a QC period with new data. If the start date is changed, this will:
   * 1. Create or update an archived period for submissions before the new start date
   * 2. Ensure all submissions are assigned to the correct period
   */
  async updateQCPeriod(id: number, data: Partial<InsertQCPeriod>): Promise<QCPeriod | undefined> {
    try {
      // Get the current period data before updating
      const existingPeriod = await this.getQCPeriodById(id);
      if (!existingPeriod) {
        console.error("Cannot update non-existent QC period");
        return undefined;
      }

      // Update the period with the new data
      const [updatedPeriod] = await db
        .update(qcPeriods)
        .set(data)
        .where(eq(qcPeriods.id, id))
        .returning();
      
      // If the start date has changed, we need to move older submissions to an archived period
      if (data.startDate && existingPeriod.startDate !== data.startDate) {
        const newStartDate = new Date(data.startDate);
        const oldStartDate = new Date(existingPeriod.startDate);
        
        // If the new start date is after the old one, we need to archive older submissions
        if (newStartDate > oldStartDate) {
          console.log(`Start date changed from ${oldStartDate.toISOString()} to ${newStartDate.toISOString()}`);
          
          // Find submissions that were created before the new start date
          const oldSubmissions = await db
            .select()
            .from(qcSubmissions)
            .where(
              and(
                eq(qcSubmissions.periodId, id),
                lt(qcSubmissions.createdAt, newStartDate)
              )
            );
            
          if (oldSubmissions.length > 0) {
            console.log(`Found ${oldSubmissions.length} submissions before the new start date`);
            
            // Check if there's an archived period that ends right before this one starts
            let archivedPeriodId: number;
            
            // Look for an existing archived period that ends right before the new start date
            const [existingArchivedPeriod] = await db
              .select()
              .from(qcPeriods)
              .where(
                and(
                  eq(qcPeriods.isArchived, true),
                  eq(qcPeriods.endDate, new Date(new Date(newStartDate).setDate(newStartDate.getDate() - 1)))
                )
              );
            
            if (existingArchivedPeriod) {
              archivedPeriodId = existingArchivedPeriod.id;
              console.log(`Using existing archived period ${archivedPeriodId}`);
            } else {
              // Create a new archived period for the old submissions
              const archivedPeriod = await this.createQCPeriod({
                startDate: oldStartDate,
                endDate: new Date(new Date(newStartDate).setDate(newStartDate.getDate() - 1)),
                createdById: existingPeriod.createdById,
                requiredQCs: existingPeriod.requiredQCs,
                isActive: false,
                isArchived: true
              });
              
              archivedPeriodId = archivedPeriod.id;
              console.log(`Created new archived period ${archivedPeriodId}`);
            }
            
            // Update the old submissions to be part of the archived period
            for (const submission of oldSubmissions) {
              await db
                .update(qcSubmissions)
                .set({ periodId: archivedPeriodId })
                .where(eq(qcSubmissions.id, submission.id));
            }
            
            console.log(`Moved ${oldSubmissions.length} submissions to archived period ${archivedPeriodId}`);
          }
        }
      }
      
      return updatedPeriod;
    } catch (error) {
      console.error("Error updating QC period:", error);
      return undefined;
    }
  }
  
  async setActiveQCPeriod(id: number): Promise<boolean> {
    try {
      // First deactivate all periods
      await db
        .update(qcPeriods)
        .set({ isActive: false })
        .where(eq(qcPeriods.isArchived, false));
      
      // Then activate the specified period
      await db
        .update(qcPeriods)
        .set({ isActive: true })
        .where(eq(qcPeriods.id, id));
      
      return true;
    } catch (error) {
      console.error("Error setting active QC period:", error);
      return false;
    }
  }

  // QC Submission methods
  async createQCSubmission(submission: InsertQCSubmission): Promise<QCSubmission> {
    const [newSubmission] = await db
      .insert(qcSubmissions)
      .values({
        ...submission,
        status: 'pending',
        supervisorComment: null,
        createdAt: new Date()
      })
      .returning();
    return newSubmission;
  }

  async getQCSubmissions(): Promise<QCSubmission[]> {
    return await db.select().from(qcSubmissions).orderBy(desc(qcSubmissions.createdAt));
  }

  async getQCSubmissionById(id: number): Promise<QCSubmission | undefined> {
    const [submission] = await db.select().from(qcSubmissions).where(eq(qcSubmissions.id, id));
    return submission;
  }

  async getPendingQCSubmissions(): Promise<QCSubmission[]> {
    // Get the current active period
    const currentPeriod = await this.getCurrentQCPeriod();
    
    if (!currentPeriod) {
      return [];
    }
    
    // Get all QC submissions that are pending and within the current period date range
    const currentPeriodStartDate = new Date(currentPeriod.startDate);
    
    return await db
      .select()
      .from(qcSubmissions)
      .where(
        and(
          eq(qcSubmissions.status, 'pending'),
          gte(qcSubmissions.createdAt, currentPeriodStartDate)
        )
      )
      .orderBy(desc(qcSubmissions.createdAt));
  }

  async getQCSubmissionsByTechnicianId(technicianId: number, filterByCurrentPeriod: boolean = true): Promise<QCSubmission[]> {
    // If filtering by current period, we need to get the current period first
    if (filterByCurrentPeriod) {
      const currentPeriod = await this.getCurrentQCPeriod();
      
      if (currentPeriod) {
        const currentPeriodStartDate = new Date(currentPeriod.startDate);
        
        return await db
          .select()
          .from(qcSubmissions)
          .where(
            and(
              eq(qcSubmissions.technicianId, technicianId),
              gte(qcSubmissions.createdAt, currentPeriodStartDate)
            )
          )
          .orderBy(desc(qcSubmissions.createdAt));
      }
    }
    
    // If not filtering or no current period, return all submissions for this technician
    return await db
      .select()
      .from(qcSubmissions)
      .where(eq(qcSubmissions.technicianId, technicianId))
      .orderBy(desc(qcSubmissions.createdAt));
  }

  async getQCSubmissionsByPeriodId(periodId: number): Promise<QCSubmission[]> {
    return await db
      .select()
      .from(qcSubmissions)
      .where(eq(qcSubmissions.periodId, periodId))
      .orderBy(desc(qcSubmissions.createdAt));
  }

  async getQCSubmissionByJobIdAndTechId(jobId: string, technicianId: number): Promise<QCSubmission | undefined> {
    try {
      const [submission] = await db
        .select()
        .from(qcSubmissions)
        .where(
          and(
            eq(qcSubmissions.jobId, jobId),
            eq(qcSubmissions.technicianId, technicianId)
          )
        );
      return submission;
    } catch (error) {
      console.error(`Error getting QC submission by jobId ${jobId} and technicianId ${technicianId}:`, error);
      return undefined;
    }
  }

  async updateQCSubmissionStatus(id: number, status: string, comment?: string): Promise<QCSubmission | undefined> {
    // Create a safe update object with only the fields that exist in the database
    const updateData = {
      status,
      supervisorComment: comment || null
    };
    
    console.log(`Updating QC submission ${id} with status: ${status}, comment: ${comment || 'none'}`);
    
    const [updatedSubmission] = await db
      .update(qcSubmissions)
      .set(updateData)
      .where(eq(qcSubmissions.id, id))
      .returning();
    
    return updatedSubmission;
  }

  // Status Icon methods
  async createStatusIcon(statusIcon: InsertStatusIcon): Promise<StatusIcon> {
    const [newIcon] = await db.insert(statusIcons).values(statusIcon).returning();
    return newIcon;
  }

  async getStatusIcons(): Promise<StatusIcon[]> {
    return await db.select().from(statusIcons);
  }

  async getStatusIconByName(name: string): Promise<StatusIcon | undefined> {
    const [icon] = await db.select().from(statusIcons).where(eq(statusIcons.name, name));
    return icon;
  }
  
  async updateStatusIcon(id: number, statusIcon: InsertStatusIcon): Promise<StatusIcon> {
    const [updatedIcon] = await db
      .update(statusIcons)
      .set(statusIcon)
      .where(eq(statusIcons.id, id))
      .returning();
    return updatedIcon;
  }
  
  // Reset all status icons by deleting them
  async resetStatusIcons(): Promise<void> {
    console.log("STARTING STATUS ICON RESET OPERATION");
    
    try {
      // Delete all existing icons first
      await db.delete(statusIcons);
      console.log("All existing status icons deleted successfully");
    } catch (error) {
      console.error("Error deleting existing status icons:", error);
    }
    
    console.log("All status icons have been reset");
  }
  
  // Initialize default status icons only (separate from initDefaultData)
  async initDefaultStatusIcons(): Promise<void> {
    // QC Misser (red) - 0 QCs
    await this.createStatusIcon({
      name: "QC Misser",
      iconPath: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTEyIDIyYzUuNTIzIDAgMTAtNC40NzcgMTAtMTBTMTcuNTIzIDIgMTIgMiAyIDYuNDc3IDIgMTJzNC40NzcgMTAgMTAgMTB6IiBmaWxsPSIjRUIyRjJGIi8+PHBhdGggZD0iTTE1IDE2SDlNOSA4bDYgMm0wLTJsLTYgMiIgc3Ryb2tlPSIjRkZGIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjwvc3ZnPg=="
    });
    
    // Cable Keeper (black) - 1 QC
    await this.createStatusIcon({
      name: "Cable Keeper",
      iconPath: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTEyIDIyYzUuNTIzIDAgMTAtNC40NzcgMTAtMTBTMTcuNTIzIDIgMTIgMiAyIDYuNDc3IDIgMTJzNC40NzcgMTAgMTAgMTB6IiBmaWxsPSIjMDAwMDAwIi8+PHBhdGggZD0iTTExLjkgMTZjLTMgMC00LTAtNC0yLjUgMC0yLjUgMC0zIDIuNS0zIDIuNSAwIDMgMCAzIDIuNVYxNnpNMTQuNCAxMi41YzAtMi41IDAtMy0yLjUtMyIgc3Ryb2tlPSIjRkZGIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjwvc3ZnPg=="
    });
    
    // Ladder Expert (yellow) - 2 QCs
    await this.createStatusIcon({
      name: "Ladder Expert",
      iconPath: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTEyIDIyYzUuNTIzIDAgMTAtNC40NzcgMTAtMTBTMTcuNTIzIDIgMTIgMiAyIDYuNDc3IDIgMTJzNC40NzcgMTAgMTAgMTB6IiBmaWxsPSIjRjZDMDAwIi8+PHBhdGggZD0iTTEwIDhoNGwtMiA0aDJsLTIgNGgybC0zIDQiIHN0cm9rZT0iI0ZGRiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48L3N2Zz4="
    });
    
    // Signal Master (blue) - 3 QCs
    await this.createStatusIcon({
      name: "Signal Master",
      iconPath: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTEyIDIyYzUuNTIzIDAgMTAtNC40NzcgMTAtMTBTMTcuNTIzIDIgMTIgMiAyIDYuNDc3IDIgMTJzNC40NzcgMTAgMTAgMTB6IiBmaWxsPSIjMjI4QkU2Ii8+PHBhdGggZD0iTTggOGwxLjUgMS41TDggMTFsMS41IDEuNUw4IDE0bDEuNSAxLjVMOCAxN003IDEyaDF2MWgtMXYtMXpNMTUgOGgtMXYxaDF2LTF6TTE3IDhsLTEuNSAxLjVMMTcgMTFsLTEuNSAxLjVMMTcgMTRsLTEuNSAxLjVMMTcgMTciIHN0cm9rZT0iI0ZGRiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48L3N2Zz4="
    });
    
    // Gigabit Guru (green) - 4+ QCs
    await this.createStatusIcon({
      name: "Gigabit Guru",
      iconPath: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTEyIDIyYzUuNTIzIDAgMTAtNC40NzcgMTAtMTBTMTcuNTIzIDIgMTIgMiAyIDYuNDc3IDIgMTJzNC40NzcgMTAgMTAgMTB6IiBmaWxsPSIjMjVDMTY4Ii8+PHBhdGggZD0iTTggMTFsMi41LTNMOCBNMTYgOGgtM3Y4aDN2LTR6IiBzdHJva2U9IiNGRkYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PC9zdmc+"
    });
    
    console.log("Default status icons have been initialized");
  }

  // Progress methods
  async getTechnicianProgress(technicianId: number, periodId: number): Promise<{ 
    submittedCount: number; 
    requiredCount: number; 
    status: string;
  }> {
    try {
      // Get the period
      const period = await this.getQCPeriodById(periodId);
      
      if (!period) {
        return {
          submittedCount: 0,
          requiredCount: 0,
          status: "No active period"
        };
      }
      
      // First get the approved submissions in the current period
      const currentPeriodSubmissions = await db
        .select()
        .from(qcSubmissions)
        .where(
          and(
            eq(qcSubmissions.technicianId, technicianId),
            eq(qcSubmissions.periodId, periodId),
            eq(qcSubmissions.status, "approved") // Only count approved submissions
          )
        );
      
      // Get the pending submissions in the current period
      const pendingPeriodSubmissions = await db
        .select()
        .from(qcSubmissions)
        .where(
          and(
            eq(qcSubmissions.technicianId, technicianId),
            eq(qcSubmissions.periodId, periodId),
            eq(qcSubmissions.status, "pending") // Include pending submissions in log
          )
        );
      
      console.log(`Technician ${technicianId} - Period ${periodId}:`);
      console.log(`- Approved submissions: ${currentPeriodSubmissions.length}`);
      console.log(`- Pending submissions: ${pendingPeriodSubmissions.length}`);
      
      const submittedCount = currentPeriodSubmissions.length;
      const requiredCount = period.requiredQCs;
      
      // Debug information to troubleshoot status assignment
      console.log(`Technician ${technicianId} has ${submittedCount} QCs submitted`);
      
      // Get all status icons and sort them by ID to ensure consistent order
      let statusIcons = await this.getStatusIcons();
      console.log("Status icons from database:", statusIcons.map(i => ({ id: i.id, name: i.name })));
      
      // Sort icons by ID
      statusIcons = statusIcons.sort((a, b) => a.id - b.id);
      console.log("Status icons sorted by ID:", statusIcons.map(i => ({ id: i.id, name: i.name })));
      
      // Default status (fallback if no icons in database)
      let status = "Unknown Status";
      
      // Make sure we have icons
      if (statusIcons.length > 0) {
        // Determine status name based on submission count and new 5-level system
        let targetStatus = '';
        
        // Map submission count to our new status level names
        if (submittedCount >= 4) {
          targetStatus = 'Gigabit Guru';
        } else if (submittedCount >= 3) {
          targetStatus = 'Signal Master';
        } else if (submittedCount >= 2) {
          targetStatus = 'Ladder Expert';
        } else if (submittedCount >= 1) {
          targetStatus = 'Cable Keeper';
        } else {
          targetStatus = 'QC Misser';
        }
        
        console.log(`Target status for ${submittedCount} QCs: ${targetStatus}`);
        
        // Try to find a matching icon by name (case insensitive)
        const matchingIcon = statusIcons.find(icon => 
          icon.name.toLowerCase() === targetStatus.toLowerCase()
        );
        
        if (matchingIcon) {
          // We found a matching icon with our new naming
          status = matchingIcon.name;
          console.log(`Found matching status icon: ${status}`);
        } else {
          // Fallback to index-based approach
          let statusIndex = 0;
          
          if (submittedCount >= 4 && statusIcons.length >= 4) {
            statusIndex = 3; // Use the highest available status
          } else if (submittedCount >= 3 && statusIcons.length >= 3) {
            statusIndex = 2;
          } else if (submittedCount >= 2 && statusIcons.length >= 2) {
            statusIndex = 1;
          } else if (submittedCount >= 1 && statusIcons.length >= 1) {
            statusIndex = 0;
          }
          
          // Get the status name by index
          status = statusIcons[statusIndex]?.name || statusIcons[0].name;
          console.log(`Using index-based status: ${status} (index: ${statusIndex})`);
        }
      }
      
      console.log(`Assigned status for technician ${technicianId}: ${status}`);
      
      return {
        submittedCount,
        requiredCount,
        status
      };
    } catch (error) {
      console.error("Error in getTechnicianProgress:", error);
      return {
        submittedCount: 0,
        requiredCount: 0,
        status: "Error"
      };
    }
  }
  
  async getAllTechniciansProgress(periodId: number): Promise<{
    technician: User;
    submittedCount: number;
    requiredCount: number;
    status: string;
  }[]> {
    const technicians = await db
      .select()
      .from(users)
      .where(eq(users.role, "technician"));
    
    const period = await this.getQCPeriodById(periodId);
    
    if (!period) {
      return [];
    }
    
    const results = [];
    
    for (const technician of technicians) {
      const progress = await this.getTechnicianProgress(technician.id, periodId);
      results.push({
        technician,
        ...progress
      });
    }
    
    return results;
  }
  
  // Initialize default data
  // QC Period automation
  async manageAutomaticQCPeriods(): Promise<void> {
    try {
      // Get current date
      const now = new Date();
      
      // Get the current active period
      const activePeriod = await this.getCurrentQCPeriod();
      
      // If there's an active period that has ended (past the 20th), archive it
      if (activePeriod && new Date(activePeriod.endDate) < now) {
        console.log(`Archiving ended QC period: ${activePeriod.id}`);
        await this.archiveQCPeriod(activePeriod.id);
      }
      
      // Check if we need to create a new period (if no active period exists)
      if (!activePeriod || new Date(activePeriod.endDate) < now) {
        // Create a new period from 21st of current month to 20th of next month
        
        // Calculate start date (21st of current month)
        const startDate = new Date(now.getFullYear(), now.getMonth(), 21);
        
        // If we're past the 21st of this month, use the 21st of the current month
        // Otherwise, use the 21st of the previous month
        if (now.getDate() < 21) {
          startDate.setMonth(startDate.getMonth() - 1);
        }
        
        // Calculate end date (20th of next month relative to start date)
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1);
        endDate.setDate(20);
        
        // Find supervisor ID (default to first supervisor)
        const supervisorId = await this.getCurrentSupervisor();
        
        if (supervisorId) {
          console.log(`Creating new QC period: ${startDate.toISOString()} to ${endDate.toISOString()}`);
          
          // Create the new period
          const newPeriod = await this.createQCPeriod({
            startDate,
            endDate,
            createdById: supervisorId,
            requiredQCs: 4, // Default value
            isActive: true,
            isArchived: false
          });
          
          console.log(`New QC period created with ID: ${newPeriod.id}`);
        } else {
          console.error("Cannot create automatic QC period: No supervisor found");
        }
      }
    } catch (error) {
      console.error("Error in automatic QC period management:", error);
    }
  }
  
  async initDefaultData(): Promise<void> {
    // Check if users already exist
    const existingUsers = await db.select().from(users);
    if (existingUsers.length === 0) {
      // Add default users; createUser hashes passwords before insert.
      await this.createUser({
        username: "supervisor@example.com",
        password: "password123",
        name: "John Supervisor",
        role: "supervisor",
        oneSignalToken: null
      });

      await this.createUser({
        username: "tech1@example.com",
        password: "password123",
        name: "Sarah Smith",
        role: "technician",
        techId: "7416",
        oneSignalToken: null
      });

      await this.createUser({
        username: "tech2@example.com",
        password: "password123",
        name: "Robert Johnson",
        role: "technician",
        techId: "5289",
        oneSignalToken: null
      });
    }
    
    // Check if QC period exists
    const existingPeriods = await db.select().from(qcPeriods);
    if (existingPeriods.length === 0) {
      // Add default active QC period for the current month
      const now = new Date();
      
      // Set start date to 21st of current month
      const startDate = new Date(now.getFullYear(), now.getMonth(), 21);
      
      // Set end date to 20th of next month
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 20);
      
      await this.createQCPeriod({
        startDate,
        endDate,
        createdById: 1,
        requiredQCs: 4,
        isActive: true,
        isArchived: false
      });
      
      // Add an archived period for demonstration
      const archiveStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 21);
      const archiveEndDate = new Date(now.getFullYear(), now.getMonth(), 20);
      
      await this.createQCPeriod({
        startDate: archiveStartDate,
        endDate: archiveEndDate,
        createdById: 1,
        requiredQCs: 4,
        isActive: false,
        isArchived: true
      });
    }
    
    // Check if status icons exist
    const existingIcons = await db.select().from(statusIcons);
    if (existingIcons.length === 0) {
      // Add default status icons
      
      // QC Misser (red) - 0 QCs
      await this.createStatusIcon({
        name: "QC Misser",
        iconPath: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTEyIDIyYzUuNTIzIDAgMTAtNC40NzcgMTAtMTBTMTcuNTIzIDIgMTIgMiAyIDYuNDc3IDIgMTJzNC40NzcgMTAgMTAgMTB6IiBmaWxsPSIjRUIyRjJGIi8+PHBhdGggZD0iTTE1IDE2SDlNOSA4bDYgMm0wLTJsLTYgMiIgc3Ryb2tlPSIjRkZGIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjwvc3ZnPg=="
      });
      
      // Cable Keeper (black) - 1 QC
      await this.createStatusIcon({
        name: "Cable Keeper",
        iconPath: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTEyIDIyYzUuNTIzIDAgMTAtNC40NzcgMTAtMTBTMTcuNTIzIDIgMTIgMiAyIDYuNDc3IDIgMTJzNC40NzcgMTAgMTAgMTB6IiBmaWxsPSIjMDAwMDAwIi8+PHBhdGggZD0iTTExLjkgMTZjLTMgMC00LTAtNC0yLjUgMC0yLjUgMC0zIDIuNS0zIDIuNSAwIDMgMCAzIDIuNVYxNnpNMTQuNCAxMi41YzAtMi41IDAtMy0yLjUtMyIgc3Ryb2tlPSIjRkZGIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjwvc3ZnPg=="
      });
      
      // Ladder Expert (yellow) - 2 QCs
      await this.createStatusIcon({
        name: "Ladder Expert",
        iconPath: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTEyIDIyYzUuNTIzIDAgMTAtNC40NzcgMTAtMTBTMTcuNTIzIDIgMTIgMiAyIDYuNDc3IDIgMTJzNC40NzcgMTAgMTAgMTB6IiBmaWxsPSIjRjZDMDAwIi8+PHBhdGggZD0iTTEwIDhoNGwtMiA0aDJsLTIgNGgybC0zIDQiIHN0cm9rZT0iI0ZGRiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48L3N2Zz4="
      });
      
      // Signal Master (blue) - 3 QCs
      await this.createStatusIcon({
        name: "Signal Master",
        iconPath: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTEyIDIyYzUuNTIzIDAgMTAtNC40NzcgMTAtMTBTMTcuNTIzIDIgMTIgMiAyIDYuNDc3IDIgMTJzNC40NzcgMTAgMTAgMTB6IiBmaWxsPSIjMjI4QkU2Ii8+PHBhdGggZD0iTTggOGwxLjUgMS41TDggMTFsMS41IDEuNUw4IDE0bDEuNSAxLjVMOCAxN003IDEyaDF2MWgtMXYtMXpNMTUgOGgtMXYxaDF2LTF6TTE3IDhsLTEuNSAxLjVMMTcgMTFsLTEuNSAxLjVMMTcgMTRsLTEuNSAxLjVMMTcgMTciIHN0cm9rZT0iI0ZGRiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48L3N2Zz4="
      });
      
      // Gigabit Guru (green) - 4+ QCs
      await this.createStatusIcon({
        name: "Gigabit Guru",
        iconPath: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTEyIDIyYzUuNTIzIDAgMTAtNC40NzcgMTAtMTBTMTcuNTIzIDIgMTIgMiAyIDYuNDc3IDIgMTJzNC40NzcgMTAgMTAgMTB6IiBmaWxsPSIjMjVDMTY4Ii8+PHBhdGggZD0iTTggMTFsMi41LTNMOCBNMTYgOGgtM3Y4aDN2LTR6IiBzdHJva2U9IiNGRkYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PC9zdmc+"
      });
    }
  }
}

export const storage = new DatabaseStorage();
