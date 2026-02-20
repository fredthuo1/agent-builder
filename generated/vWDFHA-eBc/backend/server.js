
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import sqlite3 from "sqlite3";

const app = express();
app.disable("x-powered-by");
app.use(helmet());

// Log ONLY errors (clean demo console)
app.use(morgan("dev", { skip: (_req, res) => res.statusCode < 400 }));

app.use(express.json({ limit: "1mb" }));

// Disable caching to avoid 304 noise
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

app.use(cors({ origin: true }));

const db = new sqlite3.Database("data.sqlite");

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL,
      priority TEXT NOT NULL,
      due_date TEXT,
      is_archived INTEGER NOT NULL
    )
  `);
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.get("/api/tasks", (_req, res) => {
  db.all("SELECT id, title, description, status, priority, due_date, is_archived FROM tasks ORDER BY id DESC", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ items: rows || [] });
  });
});

app.post("/api/tasks", (req, res) => {
  const body = req.body || {};
  const cols = ["title","description","status","priority","due_date","is_archived"];
  const fields = [{"name":"title","type":"text","required":true},{"name":"description","type":"text","required":false},{"name":"status","type":"select","options":["Todo","In Progress","Review","Done"],"required":true},{"name":"priority","type":"select","options":["Low","Medium","High","Urgent"],"required":true},{"name":"due_date","type":"date","required":false},{"name":"is_archived","type":"boolean","required":true}];
  const vals = cols.map((c) => {
    const f = fields.find((x) => x.name === c);
    const v = body[c];
    if (f?.required && (v == null || String(v).trim() === "")) return "__MISSING__";
    if (f?.type === "boolean") return v ? 1 : 0;
    return v ?? null;
  });

  const missing = vals.findIndex((v) => v === "__MISSING__");
  if (missing !== -1) return res.status(400).json({ error: cols[missing] + " required" });

  db.run(
    "INSERT INTO tasks (" + cols.join(",") + ") VALUES (?, ?, ?, ?, ?, ?)",
    vals,
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      db.get("SELECT id, title, description, status, priority, due_date, is_archived FROM tasks WHERE id = ?", [this.lastID], (e2, row) => {
        if (e2) return res.status(500).json({ error: e2.message });
        res.json({ item: row });
      });
    }
  );
});

app.patch("/api/tasks/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "invalid id" });

  const body = req.body || {};
  const cols = ["title","description","status","priority","due_date","is_archived"];
  const fields = [{"name":"title","type":"text","required":true},{"name":"description","type":"text","required":false},{"name":"status","type":"select","options":["Todo","In Progress","Review","Done"],"required":true},{"name":"priority","type":"select","options":["Low","Medium","High","Urgent"],"required":true},{"name":"due_date","type":"date","required":false},{"name":"is_archived","type":"boolean","required":true}];
  const updates = [];
  const vals = [];

  for (const c of cols) {
    if (!(c in body)) continue;
    const f = fields.find((x) => x.name === c);
    let v = body[c];
    if (f?.type === "boolean") v = v ? 1 : 0;
    updates.push(c + " = ?");
    vals.push(v ?? null);
  }

  if (updates.length === 0) return res.status(400).json({ error: "no fields to update" });

  vals.push(id);
  db.run("UPDATE tasks SET " + updates.join(", ") + " WHERE id = ?", vals, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    db.get("SELECT id, title, description, status, priority, due_date, is_archived FROM tasks WHERE id = ?", [id], (e2, row) => {
      if (e2) return res.status(500).json({ error: e2.message });
      if (!row) return res.status(404).json({ error: "not found" });
      res.json({ item: row });
    });
  });
});

app.delete("/api/tasks/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "invalid id" });

  db.run("DELETE FROM tasks WHERE id = ?", [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true });
  });
});

app.listen(5050, () => console.log("Backend running on http://localhost:5050"));
