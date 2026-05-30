import { Client, Project, EmailLog } from "../types";

const activeRequests = new Map<string, Promise<any>>();

function cacheRequest<T>(key: string, fetchFn: () => Promise<T>): Promise<T> {
  if (activeRequests.has(key)) {
    return activeRequests.get(key)!;
  }
  const promise = fetchFn().finally(() => {
    activeRequests.delete(key);
  });
  activeRequests.set(key, promise);
  return promise;
}

export const dataService = {
  // Clients
  async createClient(client: Omit<Client, "id">) {
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(client),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: "Unknown error" }));
      throw new Error(error.message || "Failed to create client");
    }
    return await res.json();
  },
  async getClients() {
    return cacheRequest("getClients", async () => {
      try {
        const res = await fetch("/api/clients");
        if (!res.ok) return [];
        return await res.json();
      } catch (e) {
        return [];
      }
    });
  },
  async deleteClient(id: string | number) {
    const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: "Unknown error" }));
      throw new Error(error.message || "Failed to delete client");
    }
    return await res.json();
  },
  async updateClient(id: string | number, client: Partial<Client>) {
    const res = await fetch(`/api/clients/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(client),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: "Unknown error" }));
      throw new Error(error.message || "Failed to update client");
    }
    return await res.json();
  },
  async clearAllClients() {
    const res = await fetch("/api/clients/all", { method: "DELETE" });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: "Unknown error" }));
      throw new Error(error.message || "Failed to clear clients");
    }
    return await res.json();
  },

  // Projects
  async createProject(project: Omit<Project, "id">) {
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(project),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: "Unknown error" }));
      throw new Error(error.message || "Failed to create project");
    }
    return await res.json();
  },
  async updateProject(id: string | number, projectData: any) {
    const res = await fetch(`/api/projects/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(projectData),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: "Unknown error" }));
      throw new Error(error.message || "Failed to update project");
    }
    return await res.json();
  },
  async clearAllProjects() {
    const res = await fetch("/api/projects/all", { method: "DELETE" });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: "Unknown error" }));
      throw new Error(error.message || "Failed to clear projects");
    }
    return await res.json();
  },
  async getProjects() {
    return cacheRequest("getProjects", async () => {
      try {
        const res = await fetch("/api/projects");
        if (!res.ok) return [];
        return await res.json();
      } catch (e) {
        return [];
      }
    });
  },
  async getEligibleClients() {
    return cacheRequest("getEligibleClients", async () => {
      try {
        const res = await fetch("/api/clients/eligible");
        if (!res.ok) return [];
        return await res.json();
      } catch (e) {
        return [];
      }
    });
  },

  // Email Logs
  async getEmailLogs(projectId: string) {
    return cacheRequest(`getEmailLogs_${projectId}`, async () => {
      const res = await fetch(`/api/logs/${projectId}`);
      return await res.json();
    });
  },

  // Users
  async getUsers() {
    return cacheRequest("getUsers", async () => {
      const res = await fetch("/api/users");
      if (!res.ok) return [];
      return await res.json();
    });
  },

  async createUser(userData: any) {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData)
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: "Unknown error" }));
      throw new Error(error.message || "Failed to create user");
    }
    return await res.json();
  },

  async updateUser(id: string | number, userData: any) {
    const res = await fetch(`/api/users/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData)
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: "Unknown error" }));
      throw new Error(error.message || "Failed to update user");
    }
    return await res.json();
  },

  async deleteUser(id: string | number) {
    const res = await fetch(`/api/users/${id}`, {
      method: "DELETE"
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: "Unknown error" }));
      throw new Error(error.message || "Failed to delete user");
    }
    return await res.json();
  },

  // Connections
  async getConnections() {
    return cacheRequest("getConnections", async () => {
      const res = await fetch("/api/connections");
      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Failed to fetch connections" }));
        throw new Error(error.message || "Failed to fetch connections");
      }
      return await res.json();
    });
  },

  async revokeConnection(id: number) {
    const res = await fetch(`/api/connections/${id}/revoke`, {
      method: "POST"
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: "Failed to revoke connection" }));
      throw new Error(error.message || "Failed to revoke connection");
    }
    return await res.json();
  },

  async getGoogleAuthUrl(userId?: string | number) {
    const url = userId ? `/api/auth/google/url?userId=${userId}` : "/api/auth/google/url";
    const res = await fetch(url);
    return await res.json();
  },

  async getMicrosoftAuthUrl(userId?: string | number) {
    const url = userId ? `/api/auth/microsoft/url?userId=${userId}` : "/api/auth/microsoft/url";
    const res = await fetch(url);
    return await res.json();
  },

  // Inbox
  async downloadInboxConversations(pmId: number, clientId: number, weekStart: string, weekEnd: string) {
    const url = `/api/inbox/download?pmId=${pmId}&clientId=${clientId}&weekStart=${weekStart}&weekEnd=${weekEnd}`;
    window.location.href = url;
  },

  async getInboxWeeklyReport() {
    return cacheRequest("getInboxWeeklyReport", async () => {
      const res = await fetch("/api/inbox/weekly-report");
      if (!res.ok) throw new Error("Failed to fetch weekly report");
      return await res.json();
    });
  },

  async getInbox() {
    return cacheRequest("getInbox", async () => {
      try {
        const res = await fetch("/api/inbox");
        if (!res.ok) return [];
        return await res.json();
      } catch (e) {
        return [];
      }
    });
  },

  async deleteInboxItem(id: string | number) {
    const res = await fetch(`/api/inbox/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: "Unknown error" }));
      throw new Error(error.message || "Failed to delete email");
    }
    return await res.json();
  },
  async syncInbox() {
    const res = await fetch("/api/inbox/sync", { method: "POST" });
    if (!res.ok) throw new Error("Failed to trigger sync");
    return await res.json();
  },

  // Cron Logs
  async getCronLogs() {
    return cacheRequest("getCronLogs", async () => {
      const res = await fetch("/api/cron-logs");
      if (!res.ok) return [];
      return await res.json();
    });
  },

  async clearCronLogs() {
    const res = await fetch("/api/cron-logs", { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to clear logs");
    return await res.json();
  },

  // Business Units
  async getBusinessUnits() {
    return cacheRequest("getBusinessUnits", async () => {
      try {
        const res = await fetch("/api/business-units");
        if (!res.ok) return [];
        return await res.json();
      } catch (e) {
        return [];
      }
    });
  },

  async updateBusinessUnit(id: string | number, name: string) {
    const res = await fetch(`/api/business-units/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: "Unknown error" }));
      throw new Error(error.message || "Failed to update business unit");
    }
    return await res.json();
  },

  // Fathom Meetings
  async getFathomMeetings() {
    return cacheRequest("getFathomMeetings", async () => {
      try {
        const res = await fetch("/api/fathom/meetings");
        if (!res.ok) return [];
        return await res.json();
      } catch (e) {
        return [];
      }
    });
  },
  async syncFathomMeetings() {
    const res = await fetch("/api/fathom/sync", { method: "POST" });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: "Unknown error" }));
      throw new Error(error.message || "Failed to trigger Fathom sync");
    }
    return await res.json();
  },
  async linkFathomMeeting(id: string | number, projectId: string | number | null) {
    const res = await fetch(`/api/fathom/meetings/${id}/link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId }),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: "Unknown error" }));
      throw new Error(error.message || "Failed to link meeting");
    }
    return await res.json();
  },
  async updateFathomNotes(id: string | number, summary: string) {
    const res = await fetch(`/api/fathom/meetings/${id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ summary }),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: "Unknown error" }));
      throw new Error(error.message || "Failed to update meeting notes");
    }
    return await res.json();
  }
};
