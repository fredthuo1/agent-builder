import express from "express";
import cors from "cors";
import sqlite3 from "sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, "data.sqlite");
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run("CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, done INTEGER DEFAULT 0)");
});

app.post("/api/login", (req, res) => res.json({ token: "demo-token" }));

app.get("/api/tasks", (req, res) => {
  db.all("SELECT id, title, done FROM tasks ORDER BY id DESC", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ tasks: rows.map(r => ({...r, done: !!r.done})) });
  });
});

app.post("/api/tasks", (req, res) => {
  const title = String(req.body?.title || "").trim();
  if (!title) return res.status(400).json({ error: "title required" });
  db.run("INSERT INTO tasks (title, done) VALUES (?, 0)", [title], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, title, done: false });
  });
});

app.delete("/api/tasks/:id", (req, res) => {
  const id = Number(req.params.id);
  db.run("DELETE FROM tasks WHERE id = ?", [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true });
  });
});

const port = process.env.PORT || 5050;
app.listen(port, () => console.log("Backend running on http://localhost:" + port));
