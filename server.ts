import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import { google } from "googleapis";
import { convert } from "html-to-text";
import db, { initSchema } from "./src/lib/db.ts";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import axios from "axios";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";

// Microsoft Config
const MS_CLIENT_ID = process.env.MS_CLIENT_ID;
const MS_CLIENT_SECRET = process.env.MS_CLIENT_SECRET;
const MS_TENANT_ID = process.env.MS_TENANT_ID || "common";
const REDIRECT_URI_MS = `${process.env.APP_URL}/auth/microsoft/callback`;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  await initSchema();
  
  // Auto-seed Super Admin
  const adminEmail = "vk@digitalwebsolutions.in";
  const adminPassword = "Admin@123!";
  const adminName = "Vaibhav Kakkar";
  try {
    const existing = await db("users").where({ email: adminEmail }).first();
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    
    if (!existing) {
      const newUser: any = {
        email: adminEmail,
        password: hashedPassword,
        role: "SuperAdmin"
      };
      const columns = await db("users").columnInfo();
      if (columns.name) newUser.name = adminName;
      if (columns.displayName) newUser.displayName = adminName;
      if (columns.full_name) newUser.full_name = adminName;
      
      await db("users").insert(newUser);
      console.log("Super Admin auto-seeded successfully");
    } else {
      const updates: any = {
        password: hashedPassword,
        role: "SuperAdmin"
      };
      if (existing.full_name !== undefined) updates.full_name = adminName;
      else if (existing.displayName !== undefined) updates.displayName = adminName;
      
      await db("users").where({ email: adminEmail }).update(updates);
      console.log("Existing Super Admin updated with SuperAdmin role");
    }
    
    // Log users for verification
    const allUsers = await db("users").select("id", "email", "role");
    console.log("Current users in DB:", JSON.stringify(allUsers, null, 2));

    // Ensure all PMs have connection records
    for (const u of allUsers) {
      if ((u.role || "").toUpperCase() === "PM") {
        const conn = await db("connections").where({ user_id: u.id }).first();
        if (!conn) {
          await db("connections").insert({
            user_id: u.id,
            provider: null,
            status: "pending"
          });
          console.log(`Auto-created missing connection record for PM: ${u.email}`);
        }
      }
    }

    // Cleanup orphaned connections
    const deletedOrphans = await db("connections")
      .whereNotExists(function() {
        this.select("*").from("users").whereRaw("users.id = connections.user_id");
      })
      .delete();
    if (deletedOrphans > 0) {
      console.log(`Cleaned up ${deletedOrphans} orphaned connection records`);
    }
  } catch (err) {
    console.error("Auto-seed failed", err);
  }
  
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());

  // Middleware to verify JWT
  const authenticateToken = (req: any, res: any, next: any) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
      if (err) return res.status(403).json({ message: "Forbidden" });
      (req as any).user = decoded;
      next();
    });
  };

  // Google OAuth Config
  const appUrl = (process.env.APP_URL || "").replace(/\/$/, "");
  const G_REDIRECT_URI = `${appUrl}/api/auth/gmail/callback`;
  
  const cleanEnv = (val: string | undefined, name: string) => {
    if (!val) return "";
    // Remove all non-standard whitespace and control chars, including non-breaking spaces
    let cleaned = val.replace(/[\u00A0\u1680\u180e\u2000-\u2009\u200a\u202f\u205f\u3000\u200b-\u200d\uFEFF]/g, " ").trim();
    
    // If it contains a newline, just take the first line (common when copying from Google Console)
    if (cleaned.includes("\n")) {
      cleaned = cleaned.split("\n")[0].trim();
    }

    // Remove quotes
    cleaned = cleaned.replace(/^["']|["']$/g, "").trim();
    
    // Look for "Something: real_value" or "Something=real_value" pattern
    // Only if the "Something" part looks like a label (short-ish, contains spaces or expected names)
    const separators = [":", "="];
    for (const sep of separators) {
      const sepIdx = cleaned.indexOf(sep);
      if (sepIdx > 0 && sepIdx < 60) {
        const partBefore = cleaned.substring(0, sepIdx).trim();
        const commonLabels = ["CLIENT ID", "CLIENT SECRET", "SECRET", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "VITE_GOOGLE_CLIENT_ID", "VITE_GOOGLE_CLIENT_SECRET"];
        const isLabel = commonLabels.some(l => partBefore.toUpperCase().includes(l) || l.includes(partBefore.toUpperCase())) || /^[A-Za-z\s_]+$/.test(partBefore);
        
        if (isLabel) {
          cleaned = cleaned.substring(sepIdx + 1).trim();
          break; // Found a label, stop searching
        }
      }
    }

    // Final quotes removal if they were inside labels
    cleaned = cleaned.replace(/^["']|["']$/g, "").trim();
    
    console.log(`CLEAN_ENV(${name}): originalLen=${val.length}, cleanedLen=${cleaned.length}, start=${cleaned.substring(0, 15)}...`);
    return cleaned;
  };

  // Prioritize VITE_ prefixed variables as they are usually the ones users set in the UI
  const rawGcid = process.env.GOOGLE_CLIENT_ID;
  const rawViteGcid = process.env.VITE_GOOGLE_CLIENT_ID;
  console.log("RAW_ENV_CHECK_ID:", { 
    GOOGLE_CLIENT_ID: rawGcid ? `${rawGcid.substring(0, 10)}...` : "NONE",
    VITE_GOOGLE_CLIENT_ID: rawViteGcid ? `${rawViteGcid.substring(0, 10)}...` : "NONE"
  });

  const G_CLIENT_ID = cleanEnv(rawViteGcid || rawGcid, "CLIENT_ID");

  const rawGcs = process.env.GOOGLE_CLIENT_SECRET;
  const rawViteGcs = process.env.VITE_GOOGLE_CLIENT_SECRET;
  console.log("RAW_ENV_CHECK_SECRET:", { 
    GOOGLE_CLIENT_SECRET: rawGcs ? `${rawGcs.substring(0, 5)}...` : "NONE",
    VITE_GOOGLE_CLIENT_SECRET: rawViteGcs ? `${rawViteGcs.substring(0, 5)}...` : "NONE"
  });

  const G_CLIENT_SECRET = cleanEnv(rawViteGcs || rawGcs, "CLIENT_SECRET");
  
  console.log("GOOGLE_OAUTH_CONFIG:", { 
    redirectUri: G_REDIRECT_URI,
    hasClientId: !!G_CLIENT_ID, 
    hasClientSecret: !!G_CLIENT_SECRET,
    clientIdLength: G_CLIENT_ID.length,
    secretLength: G_CLIENT_SECRET.length,
    secretEnd: G_CLIENT_SECRET ? `...${G_CLIENT_SECRET.substring(G_CLIENT_SECRET.length - 4)}` : "NONE"
  });

  const oauth2Client = new google.auth.OAuth2(
    G_CLIENT_ID,
    G_CLIENT_SECRET,
    G_REDIRECT_URI
  );

  async function logCron(message: string, level: string = "info") {
    try {
      await db("cron_logs").insert({ message, level, created_at: db.fn.now() });
      console.log(`CRON_LOG [${level.toUpperCase()}]: ${message}`);
    } catch (err) {
      console.error("Failed to write cron log:", err);
    }
  }

  function cleanEmailBody(body: string): string {
    if (!body) return "";
    
    // Split by common reply markers and take the first part
    const splitters = [
      /\r?\n\s*On\s+[\s\S]{1,250}wrote:/i,
      /\r?\n\s*On\s+.*\s+at\s+.*\s+wrote:/i,
      /\r?\n\s*On\s+.*\s+.*\s+<.*>\s+wrote:/i,
      /On\s+.*\s+.*\s+<.*>\s+wrote:/i,
      /-----Original Message-----/i,
      /________________________________/,
      /\r?\nFrom:\s+.*\r?\nSent:\s+.*\r?\nTo:\s+.*/i,
      /\r?\nFrom:\s+.*\r?\nDate:\s+.*\r?\nSubject:\s+.*/i
    ];

    let cleaned = body;
    for (const pattern of splitters) {
      const match = cleaned.match(pattern);
      if (match && match.index !== undefined) {
        cleaned = cleaned.substring(0, match.index);
      }
    }

    return cleaned.trim();
  }

  function extractEmails(str: string): string[] {
    if (!str) return [];
    // This regex looks for email addresses within < > or standalone
    const matches = str.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi);
    return matches ? matches.map(m => m.toLowerCase().trim()) : [];
  }

  async function scanEmails() {
    await logCron("Starting email scan sequence...");
    try {
      // 1. Get all active connections
      const activeConnections = await db("connections")
        .where({ status: "active" })
        .whereNotNull("refresh_token");

      await logCron(`Found ${activeConnections.length} active connections to scan.`);

      for (const conn of activeConnections) {
        try {
          const pmId = conn.user_id;
          // Find all projects for this PM
          const pmProjects = await db("projects")
            .where({ pmId })
            .orWhere({ pm_id: pmId })
            .whereNot("status", "closed");

          if (pmProjects.length === 0) continue;

          if (conn.provider === "gmail") {
            const client = new google.auth.OAuth2(G_CLIENT_ID, G_CLIENT_SECRET, G_REDIRECT_URI);
            client.setCredentials({ refresh_token: conn.refresh_token });
            const gmail = google.gmail({ version: "v1", auth: client });

            for (const project of pmProjects) {
              const projectStartDate = project.startDate || project.start_date;
              if (!projectStartDate) continue;

              const clientRec = await db("clients").where({ id: project.clientId }).first();
              if (!clientRec) continue;

              let emailIdentifiers: string[] = [];
              try {
                emailIdentifiers = typeof clientRec.emailIdentifiers === "string" 
                  ? JSON.parse(clientRec.emailIdentifiers) 
                  : (clientRec.emailIdentifiers || []);
              } catch (e) { continue; }

              const targetEmails = emailIdentifiers.map(e => e.trim().toLowerCase());

              for (const emailAddr of emailIdentifiers) {
                const dateYMD = new Date(projectStartDate).toISOString().split("T")[0].replace(/-/g, "/");
                
                const queries = [
                  { q: `from:${emailAddr} after:${dateYMD}`, type: "INBOX" },
                  { q: `to:${emailAddr} after:${dateYMD}`, type: "SENT" }
                ];

                for (const query of queries) {
                  const response = await gmail.users.messages.list({ userId: "me", q: query.q });
                  let newGmailCount = 0;
                  for (const msg of response.data.messages || []) {
                    const existing = await db("inbox").where({ message_id: msg.id }).first();
                    if (existing) {
                      if (!existing.project_id) {
                        await db("inbox").where({ id: existing.id }).update({ project_id: project.id });
                      }
                      continue;
                    }

                    const fullMsg = await gmail.users.messages.get({ userId: "me", id: msg.id! });
                    const payload = fullMsg.data.payload;
                    
                    const findBody = (part: any): string => {
                      if (part.body?.data) return Buffer.from(part.body.data, "base64").toString();
                      if (part.parts) {
                        for (const p of part.parts) {
                          const found = findBody(p);
                          if (found) return found;
                        }
                      }
                      return "";
                    };
                    
                    const rawBody = findBody(payload!);
                    const body = payload?.mimeType === "text/html" ? convert(rawBody) : rawBody;
                    const cleanedBody = cleanEmailBody(body);

                    const headers = payload?.headers;
                    const subject = headers?.find(h => h.name === "Subject")?.value || "No Subject";
                    const senderRaw = headers?.find(h => h.name === "From")?.value || "";
                    const receiverRaw = headers?.find(h => h.name === "To")?.value || "";
                    const emailDate = new Date(parseInt(fullMsg.data.internalDate!));

                    const senders = extractEmails(senderRaw);
                    const receivers = extractEmails(receiverRaw);

                    // Logic: Must involve one of the target emails
                    if (query.type === "INBOX" && !senders.some(s => targetEmails.includes(s))) continue;
                    if (query.type === "SENT" && !receivers.some(r => targetEmails.includes(r))) continue;

                    let hasAttachments = false;
                    const attachments: any[] = [];
                    const collectAttachments = (parts: any[]) => {
                      for (const p of parts) {
                        if (p.filename && p.filename.length > 0) {
                          hasAttachments = true;
                          attachments.push({
                            filename: p.filename,
                            mimeType: p.mimeType,
                            size: p.body?.size || 0,
                            attachmentId: p.body?.attachmentId
                          });
                        }
                        if (p.parts) collectAttachments(p.parts);
                      }
                    };
                    if (payload?.parts) collectAttachments(payload.parts);

                    await db("inbox").insert({
                      message_id: msg.id,
                      email_date: emailDate,
                      subject,
                      pm_id: pmId,
                      client_id: project.clientId,
                      project_id: project.id,
                      from_address: senders.join(", "),
                      to_address: receivers.join(", "),
                      type: query.type,
                      body: cleanedBody,
                      has_attachments: hasAttachments,
                      attachments_json: JSON.stringify(attachments)
                    });
                    newGmailCount++;
                  }
                  if (newGmailCount > 0) {
                    await logCron(`Stored ${newGmailCount} new Gmail ${query.type} messages for client "${clientRec.name}"`, "success");
                  }
                }
              }
            }
          } else if (conn.provider === "outlook") {
            for (const project of pmProjects) {
              const projectStartDate = project.startDate || project.start_date;
              if (!projectStartDate) continue;

              const clientRec = await db("clients").where({ id: project.clientId }).first();
              if (!clientRec) continue;

              let emailIdentifiers: string[] = [];
              try {
                emailIdentifiers = typeof clientRec.emailIdentifiers === "string" 
                  ? JSON.parse(clientRec.emailIdentifiers) 
                  : (clientRec.emailIdentifiers || []);
              } catch (e) { continue; }

              const tokenResponse = await axios.post(`https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`, 
                new URLSearchParams({
                  client_id: MS_CLIENT_ID!,
                  client_secret: MS_CLIENT_SECRET!,
                  refresh_token: conn.refresh_token!,
                  grant_type: "refresh_token",
                }).toString(),
                { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
              ).catch(e => {
                logCron(`Outlook token refresh failed for connection id=${conn.id}`, "error");
                return null;
              });

              if (!tokenResponse) continue;
              const accessToken = tokenResponse.data.access_token;

              const targetEmails = emailIdentifiers.map(e => e.trim().toLowerCase());

              for (const emailAddr of emailIdentifiers) {
                const startDateISO = new Date(projectStartDate).toISOString();
                
                const queries = [
                  { filter: `from/emailAddress/address eq '${emailAddr}' and receivedDateTime ge ${startDateISO}`, type: "INBOX" },
                  { filter: `toRecipients/any(r:r/emailAddress/address eq '${emailAddr}') and receivedDateTime ge ${startDateISO}`, type: "SENT" }
                ];

                for (const query of queries) {
                  const outlookRes = await axios.get(`https://graph.microsoft.com/v1.0/me/messages?$filter=${encodeURIComponent(query.filter)}`, {
                    headers: { Authorization: `Bearer ${accessToken}` }
                  }).catch(e => {
                    logCron(`Outlook fetch failed for identifier ${emailAddr} (${query.type})`, "error");
                    return null;
                  });

                  if (!outlookRes) continue;

                  let newOutlookCount = 0;
                  for (const msg of outlookRes.data.value || []) {
                    const existing = await db("inbox").where({ message_id: msg.id }).first();
                    if (existing) {
                      if (!existing.project_id) {
                        await db("inbox").where({ id: existing.id }).update({ project_id: project.id });
                      }
                      continue;
                    }

                    const body = msg.body?.contentType === "html" ? convert(msg.body.content) : msg.body?.content;
                    const cleanedBody = cleanEmailBody(body || "");
                    
                    await db("inbox").insert({
                      message_id: msg.id,
                      email_date: new Date(msg.receivedDateTime),
                      subject: msg.subject,
                      pm_id: pmId,
                      client_id: project.clientId,
                      project_id: project.id,
                      from_address: msg.from?.emailAddress?.address,
                      to_address: msg.toRecipients?.map((r: any) => r.emailAddress?.address).join(", "),
                      type: query.type,
                      body: cleanedBody,
                      has_attachments: msg.hasAttachments || false,
                      attachments_json: JSON.stringify([])
                    });
                    newOutlookCount++;
                  }
                  if (newOutlookCount > 0) {
                    await logCron(`Stored ${newOutlookCount} new Outlook ${query.type} messages for client "${clientRec.name}"`, "success");
                  }
                }
              }
            }
          }
        } catch (connErr: any) {
          await logCron(`Error scanning connection ${conn.id}: ${connErr.message}`, "error");
        }
      }
      await logCron("Email scan sequence completed.", "success");
    } catch (err: any) {
      await logCron(`Global scan error: ${err.message}`, "error");
    }
  }

  // Run scan every 5 minutes
  setInterval(scanEmails, 5 * 60 * 1000);
  // Also run once on start after a short delay
  setTimeout(scanEmails, 10000);

  // Authentication Routes
  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    try {
      const user = await db("users").where({ email }).first();
      if (!user) return res.status(404).json({ message: "User not found" });

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) return res.status(401).json({ message: "Invalid credentials" });

      const displayName = user.displayName || user.full_name || "";
      const token = jwt.sign(
        { 
          id: user.id, 
          email: user.email, 
          role: user.role, 
          displayName: user.full_name || user.displayName || user.email, 
          full_name: user.full_name || user.displayName || "" 
        }, 
        JWT_SECRET, 
        { expiresIn: "24h" }
      );
      res.cookie("token", token, { httpOnly: true, secure: true, sameSite: "none" });
      res.json({ 
        user: { 
          id: user.id, 
          email: user.email, 
          displayName: user.full_name || user.displayName, 
          role: user.role 
        } 
      });
    } catch (error) {
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie("token");
    res.json({ message: "Logged out" });
  });

  app.get("/api/auth/me", authenticateToken, async (req: any, res) => {
    try {
      const user = await db("users").where({ id: req.user.id }).first();
      res.json({ 
        id: user.id, 
        email: user.email, 
        displayName: user.full_name || user.displayName || user.email, 
        role: user.role,
        full_name: user.full_name || user.displayName || ""
      });
    } catch (error) {
      res.status(500).json({ message: "Error fetching user" });
    }
  });

  app.get("/api/users", authenticateToken, async (req: any, res) => {
    const userRole = (req.user.role || "").toLowerCase().replace(/_/g, "");
    const allowedRoles = ["superadmin", "admin", "pmm"];
    
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ message: "Access denied" });
    }
    try {
      const columns = await db("users").columnInfo();
      const selectFields = ["id", "email", "role", "created_at", "created_by"];
      if (columns.displayName) selectFields.push("displayName");
      if (columns.full_name) selectFields.push("full_name");
      if (columns.gmailConnected) selectFields.push("gmailConnected");
      if (columns.manager_id) selectFields.push("manager_id");
      
      const users = await db("users").select(selectFields);
      res.json(users.map(u => ({
        ...u,
        displayName: u.displayName || u.full_name
      })));
    } catch (error) {
      res.status(500).json({ message: "Error fetching users" });
    }
  });

  app.post("/api/users", authenticateToken, async (req: any, res) => {
    const creatorRole = (req.user.role || "").toLowerCase().replace(/_/g, "");
    const { email, password, fullName, role, managerId } = req.body;
    
    const allowedCreators = ["superadmin", "admin", "pmm"];
    if (!allowedCreators.includes(creatorRole)) {
      return res.status(403).json({ message: "You don't have permission to create users" });
    }

    if (role === "PM" && !allowedCreators.includes(creatorRole)) {
       return res.status(403).json({ message: "Permission denied" });
    }
    
    try {
      const hashedPassword = await bcrypt.hash(password || "ChangeMe123!", 10);
      const columns = await db("users").columnInfo();
      
      const newUser: any = {
        email,
        password: hashedPassword,
        role: role,
        created_by: req.user.id
      };

      if (managerId && managerId !== "") newUser.manager_id = managerId;
      
      const nameToUse = fullName || email.split("@")[0];
      if (columns.full_name) newUser.full_name = nameToUse;
      if (columns.name) newUser.name = nameToUse;
      if (columns.displayName) newUser.displayName = nameToUse;

      let userId: any;
      await db.transaction(async (trx) => {
        const [id] = await trx("users").insert(newUser);
        userId = id;
        console.log(`User created with ID: ${userId}, Role: ${role}`);
        
        if (role && (role.toUpperCase() === "PM" || role.toLowerCase() === "pm")) {
          console.log(`Creating connection record for user ${userId}`);
          await trx("connections").insert({
            user_id: userId,
            provider: null,
            status: "pending"
          });
        }
      });

      res.json({ id: userId, email, role, fullName: nameToUse });
    } catch (error: any) {
      console.error("Create user error:", error);
      res.status(500).json({ message: error.message || "Failed to create user" });
    }
  });

  app.put("/api/users/:id", authenticateToken, async (req: any, res) => {
    const { id } = req.params;
    const { email, fullName, role, password } = req.body;
    const userRole = (req.user.role || "").toLowerCase().replace(/_/g, "");
    
    try {
      const userToUpdate = await db("users").where({ id }).first();
      if (!userToUpdate) return res.status(404).json({ message: "User not found" });

      // Permission check: Self update or higher role
      if (req.user.id != id && userRole !== "superadmin" && userRole !== "admin") {
         return res.status(403).json({ message: "Access denied" });
      }

      const updates: any = {};
      if (email) updates.email = email;
      if (role && userRole === "superadmin") updates.role = role;
      if (password) updates.password = await bcrypt.hash(password, 10);
      if (req.body.managerId !== undefined) updates.manager_id = req.body.managerId || null;
      
      const columns = await db("users").columnInfo();
      if (fullName) {
        if (columns.full_name) updates.full_name = fullName;
        else if (columns.displayName) updates.displayName = fullName;
      }

      await db("users").where({ id }).update(updates);

      // If role became PM, ensure connection record exists
      const finalUser = await db("users").where({ id }).first();
      const finalRole = (finalUser.role || "").toUpperCase();
      if (finalRole === "PM" || finalRole === "PROJECTMANAGER") {
        const existingConn = await db("connections").where({ user_id: id }).first();
        if (!existingConn) {
          await db("connections").insert({
            user_id: id,
            provider: null,
            status: "pending"
          });
        }
      }

      res.json({ message: "User updated successfully" });
    } catch (error) {
      res.status(500).json({ message: "Update failed" });
    }
  });

  app.delete("/api/users/:id", authenticateToken, async (req: any, res) => {
    const { id } = req.params;
    const userRole = (req.user.role || "").toLowerCase().replace(/_/g, "");
    if (userRole !== "superadmin") {
      return res.status(403).json({ message: "Only SuperAdmin can delete users" });
    }
    try {
      // Delete relative records first to avoid FK constraints
      await db("connections").where({ user_id: id }).delete();
      await db("users").where({ id }).delete();
      res.json({ message: "User deleted" });
    } catch (error) {
      res.status(500).json({ message: "Delete failed" });
    }
  });

  // Connections API
  app.get("/api/connections", authenticateToken, async (req: any, res) => {
    try {
      const userRole = (req.user.role || "").toLowerCase().replace(/_/g, "");
      const userId = Number(req.user.id);
      
      console.log(`FETCH_CONNECTIONS: UserID=${userId}, Role=${userRole}`);
      
      const conns = await db("connections").select("*");
      const users = await db("users").select("id", "email", "full_name", "displayName");
      
      console.log(`FETCH_CONNECTIONS: Raw Conns Count=${conns.length}, Users Count=${users.length}`);

      let results = conns.map(c => {
        const u = users.find(user => Number(user.id) === Number(c.user_id));
        return {
          ...c,
          userEmail: u?.email || "Unknown",
          userName: u?.full_name || u?.displayName || "Unknown",
          provider: c.provider
        };
      });

      console.log(`FETCH_CONNECTIONS: Mapped results count=${results.length}`);

      if (userRole === "pm" || userRole === "projectmanager") {
        const filtered = results.filter(c => Number(c.user_id) === userId);
        console.log(`FETCH_CONNECTIONS: PM Filter result count=${filtered.length} for userID=${userId}`);
        results = filtered;
      }

      res.json(results);
    } catch (error: any) {
      console.error("Fetch connections error:", error);
      res.status(500).json({ message: "Error fetching connections" });
    }
  });
  
  app.post("/api/connections/:id/revoke", authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userRole = (req.user.role || "").toLowerCase().replace(/_/g, "");
      const userId = req.user.id;
      
      const conn = await db("connections").where({ id }).first();
      if (!conn) return res.status(404).json({ message: "Connection not found" });
      
      // Permission check: only admin or the owner
      if (Number(conn.user_id) !== Number(userId) && !["superadmin", "admin", "pmm"].includes(userRole)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      await db("connections").where({ id }).update({
        provider: null,
        status: "pending",
        refresh_token: null,
        email: null,
        updated_at: db.fn.now()
      });

      // Also update users table for legacy gmail fields if it was a gmail connection
      if (conn.provider === "gmail") {
        await db("users").where({ id: conn.user_id }).update({
          gmailConnected: false,
          gmailRefreshToken: null
        });
      }
      
      res.json({ message: "Connection revoked successfully" });
    } catch (error) {
      console.error("Revoke connection error:", error);
      res.status(500).json({ message: "Error revoking connection" });
    }
  });

  // Setup Admin Endpoint (MySQL Version)
  app.post("/api/setup-admin", async (req, res) => {
    const adminEmail = "vk@digitalwebsolutions.in";
    const adminPassword = "Admin@123!";
    const adminName = "Vaibhav Kakkar";

    try {
      const columns = await db("users").columnInfo();
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      const existing = await db("users").where({ email: adminEmail }).first();
      
      const userObj: any = {
        email: adminEmail,
        password: hashedPassword,
        role: "SuperAdmin"
      };

      if (columns.displayName) userObj.displayName = adminName;
      if (columns.full_name) userObj.full_name = adminName;

      if (existing) {
        await db("users").where({ email: adminEmail }).update(userObj);
      } else {
        await db("users").insert(userObj);
      }

      res.json({ status: "success", message: "Super Admin initialized in MySQL" });
    } catch (error) {
      console.error("Setup error:", error);
      res.status(500).json({ status: "error", message: String(error) });
    }
  });

  // Data Routes
  // Data Routes
  app.get("/api/auth/microsoft/url", authenticateToken, (req: any, res) => {
    let targetUserId = req.user.id;
    const requestedUserId = req.query.userId;
    
    if (requestedUserId && requestedUserId !== String(req.user.id)) {
      const userRole = (req.user.role || "").toLowerCase().replace(/_/g, "");
      const isAdmin = ["superadmin", "admin", "pmm"].includes(userRole);
      if (!isAdmin) {
        return res.status(403).json({ message: "Only administrators can link connections for other users." });
      }
      targetUserId = requestedUserId;
    }

    const url = `https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/authorize?client_id=${MS_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI_MS)}&response_mode=query&scope=https://graph.microsoft.com/Mail.Read%20offline_access%20User.Read&state=${targetUserId}`;
    res.json({ url });
  });

  app.get("/auth/microsoft/callback", async (req, res) => {
    const { code, state: userId } = req.query;
    try {
      const response = await axios.post(`https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`, 
        new URLSearchParams({
          client_id: MS_CLIENT_ID!,
          scope: "https://graph.microsoft.com/Mail.Read Mail.ReadBasic User.Read offline_access",
          code: code as string,
          redirect_uri: REDIRECT_URI_MS,
          grant_type: "authorization_code",
          client_secret: MS_CLIENT_SECRET!,
        }).toString(),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );

      const { access_token, refresh_token } = response.data;
      
      // Get user info
      const userRes = await axios.get("https://graph.microsoft.com/v1.0/me", {
        headers: { Authorization: `Bearer ${access_token}` }
      });
      const userEmail = userRes.data.mail || userRes.data.userPrincipalName;

      // START EMAIL MATCHING CHECK
      const registeredUser = await db("users").where({ id: userId }).first();
      if (registeredUser && userEmail.toLowerCase() !== registeredUser.email.toLowerCase()) {
        console.warn("MICROSOFT_OAUTH_EMAIL_MISMATCH:", { registered: registeredUser.email, oauth: userEmail });
        return res.send(`
          <html>
            <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f8d7da; color: #721c24;">
              <div style="padding: 20px; border: 1px solid #f5c6cb; border-radius: 8px; background-color: #fff; max-width: 500px; text-align: center; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <h2 style="margin-top: 0;">Email Mismatch</h2>
                <p>The PM registered email (<strong>${registeredUser.email}</strong>) does not match against the Microsoft account email (<strong>${userEmail}</strong>).</p>
                <p>Connection has been revoked.</p>
                <button onclick="window.close()" style="background-color: #721c24; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin-top: 10px;">Close Window</button>
              </div>
            </body>
          </html>
        `);
      }
      // END EMAIL MATCHING CHECK

      // Update or insert into connections
      const existing = await db("connections").where({ user_id: userId, provider: "outlook" }).first();
      // Also check if there's a record with same user but different provider that's pending?
      // For now, let's just use the current user's connection record if it exists and is pending, regardless of provider
      const pendingRec = await db("connections").where({ user_id: userId, status: "pending" }).first();
      
      const targetId = existing?.id || pendingRec?.id;

      if (targetId) {
        await db("connections").where({ id: targetId }).update({
          provider: "outlook",
          email: userEmail,
          refresh_token: refresh_token,
          status: "active"
        });
      } else {
        await db("connections").insert({
          user_id: userId,
          provider: "outlook",
          email: userEmail,
          refresh_token: refresh_token,
          status: "active"
        });
      }

      res.send("<html><body><script>window.close()</script><p>Authenticated! You can close this.</p></body></html>");
    } catch (error: any) {
      console.error("MS OAuth callback error:", error.response?.data || error.message);
      res.status(500).send("Microsoft OAuth failed");
    }
  });

  app.get("/api/clients/eligible", authenticateToken, async (req: any, res) => {
    try {
      // Eligible clients are those not in any project OR in a closed project
      const clientsWithActiveProjects = await db("projects")
        .whereNot("status", "closed")
        .select("clientId");
      
      const activeClientIds = clientsWithActiveProjects.map(p => p.clientId);
      
      const eligibleClients = await db("clients")
        .whereNotIn("id", activeClientIds);
      
      res.json(eligibleClients);
    } catch (error) {
      console.error("Fetch eligible clients error:", error);
      res.status(500).json({ message: "Error fetching eligible clients" });
    }
  });

  app.get("/api/clients", authenticateToken, async (req: any, res) => {
    try {
      const userRole = (req.user.role || "").toLowerCase().replace(/_/g, "");
      const query = db("clients");
      if (userRole === "pm") query.where({ pmId: req.user.id });
      const clients = await query;
      res.json(clients.map(c => {
        let emailIds = [];
        try {
          emailIds = typeof c.emailIdentifiers === "string" ? JSON.parse(c.emailIdentifiers) : (c.emailIdentifiers || []);
        } catch (e) {
          emailIds = [];
        }
        return { 
          ...c, 
          emailIdentifiers: Array.isArray(emailIds) ? emailIds : []
        };
      }));
    } catch (error) {
      console.error("Fetch clients error:", error);
      res.status(500).json({ message: "Error fetching clients" });
    }
  });

  app.post("/api/clients", authenticateToken, async (req: any, res) => {
    const { name, emailIdentifiers, url } = req.body;
    console.log("CREATE_CLIENT_REQUEST:", { name, emailIdentifiers, url, userId: req.user.id });
    try {
      const pmId = Number(req.user.id);
      if (isNaN(pmId)) {
        console.error("CREATE_CLIENT_ERROR: pmId is NaN", { id: req.user.id });
        return res.status(400).json({ message: "Invalid User ID session" });
      }

      const [id] = await db("clients").insert({
        name,
        emailIdentifiers: JSON.stringify(emailIdentifiers),
        url,
        pmId: pmId,
        created_by: pmId,
        created_by_name: req.user.full_name || req.user.displayName || req.user.email
      });
      console.log("CLIENT_CREATED_SUCCESS:", { id, name, creator: req.user.full_name || req.user.displayName });
      res.json({ id, name, emailIdentifiers, url });
    } catch (error: any) {
      console.error("Create client error:", error);
      res.status(500).json({ message: "Error creating client: " + (error.message || "Unknown error") });
    }
  });

  // Temporary cleanup: Clear all clients once if requested via query param or just now
  app.post("/api/admin/clear-data", authenticateToken, async (req: any, res) => {
    if (req.user.role !== "SuperAdmin") return res.status(403).json({ message: "Forbidden" });
    try {
      await db("projects").delete();
      await db("clients").delete();
      await db("email_logs").delete();
      res.json({ message: "Clients and projects cleared successfully" });
    } catch (err) {
      res.status(500).json({ message: "Clear failed" });
    }
  });

  app.delete("/api/clients/all", authenticateToken, async (req: any, res) => {
    const userRole = (req.user.role || "").toLowerCase().replace(/_/g, "");
    if (userRole !== "superadmin") {
      return res.status(403).json({ message: "Only SuperAdmin can clear all clients" });
    }
    try {
      // Delete projects using these clients first or set them to null
      await db("projects").whereIn("clientId", db("clients").select("id")).delete();
      await db("clients").delete();
      res.json({ message: "All clients cleared" });
    } catch (error) {
      console.error("Clear all clients error:", error);
      res.status(500).send("Error clearing clients");
    }
  });

  app.delete("/api/clients/:id", authenticateToken, async (req: any, res) => {
    const { id } = req.params;
    const userRole = (req.user.role || "").toLowerCase().replace(/_/g, "");
    const allowedRoles = ["superadmin", "admin", "pmm"];
    
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ message: "Access denied" });
    }

    try {
      await db("projects").where({ clientId: id }).delete();
      await db("clients").where({ id }).delete();
      res.json({ message: "Client deleted successfully" });
    } catch (error) {
      console.error("Delete client error:", error);
      res.status(500).send("Error deleting client");
    }
  });

  app.put("/api/clients/:id", authenticateToken, async (req: any, res) => {
    const { id } = req.params;
    const { name, emailIdentifiers, url } = req.body;
    const userRole = (req.user.role || "").toLowerCase().replace(/_/g, "");
    const allowedRoles = ["superadmin", "admin", "pmm"];
    
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ message: "Access denied" });
    }
    try {
      await db("clients").where({ id }).update({
        name,
        emailIdentifiers: JSON.stringify(emailIdentifiers),
        url,
        updated_at: db.fn.now()
      });
      res.json({ id, name, emailIdentifiers, url });
    } catch (error) {
      console.error("Update client error:", error);
      res.status(500).json({ message: "Error updating client" });
    }
  });

  app.get("/api/projects", authenticateToken, async (req: any, res) => {
    try {
      const userRole = (req.user.role || "").toLowerCase().replace(/_/g, "");
      const query = db("projects")
        .select("projects.*", "clients.name as clientName", "users.displayName as pmName")
        .leftJoin("clients", function() {
          this.on("projects.clientId", "=", "clients.id").orOn("projects.client_id", "=", "clients.id")
        })
        .leftJoin("users", function() {
          this.on("projects.pmId", "=", "users.id").orOn("projects.pm_id", "=", "users.id")
        });

      if (userRole === "pm") {
        query.where(function() {
          this.where("projects.pmId", req.user.id).orWhere("projects.pm_id", req.user.id);
        });
      }
      const projects = await query;
      res.json(projects);
    } catch (error) {
      console.error("Fetch projects error:", error);
      res.status(500).json({ message: "Error fetching projects" });
    }
  });

  app.post("/api/projects", authenticateToken, async (req: any, res) => {
    const userRole = (req.user.role || "").toLowerCase().replace(/_/g, "");
    const allowedRoles = ["superadmin", "admin", "pmm"];
    
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ message: "Access denied. Only PMM, Admin, or SuperAdmin can create projects." });
    }

    const { name, startDate, clientId, pmId, status } = req.body;
    
    if (!name || !clientId || !pmId || !startDate) {
      return res.status(400).json({ message: "Project Name, Client, PM, and Start Date are required." });
    }

    try {
      // Check if client is already in an active project
      const existingProject = await db("projects")
        .where({ clientId })
        .whereNot("status", "closed")
        .first();
      
      if (existingProject) {
        return res.status(400).json({ message: "This client is already linked to an active project." });
      }

      const createdBy = Number(req.user.id);
      const targetPmId = Number(pmId);

      if (isNaN(createdBy) || isNaN(targetPmId)) {
        console.error("CREATE_PROJECT_ERROR: Numeric conversion failed", { createdBy: req.user.id, pmId });
        return res.status(400).json({ message: "Invalid User or PM ID" });
      }

      const [id] = await db("projects").insert({
        name,
        startDate,
        start_date: startDate,
        clientId: Number(clientId),
        client_id: Number(clientId),
        pmId: targetPmId,
        pm_id: targetPmId,
        status: status || "active",
        created_by: createdBy
      });
      console.log("PROJECT_CREATED_SUCCESS:", { id, name });
      res.json({ id, name, startDate, clientId: Number(clientId), pmId: targetPmId, status: status || "active" });
    } catch (error: any) {
      console.error("Create project error:", error);
      res.status(500).json({ 
        message: "Error creating project: " + (error.message || "Unknown server error"),
        details: error.toString() 
      });
    }
  });

  app.put("/api/projects/:id", authenticateToken, async (req: any, res) => {
    const { id } = req.params;
    const userRole = (req.user.role || "").toLowerCase().replace(/_/g, "");
    const allowedRoles = ["superadmin", "admin", "pmm"];
    
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ message: "Access denied." });
    }

    const { name, startDate, clientId, pmId, status } = req.body;
    try {
      const updateData: any = {
        name,
        updated_at: db.fn.now()
      };

      // Only add columns if they are present in request
      if (startDate) {
        updateData.startDate = startDate;
        updateData.start_date = startDate;
      }
      if (clientId) {
        updateData.clientId = Number(clientId);
        updateData.client_id = Number(clientId);
      }
      if (pmId) {
        updateData.pmId = Number(pmId);
        updateData.pm_id = Number(pmId);
      }
      if (status) {
        updateData.status = status;
      }

      await db("projects").where({ id }).update(updateData);
      console.log("PROJECT_UPDATED_SUCCESS:", { id, name });
      res.json({ message: "Project updated successfully" });
    } catch (error: any) {
      console.error("Update project error:", error);
      res.status(500).json({ 
        message: "Error updating project: " + (error.message || "Unknown server error"),
        details: error.toString()
      });
    }
  });

  app.delete("/api/projects/all", authenticateToken, async (req: any, res) => {
    const userRole = (req.user.role || "").toLowerCase().replace(/_/g, "");
    if (userRole !== "superadmin") {
      return res.status(403).json({ message: "Only SuperAdmin can clear all projects" });
    }
    try {
      await db("email_logs").delete(); // Clear logs too
      await db("projects").delete();
      res.json({ message: "All projects cleared" });
    } catch (error) {
      res.status(500).send("Error clearing projects");
    }
  });

  app.get("/api/logs/:projectId", authenticateToken, async (req, res) => {
    const { projectId } = req.params;
    try {
      const logs = await db("email_logs")
        .where({ projectId })
        .orderBy("timestamp", "desc");
      res.json(logs);
    } catch (error) {
      res.status(500).send("Error fetching logs");
    }
  });

  // Inbox Endpoints
  app.get("/api/inbox/download", authenticateToken, async (req: any, res) => {
    try {
      const { pmId, clientId, weekStart, weekEnd } = req.query;
      const userRole = (req.user.role || "").toLowerCase().replace(/_/g, "");
      const userId = req.user.id;

      // Permission check
      if (userRole === "pm" && Number(pmId) !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const emails = await db("inbox")
        .select(
          "inbox.*",
          db.raw("COALESCE(users.full_name, users.displayName, users.email) as pmName"),
          "users.email as pmEmail"
        )
        .leftJoin("users", "inbox.pm_id", "users.id")
        .where({ "inbox.pm_id": pmId, "inbox.client_id": clientId })
        .where("inbox.email_date", ">=", weekStart)
        .where("inbox.email_date", "<=", weekEnd)
        .orderBy("inbox.email_date", "desc");

      let content = "";
      emails.forEach((email, index) => {
        const date = new Date(email.email_date);
        
        // Format: Tue, May 12, 2026 at 08:38 PM
        const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date);
        const month = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(date);
        const day = new Intl.DateTimeFormat('en-US', { day: '2-digit' }).format(date);
        const year = new Intl.DateTimeFormat('en-US', { year: 'numeric' }).format(date);
        const time = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).format(date);
        
        // Get offset in format like +5:00
        const offsetMinutes = -date.getTimezoneOffset();
        const offsetHours = Math.floor(Math.abs(offsetMinutes) / 60);
        const offsetMins = Math.abs(offsetMinutes) % 60;
        const offsetSign = offsetMinutes >= 0 ? "+" : "-";
        const offsetStr = `${offsetSign}${offsetHours}:${offsetMins.toString().padStart(2, "0")}`;

        const fullDateStr = `${weekday}, ${month} ${day}, ${year} at ${time} ${offsetStr}`;
        const finalBody = cleanEmailBody(email.body);
        
        content += `--- Email ${emails.length - index} [${email.type}]\n`;
        content += `From: ${email.from_address}\n`;
        content += `Date:   ${fullDateStr}\n`;
        content += `To:  ${email.to_address || (email.type === 'INBOX' ? `${email.pmName} <${email.pmEmail}>` : 'Unknown')}\n\n`;
        content += `${finalBody}\n`;
        content += `---------------------------separator---------------------\n\n`;
      });

      res.setHeader("Content-Type", "text/plain");
      res.setHeader("Content-Disposition", `attachment; filename=conversations_${clientId}_week.txt`);
      res.send(content);
    } catch (error) {
      console.error("Download error:", error);
      res.status(500).json({ message: "Error generating download" });
    }
  });

  app.get("/api/inbox/weekly-report", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userRole = (req.user.role || "").toLowerCase().replace(/_/g, "");
      
      // We want to group by PM, Client and Week
      // We'll use YEARWEEK to distinguish between weeks in different years
      let query = db("inbox")
        .select(
          "inbox.pm_id",
          "inbox.client_id",
          "inbox.project_id",
          "clients.name as clientName",
          "projects.name as projectName",
          db.raw("COALESCE(users.full_name, users.displayName, users.email) as pmName"),
          db.raw("YEARWEEK(email_date, 1) as week_val"),
          db.raw("COUNT(*) as email_count"),
          db.raw("MIN(email_date) as week_start"),
          db.raw("MAX(email_date) as week_end")
        )
        .leftJoin("clients", "inbox.client_id", "clients.id")
        .leftJoin("projects", "inbox.project_id", "projects.id")
        .leftJoin("users", "inbox.pm_id", "users.id")
        .groupBy("inbox.pm_id", "inbox.client_id", "inbox.project_id", "week_val")
        .orderBy("week_val", "desc");

      if (userRole === "pm") {
        query.where("inbox.pm_id", userId);
      } else if (userRole === "pmm") {
        const managedPmIds = await db("users").where({ manager_id: userId }).select("id");
        const ids = managedPmIds.map(u => u.id);
        query.whereIn("inbox.pm_id", ids);
      }

      const report = await query;
      res.json(report);
    } catch (error) {
      console.error("Weekly report error:", error);
      res.status(500).json({ message: "Error generating weekly report" });
    }
  });

  // Add explicit sync endpoint
  app.post("/api/inbox/sync", authenticateToken, async (req: any, res) => {
    try {
      await logCron(`Manual sync triggered by user ${req.user.id}`, "info");
      // Run in background so request doesn't timeout
      scanEmails().catch(err => console.error("Manual scan error:", err));
      res.json({ message: "Sync started in background" });
    } catch (err) {
      res.status(500).json({ message: "Failed to trigger sync" });
    }
  });

  app.get("/api/inbox", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userRole = (req.user.role || "").toLowerCase().replace(/_/g, "");
      
      let query = db("inbox")
        .select(
          "inbox.*", 
          "clients.name as clientName", 
          "projects.name as projectName",
          db.raw("COALESCE(users.full_name, users.displayName, users.email) as pmName")
        )
        .leftJoin("clients", "inbox.client_id", "clients.id")
        .leftJoin("projects", "inbox.project_id", "projects.id")
        .leftJoin("users", "inbox.pm_id", "users.id")
        .orderBy("email_date", "desc");

      if (userRole === "pm") {
        query.where("inbox.pm_id", userId);
      } else if (userRole === "pmm") {
        // PMM can see their PMs' emails
        const managedPmIds = await db("users").where({ manager_id: userId }).select("id");
        const ids = managedPmIds.map(u => u.id);
        query.whereIn("inbox.pm_id", ids);
      }
      // SuperAdmin and Admin see all (no filter)

      const emails = await query;
      res.json(emails.map(e => ({
        ...e,
        attachments: e.attachments_json ? JSON.parse(e.attachments_json) : []
      })));
    } catch (error) {
      console.error("Fetch inbox error:", error);
      res.status(500).json({ message: "Error fetching inbox" });
    }
  });

  app.delete("/api/inbox/:id", authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const userRole = (req.user.role || "").toLowerCase().replace(/_/g, "");

      const email = await db("inbox").where({ id }).first();
      if (!email) return res.status(404).json({ message: "Email not found" });

      // Permission check
      let canDelete = false;
      if (["superadmin", "admin"].includes(userRole)) {
        canDelete = true;
      } else if (userRole === "pm" && email.pm_id === userId) {
        canDelete = true;
      } else if (userRole === "pmm") {
        const managedPmIds = await db("users").where({ manager_id: userId }).select("id");
        if (managedPmIds.some(u => u.id === email.pm_id)) {
          canDelete = true;
        }
      }

      if (!canDelete) return res.status(403).json({ message: "Access denied" });

      await db("inbox").where({ id }).delete();
      res.json({ message: "Email deleted successfully" });
    } catch (error) {
      console.error("Delete inbox error:", error);
      res.status(500).json({ message: "Error deleting email" });
    }
  });

  app.get("/api/cron-logs", authenticateToken, async (req: any, res) => {
    try {
      const userRole = (req.user.role || "").toLowerCase().replace(/_/g, "");
      if (!["superadmin", "admin"].includes(userRole)) {
        return res.status(403).json({ message: "Only administrators can view cron logs" });
      }
      const logs = await db("cron_logs").orderBy("created_at", "desc").limit(100);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "Error fetching cron logs" });
    }
  });

  app.delete("/api/cron-logs", authenticateToken, async (req: any, res) => {
    try {
      const userRole = (req.user.role || "").toLowerCase().replace(/_/g, "");
      if (!["superadmin", "admin"].includes(userRole)) {
        return res.status(403).json({ message: "Only administrators can clear cron logs" });
      }
      await db("cron_logs").delete();
      res.json({ message: "Cron logs cleared" });
    } catch (error) {
      res.status(500).json({ message: "Error clearing cron logs" });
    }
  });

  // Sync Endpoint
  app.post("/api/sync/:projectId", authenticateToken, async (req: any, res) => {
    const { projectId } = req.params;
    const pmId = req.user.id;

    try {
      const project = await db("projects").where({ id: projectId }).first();
      if (!project) return res.status(404).send("Project not found");

      const client = await db("clients").where({ id: project.clientId }).first();
      if (!client) return res.status(404).send("Client not found");

      const user = await db("users").where({ id: pmId }).first();
      if (!user.gmailRefreshToken) return res.status(400).send("Gmail not connected");
      
      oauth2Client.setCredentials({ refresh_token: user.gmailRefreshToken });
      const gmail = google.gmail({ version: "v1", auth: oauth2Client });

      const emailIdentifiers = typeof client.emailIdentifiers === "string" ? JSON.parse(client.emailIdentifiers) : client.emailIdentifiers;
      let totalNew = 0;

      for (const emailAddr of emailIdentifiers) {
        const q = `from:${emailAddr} OR to:${emailAddr}`;
        const response = await gmail.users.messages.list({ userId: "me", q, maxResults: 10 });
        
        for (const msg of response.data.messages || []) {
          const existing = await db("email_logs").where({ messageId: msg.id }).first();
          if (existing) continue;

          const fullMsg = await gmail.users.messages.get({ userId: "me", id: msg.id! });
          const payload = fullMsg.data.payload;
          
          let body = "";
          const findBody = (part: any): string => {
            if (part.body?.data) return Buffer.from(part.body.data, "base64").toString();
            if (part.parts) {
              for (const p of part.parts) {
                const found = findBody(p);
                if (found) return found;
              }
            }
            return "";
          };
          
          const rawBody = findBody(payload!);
          body = payload?.mimeType === "text/html" ? convert(rawBody) : rawBody;

          const headers = payload?.headers;
          const subject = headers?.find(h => h.name === "Subject")?.value || "No Subject";
          const sender = headers?.find(h => h.name === "From")?.value || "Unknown";
          const receiver = headers?.find(h => h.name === "To")?.value || "";
          const timestamp = new Date(parseInt(fullMsg.data.internalDate!));

          await db("email_logs").insert({
            messageId: msg.id,
            threadId: fullMsg.data.threadId,
            projectId,
            sender,
            receiver,
            subject,
            timestamp,
            body: body.substring(0, 5000),
          });
          totalNew++;
        }
      }

      res.json({ status: "success", synced: totalNew });
    } catch (error) {
      console.error("Sync error:", error);
      res.status(500).json({ status: "error", message: String(error) });
    }
  });

  app.get("/api/auth/google/url", authenticateToken, (req: any, res) => {
    let targetUserId = req.user.id;
    const requestedUserId = req.query.userId;
    
    if (requestedUserId && requestedUserId !== String(req.user.id)) {
      const userRole = (req.user.role || "").toLowerCase().replace(/_/g, "");
      const isAdmin = ["superadmin", "admin", "pmm"].includes(userRole);
      if (!isAdmin) {
        return res.status(403).json({ message: "Only administrators can link connections for other users." });
      }
      targetUserId = requestedUserId;
    }

    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/userinfo.email"
      ],
      state: String(targetUserId) // Pass targeted user ID to associate token
    });
    res.json({ url });
  });

  app.get("/api/auth/gmail/callback", async (req, res) => {
    const { code, state: userId } = req.query;
    console.log("GMAIL_CALLBACK_RECEIVED:", { code: code ? "EXISTS" : "MISSING", userId });
    try {
      // Use a local client to avoid race conditions
      const client = new google.auth.OAuth2(
        G_CLIENT_ID,
        G_CLIENT_SECRET,
        G_REDIRECT_URI
      );
      
      console.log("GMAIL_TOKEN_EXCHANGE_START:", {
        clientIdPrefix: G_CLIENT_ID ? G_CLIENT_ID.substring(0, 15) : "NONE",
        clientIdSuffix: G_CLIENT_ID ? G_CLIENT_ID.substring(G_CLIENT_ID.length - 15) : "NONE",
        secretPrefix: G_CLIENT_SECRET ? G_CLIENT_SECRET.substring(0, 5) : "NONE",
        secretSuffix: G_CLIENT_SECRET ? G_CLIENT_SECRET.substring(G_CLIENT_SECRET.length - 5) : "NONE",
        redirectUri: G_REDIRECT_URI,
        codePrefix: (code as string).substring(0, 10)
      });

      // Manual exchange with axios using x-www-form-urlencoded
      const tokenParams = {
        code: code as string,
        client_id: G_CLIENT_ID,
        client_secret: G_CLIENT_SECRET,
        redirect_uri: G_REDIRECT_URI,
        grant_type: "authorization_code"
      };

      let tokenResponse;
      try {
        tokenResponse = await axios.post("https://oauth2.googleapis.com/token", 
          new URLSearchParams(tokenParams).toString(),
          {
            headers: {
              "Content-Type": "application/x-www-form-urlencoded"
            }
          }
        );
      } catch (err: any) {
        const errorData = err.response?.data;
        console.error("GOOGLE_TOKEN_EXCHANGE_RAW_ERROR:", {
          status: err.response?.status,
          data: errorData,
          message: err.message
        });
        
        // Return a cleaner error page to the user
        const errorMsg = typeof errorData === 'object' ? JSON.stringify(errorData) : String(errorData || err.message);
        const secretInfo = G_CLIENT_SECRET ? `${G_CLIENT_SECRET.substring(0, 5)}...${G_CLIENT_SECRET.substring(G_CLIENT_SECRET.length - 5)} (Length: ${G_CLIENT_SECRET.length})` : "NONE";
        const idInfo = G_CLIENT_ID ? `${G_CLIENT_ID.substring(0, 15)}... (Length: ${G_CLIENT_ID.length})` : "NONE";
        
        const rawGcid = process.env.GOOGLE_CLIENT_ID;
        const rawViteGcid = process.env.VITE_GOOGLE_CLIENT_ID;
        const diagIdInfo = `
          GOOGLE_CLIENT_ID: ${rawGcid ? rawGcid.substring(0, 10) + "..." : "NONE"}<br/>
          VITE_GOOGLE_CLIENT_ID: ${rawViteGcid ? rawViteGcid.substring(0, 10) + "..." : "NONE"}
        `;

        return res.status(err.response?.status || 500).send(`
          <html>
            <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f8d7da; color: #721c24;">
              <div style="padding: 20px; border: 1px solid #f5c6cb; border-radius: 8px; background-color: #fff; max-width: 600px; text-align: center; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <h2 style="margin-top: 0;">OAuth Authentication Failed</h2>
                <p>Google returned an error during token exchange:</p>
                <pre style="text-align: left; background: #eee; padding: 10px; border-radius: 4px; overflow-x: auto;">${errorMsg}</pre>
                
                <div style="text-align: left; margin: 15px 0; padding: 10px; border: 1px solid #ddd; background: #fafafa; font-size: 13px;">
                  <strong>Diagnostics:</strong><br/>
                  ${diagIdInfo}<br/>
                  Resolved ID: <code style="color: blue;">${idInfo}</code><br/>
                  Secret being used: <code style="color: blue;">${secretInfo}</code><br/>
                  Redirect URI: <code style="color: blue;">${G_REDIRECT_URI}</code>
                </div>

                <p>Please verify your <strong>GOOGLE_CLIENT_ID</strong> and <strong>GOOGLE_CLIENT_SECRET</strong> in AI Studio Settings.</p>
                <p style="font-size: 12px; color: #666;">Make sure there are no leading/trailing spaces or labels. Our system handles common paste errors, but double check.</p>
                <button onclick="window.close()" style="background-color: #721c24; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin-top: 10px;">Close Window</button>
              </div>
            </body>
          </html>
        `);
      }

      if (!tokenResponse || !tokenResponse.data) return; // Already handled above

      const tokens = tokenResponse.data;
      console.log("GMAIL_TOKENS_RECEIVED:", { hasRefreshToken: !!tokens.refresh_token });
      
      if (userId) {
        // Get user for email FIRST to verify
        client.setCredentials(tokens);
        const googleAuth = google.oauth2({ version: "v2", auth: client });
        const userInfo = await googleAuth.userinfo.get();
        const oauthEmail = userInfo.data.email || "";
        console.log("GMAIL_USER_INFO:", { email: oauthEmail });

        // START EMAIL MATCHING CHECK
        const registeredUser = await db("users").where({ id: userId as string }).first();
        if (registeredUser && oauthEmail.toLowerCase() !== registeredUser.email.toLowerCase()) {
          console.warn("GMAIL_OAUTH_EMAIL_MISMATCH:", { registered: registeredUser.email, oauth: oauthEmail });
          return res.send(`
            <html>
              <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f8d7da; color: #721c24;">
                <div style="padding: 20px; border: 1px solid #f5c6cb; border-radius: 8px; background-color: #fff; max-width: 500px; text-align: center; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                  <h2 style="margin-top: 0;">Email Mismatch</h2>
                  <p>The PM registered email (<strong>${registeredUser.email}</strong>) does not match against the Gmail account email (<strong>${oauthEmail}</strong>).</p>
                  <p>Connection has been revoked.</p>
                  <button onclick="window.close()" style="background-color: #721c24; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin-top: 10px;">Close Window</button>
                </div>
              </body>
            </html>
          `);
        }
        // END EMAIL MATCHING CHECK

        if (tokens.refresh_token) {
          // Update users table for legacy support ONLY after verification
          await db("users").where({ id: userId as string }).update({
            gmailRefreshToken: tokens.refresh_token,
            gmailConnected: true
          });
        }

        // Update or insert into connections
        const existing = await db("connections").where({ user_id: userId, provider: "gmail" }).first();
        const pendingRec = await db("connections").where({ user_id: userId, status: "pending" }).first();
        const targetId = existing?.id || pendingRec?.id;

        const updateData: any = {
          provider: "gmail",
          email: oauthEmail,
          status: "active"
        };
        if (tokens.refresh_token) {
          updateData.refresh_token = tokens.refresh_token;
        }

        if (targetId) {
          await db("connections").where({ id: targetId }).update(updateData);
        } else {
          await db("connections").insert({
            user_id: userId,
            ...updateData
          });
        }
      }
      res.send("<html><body><script>window.close()</script><p>Authenticated! You can close this.</p></body></html>");
    } catch (error: any) {
      console.error("GMAIL_OAUTH_CALLBACK_ERROR:", error.response?.data || error.message || error);
      res.status(500).send("OAuth failed: " + (error.message || "Unknown error"));
    }
  });

  // Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false 
      },
      appType: "custom", // Change to custom to handle index.html manually
    });
    app.use(vite.middlewares);
    
    app.get("*", async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(__dirname, "index.html"), "utf-8");
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
