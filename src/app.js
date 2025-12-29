import https from "https";
import express from "express";
import cors from "cors";
import session from "express-session";
import fs from "fs";
import path from "path";
import { connectDB } from "./db.js";
import productsRouter from "./routes/products.js";
import inventoryRouter from "./routes/inventory.js";
import locationsRouter from "./routes/locations.js";
import createAdminRoutes from "./routes/admin.js";
import createDropdownRoutes from "./routes/dropdowns.js";
import { createAuthRoutes } from "./middleware/auth.js";


const options = {
  key: fs.readFileSync("certs/localhost+3-key.pem"),
  cert: fs.readFileSync("certs/localhost+3.pem"),
};


const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Session middleware for authentication
app.use(session({
  secret: process.env.SESSION_SECRET || 'warehouse-admin-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true if using HTTPS only
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

app.get("/tunnel-ping", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.json({ status: "ok", tunnel: "active" });
});

app.use((req, res, next) => {
  // Turn off GitHub "CHII" inspector for Safari
  res.setHeader("X-Chii-Ignore", "true");
  next();
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

const PORT = process.env.PORT || 3001;
const HOST = "0.0.0.0";

https.createServer(options, app).listen(PORT, HOST, () => {
  console.log(`HTTPS server running on https://${HOST}:${PORT}`);
});

const init = () => {
  const db = connectDB();
  app.locals.db = db;

  // Load schema.sql from models folder
  const schemaPath = path.resolve("src/models/schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf8");

  db.exec(schema, (err) => {
    if (err) {
      console.error("Failed to initialize schema:", err);
    } else {
      console.log("Database schema loaded.");

      // Load admin seed data (dropdown options and default admin user)
      const adminSeedPath = path.resolve("src/models/admin-seed.sql");
      const adminSeed = fs.readFileSync(adminSeedPath, "utf8");
      
      db.exec(adminSeed, (seedErr) => {
        if (seedErr) {
          console.error("Failed to load admin seed data:", seedErr);
        } else {
          console.log("Admin seed data loaded (dropdowns & default user).");
        }
      });

      // Ensure UNASSIGNED location exists
      db.run(
        `
        INSERT OR IGNORE INTO locations (id, label, row_index, col_index, zone)
        VALUES (9999, 'UNASSIGNED', 0, 0, 'UNASSIGNED')
        `,
        (err2) => {
          if (err2) {
            console.error("Failed to seed UNASSIGNED location:", err2);
          } else {
            console.log("UNASSIGNED location ready.");
          }
        }
      );
    }

    // Create auth routes
    const authRoutes = createAuthRoutes(db);
    app.post("/api/auth/login", authRoutes.login);
    app.post("/api/auth/logout", authRoutes.logout);
    app.get("/api/auth/check", authRoutes.checkAuth);

    // Register API routes
    app.use("/api/products", productsRouter);
    app.use("/api/inventory", inventoryRouter);
    app.use("/api/locations", locationsRouter);
    app.use("/api/admin", createAdminRoutes(db));
    app.use("/api/dropdowns", createDropdownRoutes(db));
  });
};

init();