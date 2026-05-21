import knex from "knex";

const db = knex({
  client: "mysql2",
  connection: {
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    port: Number(process.env.MYSQL_PORT) || 3306,
  },
});

export async function initSchema() {
  try {
    const hasUsers = await db.schema.hasTable("users");
    if (!hasUsers) {
      await db.schema.createTable("users", (table) => {
        table.increments("id").primary();
        table.string("email", 255).unique().notNullable();
        table.string("password", 255).notNullable();
        table.string("displayName", 255);
        table.string("role", 50).defaultTo("pm");
        table.string("gmailRefreshToken", 255);
        table.boolean("gmailConnected").defaultTo(false);
        table.integer("manager_id").unsigned();
        table.integer("created_by").unsigned();
        table.timestamps(true, true);
      });
      console.log("Users table created");
    } else {
      // Check for missing columns and add them
      const columns = await db("users").columnInfo();
      
      // If id was a string previously, we might need to be careful, but we'll try to ensure it's increments
      // In a real migration we'd do more, but here we can try to alter or just ensure other columns exist
      await db.schema.alterTable("users", (table) => {
        if (!columns.displayName) {
          table.string("displayName", 255);
        }
        
        if (!columns.full_name) {
          table.string("full_name", 255);
        }
        
        if (!columns.gmailRefreshToken) {
          table.string("gmailRefreshToken", 255);
        }
        if (!columns.gmailConnected) {
          table.boolean("gmailConnected").defaultTo(false);
        }
        if (!columns.manager_id) {
          table.integer("manager_id").unsigned();
        }
        
        if (!columns.created_at) {
          table.timestamp("created_at").defaultTo(db.fn.now());
        }
        if (!columns.updated_at) {
          table.timestamp("updated_at").defaultTo(db.fn.now());
        }
        
        table.string("role", 50).alter();
      });
      console.log("Users table schema updated");
    }

    const hasClients = await db.schema.hasTable("clients");
    if (!hasClients) {
      await db.schema.createTable("clients", (table) => {
        table.increments("id").primary();
        table.string("name", 255).notNullable();
        table.text("url");
        table.text("emailIdentifiers"); // JSON string
        table.integer("pmId").unsigned();
        table.integer("created_by").unsigned();
        table.string("created_by_name", 255);
        table.timestamps(true, true);
      });
      console.log("Clients table created");
    } else {
      const columns = await db("clients").columnInfo();
      await db.schema.alterTable("clients", (table) => {
        if (!columns.url) table.text("url");
        if (!columns.created_by_name) table.string("created_by_name", 255);
        if (!columns.emailIdentifiers) table.text("emailIdentifiers");
        if (!columns.created_by) table.integer("created_by").unsigned();
        if (columns.email_identifier) {
          table.string("email_identifier", 255).nullable().alter();
        }
        if (!columns.pmId) {
          table.integer("pmId").unsigned();
        } else if (columns.pmId.type !== "int") {
          table.integer("pmId").unsigned().alter();
        }

        if (!columns.created_at) {
          table.timestamp("created_at").defaultTo(db.fn.now());
        }
        if (!columns.updated_at) {
          table.timestamp("updated_at").defaultTo(db.fn.now());
        }
      });
      console.log("Clients table schema updated");
      
      // FORCED CLEANUP AS REQUESTED BY USER: "delete all the clients previously added"
      // We already ran this once. Commenting out to prevent deletion on every restart.
      /*
      await db("email_logs").delete();
      await db("projects").delete();
      await db("clients").delete();
      console.log("CLEANUP: Deleted all existing clients and projects for a fresh start.");
      */
    }

    const hasBusinessUnits = await db.schema.hasTable("business_units");
    if (!hasBusinessUnits) {
      await db.schema.createTable("business_units", (table) => {
        table.increments("id").primary();
        table.string("name", 255).notNullable();
        table.timestamps(true, true);
      });
      console.log("Business units table created");
    }

    // Force/Reset Business Units to the requested set
    try {
      const targetBUs = [
        { id: 1, name: "DWS Signature" },
        { id: 2, name: "Wytlabs" },
        { id: 3, name: "CollabX" },
        { id: 4, name: "Smegoweb IND" },
        { id: 5, name: "Smegoweb NZ" }
      ];

      for (const bu of targetBUs) {
        const existing = await db("business_units").where({ id: bu.id }).first();
        if (existing) {
          await db("business_units").where({ id: bu.id }).update({ name: bu.name });
        } else {
          await db("business_units").insert(bu);
        }
      }
      
      // Safety check: remove any other entries
      await db("business_units").whereNotIn("id", targetBUs.map(b => b.id)).delete();
      console.log("Business units reset and synchronized successfully");
    } catch (buErr) {
      console.error("Error synchronizing business units:", buErr);
    }

    const hasProjects = await db.schema.hasTable("projects");
    if (!hasProjects) {
      await db.schema.createTable("projects", (table) => {
        table.increments("id").primary();
        table.string("name", 255).notNullable();
        table.string("startDate", 100);
        table.string("start_date", 100);
        table.integer("clientId").unsigned().references("id").inTable("clients");
        table.integer("client_id").unsigned().references("id").inTable("clients");
        table.integer("pmId").unsigned().references("id").inTable("users");
        table.integer("pm_id").unsigned().references("id").inTable("users");
        table.integer("business_unit_id").unsigned().references("id").inTable("business_units");
        table.string("status", 50).defaultTo("active");
        table.integer("created_by").unsigned();
        table.timestamps(true, true);
      });
      console.log("Projects table created");
    } else {
      const columns = await db("projects").columnInfo();
      await db.schema.alterTable("projects", (table) => {
        if (!columns.startDate) {
          table.string("startDate", 100);
        }
        if (!columns.start_date) {
          table.string("start_date", 100);
        }

        if (!columns.created_by) {
          table.integer("created_by").unsigned();
        } else if (columns.created_by.type !== "int") {
          table.integer("created_by").unsigned().alter();
        }

        if (!columns.pmId) {
          table.integer("pmId").unsigned();
        }
        if (!columns.pm_id) {
          table.integer("pm_id").unsigned();
        }

        if (!columns.clientId) {
          table.integer("clientId").unsigned();
        }
        if (!columns.client_id) {
          table.integer("client_id").unsigned();
        }

        if (!columns.pmm_id) {
          table.integer("pmm_id").unsigned();
        }

        if (!columns.business_unit_id) {
          table.integer("business_unit_id").unsigned();
        }

        if (!columns.created_at) {
          table.timestamp("created_at").defaultTo(db.fn.now());
        }
        if (!columns.updated_at) {
          table.timestamp("updated_at").defaultTo(db.fn.now());
        }
      });
    }

    const hasLogs = await db.schema.hasTable("email_logs");
    if (!hasLogs) {
      await db.schema.createTable("email_logs", (table) => {
        table.increments("id").primary();
        table.string("messageId", 255).unique();
        table.string("threadId", 255);
        table.integer("projectId").unsigned().references("id").inTable("projects");
        table.string("sender", 255);
        table.string("receiver", 255);
        table.string("subject", 255);
        table.timestamp("timestamp");
        table.text("body", "longtext");
        table.timestamps(true, true);
      });
      console.log("Email logs table created");
    } else {
      const columns = await db("email_logs").columnInfo();
      await db.schema.alterTable("email_logs", (table) => {
        if (!columns.projectId) {
          table.integer("projectId").unsigned();
        } else if (columns.projectId.type !== "int") {
          table.integer("projectId").unsigned().alter();
        }

        if (!columns.created_at) {
          table.timestamp("created_at").defaultTo(db.fn.now());
        }
        if (!columns.updated_at) {
          table.timestamp("updated_at").defaultTo(db.fn.now());
        }
      });
    }

    const hasConn = await db.schema.hasTable("connections");
    if (!hasConn) {
      await db.schema.createTable("connections", (table) => {
        table.increments("id").primary();
        table.integer("user_id").unsigned().notNullable();
        table.string("provider", 50).defaultTo("gmail");
        table.string("email", 255);
        table.text("refresh_token");
        table.string("status", 50).defaultTo("pending");
        table.timestamps(true, true);
      });
      console.log("Connections table created");
    } else {
      const columns = await db("connections").columnInfo();
      if (columns.user_id && columns.user_id.type !== "int") {
        await db.schema.alterTable("connections", (table) => {
          table.integer("user_id").unsigned().notNullable().alter();
        });
      }

      await db.schema.alterTable("connections", (table) => {
        if (!columns.created_at) {
          table.timestamp("created_at").defaultTo(db.fn.now());
        }
        if (!columns.updated_at) {
          table.timestamp("updated_at").defaultTo(db.fn.now());
        }
        // Force status column to string(50) to support larger statuses like 'expired'
        table.string("status", 50).defaultTo("pending").alter();
      });
    }

    const hasInbox = await db.schema.hasTable("inbox");
    if (!hasInbox) {
      await db.schema.createTable("inbox", (table) => {
        table.increments("id").primary();
        table.timestamp("email_date");
        table.string("subject", 500);
        table.integer("pm_id").unsigned();
        table.integer("client_id").unsigned();
        table.integer("project_id").unsigned();
        table.string("from_address", 255);
        table.string("source_role", 20); // PM or PMM
        table.text("body", "longtext");
        table.string("message_id", 255);
        table.boolean("has_attachments").defaultTo(false);
        table.text("attachments_json"); // Store metadata lists if needed
        table.timestamps(true, true);
      });
      console.log("Inbox table created");
    } else {
      const columns = await db("inbox").columnInfo();
      const typeJustAdded = !columns.type;
      await db.schema.alterTable("inbox", (table) => {
        if (!columns.attachments_json) table.text("attachments_json");
        if (!columns.project_id) table.integer("project_id").unsigned();
        if (!columns.type) table.string("type", 50).defaultTo("INBOX");
        if (!columns.to_address) table.string("to_address", 255);
        if (!columns.source_role) table.string("source_role", 20);
      });

      // Drop unique constraint on message_id if it exists to allow PM/PMM overlaps
      try {
        await db.schema.alterTable("inbox", (table) => {
          table.dropUnique(["message_id"]);
        });
        console.log("Dropped unique constraint on message_id in inbox table");
      } catch (e) {
        // Index might not exist or already dropped
      }

      if (typeJustAdded) {
        await db("inbox").whereNull("type").update({ type: "INBOX" });
      }
    }

    const hasCronLogs = await db.schema.hasTable("cron_logs");
    if (!hasCronLogs) {
      await db.schema.createTable("cron_logs", (table) => {
        table.increments("id").primary();
        table.string("level", 20).defaultTo("info"); // info, error, success
        table.text("message");
        table.timestamp("created_at").defaultTo(db.fn.now());
      });
      console.log("Cron logs table created");
    }
    
    console.log("MySQL Database schema ensured");
  } catch (error) {
    console.error("Error initializing schema:", error);
    // If we can't connect, let the server start but log the error
    // It will fail on the first request anyway, but this gives visibility
  }
}

export default db;
