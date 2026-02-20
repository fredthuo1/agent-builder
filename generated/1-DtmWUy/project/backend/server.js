import express from "express";
import cors from "cors";
import { openDb } from "./src/db.js";

const app = express();

// Avoid 304s / caching confusion for hackathon demos
app.disable("etag");

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// No-store responses to keep dev simple
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

const PORT = process.env.PORT || 5050;

const PLAN = {
  "appName": "Habit Tracker",
  "entities": [
    {
      "name": "habits",
      "title": "Habits",
      "fields": [
        {
          "name": "habit_name",
          "type": "string",
          "required": true
        },
        {
          "name": "frequency",
          "type": "enum",
          "required": true,
          "enumValues": [
            "daily",
            "weekly"
          ]
        },
        {
          "name": "streak",
          "type": "number",
          "required": true
        },
        {
          "name": "last_completed_date",
          "type": "date"
        },
        {
          "name": "active",
          "type": "boolean",
          "required": true
        }
      ]
    }
  ],
  "generationMode": "ai",
  "aiProvider": "openai"
};
const DEFAULTS_BY_ENTITY = {
  "habits": {
    "habit_name": null,
    "frequency": null,
    "streak": null,
    "last_completed_date": null,
    "active": 0
  }
};
const FIELDS_BY_ENTITY = {
  "habits": [
    {
      "name": "habit_name",
      "type": "string",
      "required": true,
      "enumValues": []
    },
    {
      "name": "frequency",
      "type": "enum",
      "required": true,
      "enumValues": [
        "daily",
        "weekly"
      ]
    },
    {
      "name": "streak",
      "type": "number",
      "required": true,
      "enumValues": []
    },
    {
      "name": "last_completed_date",
      "type": "date",
      "required": false,
      "enumValues": []
    },
    {
      "name": "active",
      "type": "boolean",
      "required": true,
      "enumValues": []
    }
  ]
};

function normalizeEntity(name) {
  return String(name || "").toLowerCase().replace(/[^a-z0-9_]/g, "");
}

function normalizePayload(entityName, payload) {
  const fields = FIELDS_BY_ENTITY[entityName] || [];
  const out = { ...(payload || {}) };
  const errors = [];

  for (const f of fields) {
    const v = out[f.name];

    // required check (only for create; update can omit)
    // we'll do required checks in POST
    if (v === undefined || v === null || v === "") continue;

    if (f.type === "number") {
      const n = Number(v);
      if (Number.isNaN(n)) errors.push(`${f.name} must be a number`);
      else out[f.name] = n;
      continue;
    }

    if (f.type === "boolean") {
      const b =
        v === true || v === "true" || v === 1 || v === "1"
          ? 1
          : v === false || v === "false" || v === 0 || v === "0"
          ? 0
          : null;
      if (b === null) errors.push(`${f.name} must be a boolean`);
      else out[f.name] = b;
      continue;
    }

    if (f.type === "date") {
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) errors.push(`${f.name} must be a valid date`);
      else out[f.name] = d.toISOString();
      continue;
    }

    if (f.type === "enum") {
      const allowed = f.enumValues || [];
      const s = String(v);
      if (!allowed.includes(s)) errors.push(`${f.name} must be one of: ${allowed.join(", ")}`);
      else out[f.name] = s;
      continue;
    }

    // string/text
    out[f.name] = String(v);
  }

  return { out, errors };
}

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.get("/api/spec", (_req, res) => res.json(PLAN));

