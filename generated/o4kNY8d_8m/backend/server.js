
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import sqlite3 from "sqlite3";

const app = express();
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());
app.use(cors());

const db = new sqlite3.Database("data.sqlite");

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      done INTEGER DEFAULT 0
    )
  `);
});

app.get("/api/health", (_, res) => {
  res.json({ ok: true });
});

app.get("/api/tasks", (_, res) => {
  db.all("SELECT * FROM tasks ORDER BY id DESC", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ tasks: rows.map(r => ({ ...r, done: !!r.done })) });
  });
});

app.post("/api/tasks", (req, res) => {
  const title = String(req.body?.title || "").trim();
  if (!title) return res.status(400).json({ error: "Title required" });

  db.run("INSERT INTO tasks (title) VALUES (?)", [title], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, title, done: false });
  });
});

app.delete("/api/tasks/:id", (req, res) => {
  db.run("DELETE FROM tasks WHERE id = ?", [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true });
  });
});

const PORT = 5050;
app.listen(PORT, () => {
  console.log("Backend running on http://localhost:" + PORT);
});
