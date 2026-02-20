import sqlite3 from "sqlite3";
import { open } from "sqlite";
import path from "path";
import fs from "fs/promises";

let dbPromise;

export async function openDb() {
  if (dbPromise) return dbPromise;

  const dataDir = path.join(process.cwd(), "data");
  await fs.mkdir(dataDir, { recursive: true });

  const file = path.join(dataDir, "app.db");

  dbPromise = open({
    filename: file,
    driver: sqlite3.Database,
  });

  return dbPromise;
}
