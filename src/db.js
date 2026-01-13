import sqlite3 from "sqlite3";
import fs from "fs";
import path from "path";

// Enable verbose mode to prevent silent failures
sqlite3.verbose();

export function connectDB() {
  // Ensure data directory exists before opening database
  const dataDir = path.resolve("./data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log("Created data directory:", dataDir);
  }

  const db = new sqlite3.Database("./data/warehouse.db", sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
      console.error("Failed to connect to DB:", err);
    } else {
      console.log("SQLite DB connected.");
    }
  });

  // Force serialized mode so .exec() and route registration never freeze
  db.serialize();

  return db;
}