app.get("/api/:entity", async (req, res) => {
  const entity = normalizeEntity(req.params.entity);
  const db = await openDb();

  const valid = PLAN.entities.find((e) => e.name === entity);
  if (!valid) return res.status(404).json({ error: "Unknown entity" });

  const limit = Math.min(Number(req.query.limit || 50), 200);
  const offset = Math.max(Number(req.query.offset || 0), 0);
  const orderBy = String(req.query.orderBy || "id");
  const orderDir = String(req.query.orderDir || "desc").toLowerCase() === "asc" ? "asc" : "desc";

  // allow ordering only by known columns
  const allowedCols = new Set(["id", ...valid.fields.map((f) => f.name)]);
  const safeOrderBy = allowedCols.has(orderBy) ? orderBy : "id";

  const rows = await db.all(
    `SELECT * FROM ${entity} ORDER BY ${safeOrderBy} ${orderDir} LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  res.json({ items: rows, limit, offset });
});

app.get("/api/:entity/:id", async (req, res) => {
  const entity = normalizeEntity(req.params.entity);
  const id = Number(req.params.id);
  const db = await openDb();

  const valid = PLAN.entities.find((e) => e.name === entity);
  if (!valid) return res.status(404).json({ error: "Unknown entity" });

  const row = await db.get(`SELECT * FROM ${entity} WHERE id = ?`, [id]);
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
});

app.post("/api/:entity", async (req, res) => {
  const entity = normalizeEntity(req.params.entity);
  const db = await openDb();

  const valid = PLAN.entities.find((e) => e.name === entity);
  if (!valid) return res.status(404).json({ error: "Unknown entity" });

  const payload = req.body || {};

  // required checks on create
  const required = (valid.fields || []).filter((f) => f.required).map((f) => f.name);
  const missing = required.filter((k) => payload[k] === undefined || payload[k] === null || payload[k] === "");
  if (missing.length) return res.status(400).json({ error: "Validation failed", details: missing.map((m) => `${m} is required`) });

  const norm = normalizePayload(entity, payload);
  if (norm.errors.length) return res.status(400).json({ error: "Validation failed", details: norm.errors });

  const cols = valid.fields.map((f) => f.name);

  const defaults = DEFAULTS_BY_ENTITY[entity] || {};
  const values = cols.map((c) => (norm.out[c] ?? defaults[c] ?? null));

  const placeholders = cols.map(() => "?").join(", ");
  const sql = `INSERT INTO ${entity} (${cols.join(", ")}) VALUES (${placeholders})`;

  const result = await db.run(sql, values);
  const created = await db.get(`SELECT * FROM ${entity} WHERE id = ?`, [result.lastID]);
  res.status(201).json(created);
});

app.put("/api/:entity/:id", async (req, res) => {
  const entity = normalizeEntity(req.params.entity);
  const id = Number(req.params.id);
  const db = await openDb();

  const valid = PLAN.entities.find((e) => e.name === entity);
  if (!valid) return res.status(404).json({ error: "Unknown entity" });

  const payload = req.body || {};
  const norm = normalizePayload(entity, payload);
  if (norm.errors.length) return res.status(400).json({ error: "Validation failed", details: norm.errors });

  const cols = valid.fields.map((f) => f.name);

  const sets = cols.map((c) => `${c} = ?`).join(", ");
  const values = cols.map((c) => (norm.out[c] ?? null));

  const sql = `UPDATE ${entity} SET ${sets} WHERE id = ?`;
  await db.run(sql, [...values, id]);

  const updated = await db.get(`SELECT * FROM ${entity} WHERE id = ?`, [id]);
  if (!updated) return res.status(404).json({ error: "Not found" });
  res.json(updated);
});

app.delete("/api/:entity/:id", async (req, res) => {
  const entity = normalizeEntity(req.params.entity);
  const id = Number(req.params.id);
  const db = await openDb();

  const valid = PLAN.entities.find((e) => e.name === entity);
  if (!valid) return res.status(404).json({ error: "Unknown entity" });

  await db.run(`DELETE FROM ${entity} WHERE id = ?`, [id]);
  res.json({ ok: true });
});

async function init() {
  const db = await openDb();
  await db.exec(`CREATE TABLE IF NOT EXISTS habits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  habit_name TEXT NOT NULL,
  frequency TEXT NOT NULL,
  streak REAL NOT NULL,
  last_completed_date TEXT,
  active INTEGER NOT NULL
);`);
}

init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Backend running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to init DB", err);
    process.exit(1);
  });
