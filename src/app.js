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
app.use(express.static("public"));
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

const PORT = process.env.PORT || 3000;

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
    }
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