export type UserRole = "SuperAdmin" | "Admin" | "PMM" | "PM";

export interface UserProfile {
  id: number | string;
  email: string;
  displayName?: string;
  full_name?: string;
  role: UserRole;
  gmailConnected?: boolean;
  created_by?: number | string;
  created_at?: string;
  manager_id?: number | string;
}

export interface Client {
  id: string;
  name: string;
  emailIdentifiers: string[]; // List of emails to track
  pmId: string;
  url?: string;
  created_by_name?: string;
  created_at?: string;
}

export interface Project {
  id: string;
  name: string;
  startDate: string;
  status: "Active" | "Completed" | "On Hold";
  clientId: string;
  pmId: string;
  business_unit_id?: number;
  businessUnitName?: string;
}

export interface BusinessUnit {
  id: number;
  name: string;
  created_at?: string;
  updated_at?: string;
}

export interface EmailLog {
  id: string;
  messageId: string;
  threadId: string;
  projectId: string;
  sender: string;
  receiver: string;
  subject: string;
  timestamp: string;
  body: string;
}
