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
  "appName": "DogMarket",
  "entities": [
    {
      "name": "dogs",
      "title": "Dogs",
      "fields": [
        {
          "name": "name",
          "type": "string",
          "required": true
        },
        {
          "name": "breed",
          "type": "string",
          "required": true
        },
        {
          "name": "sex",
          "type": "enum",
          "required": true,
          "enumValues": [
            "male",
            "female"
          ]
        },
        {
          "name": "size",
          "type": "enum",
          "required": true,
          "enumValues": [
            "small",
            "medium",
            "large"
          ]
        },
        {
          "name": "age_months",
          "type": "number",
          "required": true
        },
        {
          "name": "price",
          "type": "number",
          "required": true
        },
        {
          "name": "available",
          "type": "boolean",
          "required": true
        },
        {
          "name": "listed_date",
          "type": "date",
          "required": true
        },
        {
          "name": "description",
          "type": "text"
        },
        {
          "name": "vaccination_status",
          "type": "enum",
          "enumValues": [
            "none",
            "partial",
            "up_to_date"
          ]
        },
        {
          "name": "pedigree",
          "type": "boolean"
        }
      ]
    },
    {
      "name": "orders",
      "title": "Orders",
      "fields": [
        {
          "name": "dog_id",
          "type": "number",
          "required": true
        },
        {
          "name": "buyer_name",
          "type": "string",
          "required": true
        },
        {
          "name": "buyer_email",
          "type": "string",
          "required": true
        },
        {
          "name": "buyer_phone",
          "type": "string"
        },
        {
          "name": "shipping_address",
          "type": "text",
          "required": true
        },
        {
          "name": "order_status",
          "type": "enum",
          "required": true,
          "enumValues": [
            "pending",
            "paid",
            "shipped",
            "delivered",
            "cancelled"
          ]
        },
        {
          "name": "order_total",
          "type": "number",
          "required": true
        },
        {
          "name": "order_date",
          "type": "date",
          "required": true
        },
        {
          "name": "notes",
          "type": "text"
        },
        {
          "name": "payment_method",
          "type": "enum",
          "enumValues": [
            "card",
            "bank_transfer",
            "cash"
          ]
        }
      ]
    }
  ],
  "generationMode": "ai",
  "aiProvider": "openai"
};
const DEFAULTS_BY_ENTITY = {
  "dogs": {
    "name": null,
    "breed": null,
    "sex": null,
    "size": null,
    "age_months": null,
    "price": null,
    "available": 0,
    "listed_date": null,
    "description": null,
    "vaccination_status": null,
    "pedigree": 0
  },
  "orders": {
    "dog_id": null,
    "buyer_name": null,
    "buyer_email": null,
    "buyer_phone": null,
    "shipping_address": null,
    "order_status": null,
    "order_total": null,
    "order_date": null,
    "notes": null,
    "payment_method": null
  }
};
const FIELDS_BY_ENTITY = {
  "dogs": [
    {
      "name": "name",
      "type": "string",
      "required": true,
      "enumValues": []
    },
    {
      "name": "breed",
      "type": "string",
      "required": true,
      "enumValues": []
    },
    {
      "name": "sex",
      "type": "enum",
      "required": true,
      "enumValues": [
        "male",
        "female"
      ]
    },
    {
      "name": "size",
      "type": "enum",
      "required": true,
      "enumValues": [
        "small",
        "medium",
        "large"
      ]
    },
    {
      "name": "age_months",
      "type": "number",
      "required": true,
      "enumValues": []
    },
    {
      "name": "price",
      "type": "number",
      "required": true,
      "enumValues": []
    },
    {
      "name": "available",
      "type": "boolean",
      "required": true,
      "enumValues": []
    },
    {
      "name": "listed_date",
      "type": "date",
      "required": true,
      "enumValues": []
    },
    {
      "name": "description",
      "type": "text",
      "required": false,
      "enumValues": []
    },
    {
      "name": "vaccination_status",
      "type": "enum",
      "required": false,
      "enumValues": [
        "none",
        "partial",
        "up_to_date"
      ]
    },
    {
      "name": "pedigree",
      "type": "boolean",
      "required": false,
      "enumValues": []
    }
  ],
  "orders": [
    {
      "name": "dog_id",
      "type": "number",
      "required": true,
      "enumValues": []
    },
    {
      "name": "buyer_name",
      "type": "string",
      "required": true,
      "enumValues": []
    },
    {
      "name": "buyer_email",
      "type": "string",
      "required": true,
      "enumValues": []
    },
    {
      "name": "buyer_phone",
      "type": "string",
      "required": false,
      "enumValues": []
    },
    {
      "name": "shipping_address",
      "type": "text",
      "required": true,
      "enumValues": []
    },
    {
      "name": "order_status",
      "type": "enum",
      "required": true,
      "enumValues": [
        "pending",
        "paid",
        "shipped",
        "delivered",
        "cancelled"
      ]
    },
    {
      "name": "order_total",
      "type": "number",
      "required": true,
      "enumValues": []
    },
    {
      "name": "order_date",
      "type": "date",
      "required": true,
      "enumValues": []
    },
    {
      "name": "notes",
      "type": "text",
      "required": false,
      "enumValues": []
    },
    {
      "name": "payment_method",
      "type": "enum",
      "required": false,
      "enumValues": [
        "card",
        "bank_transfer",
        "cash"
      ]
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
  await db.exec(`CREATE TABLE IF NOT EXISTS dogs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  breed TEXT NOT NULL,
  sex TEXT NOT NULL,
  size TEXT NOT NULL,
  age_months REAL NOT NULL,
  price REAL NOT NULL,
  available INTEGER NOT NULL,
  listed_date TEXT NOT NULL,
  description TEXT,
  vaccination_status TEXT,
  pedigree INTEGER
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dog_id REAL NOT NULL,
  buyer_name TEXT NOT NULL,
  buyer_email TEXT NOT NULL,
  buyer_phone TEXT,
  shipping_address TEXT NOT NULL,
  order_status TEXT NOT NULL,
  order_total REAL NOT NULL,
  order_date TEXT NOT NULL,
  notes TEXT,
  payment_method TEXT
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
