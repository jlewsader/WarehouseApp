import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { connectDB } from "./db.js";
import productsRouter from "./routes/products.js";
import inventoryRouter from "./routes/inventory.js";
import locationsRouter from "./routes/locations.js";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

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

const PORT = process.env.PORT || 4000;

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

  // Register API routes
  app.use("/api/products", productsRouter);
  app.use("/api/inventory", inventoryRouter);
  app.use("/api/locations", locationsRouter);

  app.listen(PORT, () => {
    console.log(`Warehouse API running on port ${PORT}`);
  });
});

  // Register API routes
  console.log("Registering routes...");
  app.use("/api/products", productsRouter);
  app.use("/api/inventory", inventoryRouter);
  app.use("/api/locations", locationsRouter);
  console.log("Routes registered.");

  app.listen(PORT, () => {
    console.log(`Warehouse API running on port ${PORT}`);
  });
};


init();