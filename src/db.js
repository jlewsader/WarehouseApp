import sqlite3 from "sqlite3";

// Enable verbose mode to prevent silent failures
sqlite3.verbose();

export function connectDB() {
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