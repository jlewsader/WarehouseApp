import sqlite3 from "sqlite3";

export function connectDB() {
  const db = new sqlite3.Database("./warehouse.db", (err) => {
    if (err) {
      console.error("Failed to connect to DB:", err);
    } else {
      console.log("SQLite DB connected.");
    }
  });
  return db;
}