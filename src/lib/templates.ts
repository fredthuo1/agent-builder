import type { AppPlan, EntitySpec, FieldSpec } from "./types";

function json(obj: any) {
  return JSON.stringify(obj, null, 2);
}

function toTitle(s: string) {
  if (!s) return s;
  return s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function sqlType(f: FieldSpec) {
  switch (f.type) {
    case "number":
      return "REAL";
    case "boolean":
      return "INTEGER";
    case "date":
      return "TEXT";
    case "enum":
      return "TEXT";
    case "text":
      return "TEXT";
    case "string":
    default:
      return "TEXT";
  }
}

function defaultValueSQL(f: FieldSpec) {
  if (f.type === "boolean") return "0";
  return "NULL";
}

function backendServer(plan: AppPlan) {
  const entities = plan.entities;

  const entityTableSql = entities
    .map((e) => {
      const cols = e.fields
        .map((f) => {
          const notNull = f.required ? " NOT NULL" : "";
          return `  ${f.name} ${sqlType(f)}${notNull}`;
        })
        .join(",\n");
      return `
CREATE TABLE IF NOT EXISTS ${e.name} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
${cols}
);
`.trim();
    })
    .join("\n\n");

  // Build defaults for each entity at generation-time (safe) as plain JSON,
  // so runtime never needs "valid" for defaults.
  const defaultsByEntity: Record<string, Record<string, any>> = {};
  for (const e of entities) {
    const obj: Record<string, any> = {};
    for (const f of e.fields) {
      if (f.type === "boolean") obj[f.name] = 0;
      else obj[f.name] = null;
    }
    defaultsByEntity[e.name] = obj;
  }

  // Also embed field metadata so backend can normalize types safely.
  const fieldsByEntity: Record<string, Array<{ name: string; type: string; required?: boolean; enumValues?: string[] }>> =
    {};
  for (const e of entities) {
    fieldsByEntity[e.name] = e.fields.map((f) => ({
      name: f.name,
      type: f.type,
      required: !!f.required,
      enumValues: f.enumValues || [],
    }));
  }

  return `import express from "express";
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

const PLAN = ${json(plan)};
const DEFAULTS_BY_ENTITY = ${json(defaultsByEntity)};
const FIELDS_BY_ENTITY = ${json(fieldsByEntity)};

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
      if (Number.isNaN(n)) errors.push(\`\${f.name} must be a number\`);
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
      if (b === null) errors.push(\`\${f.name} must be a boolean\`);
      else out[f.name] = b;
      continue;
    }

    if (f.type === "date") {
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) errors.push(\`\${f.name} must be a valid date\`);
      else out[f.name] = d.toISOString();
      continue;
    }

    if (f.type === "enum") {
      const allowed = f.enumValues || [];
      const s = String(v);
      if (!allowed.includes(s)) errors.push(\`\${f.name} must be one of: \${allowed.join(", ")}\`);
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
    \`SELECT * FROM \${entity} ORDER BY \${safeOrderBy} \${orderDir} LIMIT ? OFFSET ?\`,
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

  const row = await db.get(\`SELECT * FROM \${entity} WHERE id = ?\`, [id]);
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
  if (missing.length) return res.status(400).json({ error: "Validation failed", details: missing.map((m) => \`\${m} is required\`) });

  const norm = normalizePayload(entity, payload);
  if (norm.errors.length) return res.status(400).json({ error: "Validation failed", details: norm.errors });

  const cols = valid.fields.map((f) => f.name);

  const defaults = DEFAULTS_BY_ENTITY[entity] || {};
  const values = cols.map((c) => (norm.out[c] ?? defaults[c] ?? null));

  const placeholders = cols.map(() => "?").join(", ");
  const sql = \`INSERT INTO \${entity} (\${cols.join(", ")}) VALUES (\${placeholders})\`;

  const result = await db.run(sql, values);
  const created = await db.get(\`SELECT * FROM \${entity} WHERE id = ?\`, [result.lastID]);
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

  const sets = cols.map((c) => \`\${c} = ?\`).join(", ");
  const values = cols.map((c) => (norm.out[c] ?? null));

  const sql = \`UPDATE \${entity} SET \${sets} WHERE id = ?\`;
  await db.run(sql, [...values, id]);

  const updated = await db.get(\`SELECT * FROM \${entity} WHERE id = ?\`, [id]);
  if (!updated) return res.status(404).json({ error: "Not found" });
  res.json(updated);
});

app.delete("/api/:entity/:id", async (req, res) => {
  const entity = normalizeEntity(req.params.entity);
  const id = Number(req.params.id);
  const db = await openDb();

  const valid = PLAN.entities.find((e) => e.name === entity);
  if (!valid) return res.status(404).json({ error: "Unknown entity" });

  await db.run(\`DELETE FROM \${entity} WHERE id = ?\`, [id]);
  res.json({ ok: true });
});

async function init() {
  const db = await openDb();
  await db.exec(\`${entityTableSql.replace(/`/g, "\\`")}\`);
}

init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(\`Backend running on http://localhost:\${PORT}\`);
    });
  })
  .catch((err) => {
    console.error("Failed to init DB", err);
    process.exit(1);
  });
`;
}

function backendDb() {
  return `import sqlite3 from "sqlite3";
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
`;
}

function backendPkg() {
  return json({
    name: "backend",
    private: true,
    type: "module",
    scripts: {
      dev: "node server.js",
    },
    dependencies: {
      cors: "^2.8.5",
      express: "^4.19.2",
      sqlite: "^5.1.1",
      sqlite3: "^5.1.7",
    },
  });
}

function frontendPkg() {
  return json({
    name: "frontend",
    private: true,
    scripts: {
      dev: "next dev -p 3001",
      build: "next build",
      start: "next start -p 3001",
    },
    dependencies: {
      next: "^15.5.12",
      react: "^18.3.1",
      "react-dom": "^18.3.1",
    },
  });
}

function rootPkg(plan: AppPlan) {
  const safeName =
    plan.appName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "generated-app";

  return json({
    name: safeName,
    private: true,
    workspaces: ["backend", "frontend"],
    scripts: {
      // One install at root installs all workspace deps. No recursion.
      dev: 'concurrently -k -n BACKEND,FRONTEND "npm -w backend run dev" "npm -w frontend run dev"',
      "dev:backend": "npm -w backend run dev",
      "dev:frontend": "npm -w frontend run dev",

      // Optional helper (safe) — user runs `npm run setup`
      setup: "npm install",
    },
    devDependencies: {
      concurrently: "^9.0.1",
    },
  });
}

function rootReadme(plan: AppPlan) {
  const ents = plan.entities.map((e) => `- **${toTitle(e.title || e.name)}** \`/api/${e.name}\``).join("\n");
  return `# ${plan.appName}

Generated by Agent Builder.

## What's included
- **Backend**: Express + SQLite (port **5050**)
- **Frontend**: Next.js (port **3001**)
- **Spec**: \`spec.json\` and \`GET /api/spec\`

## Run locally
\`\`\`bash
npm install
npm run dev
\`\`\`

## URLs
- Frontend: http://localhost:3001
- Backend health: http://localhost:5050/api/health
- Spec: http://localhost:5050/api/spec

## Entities
${ents}

## Notes
- Backend responses use \`Cache-Control: no-store\` and ETag is disabled to avoid 304 confusion in demos.
`;
}

function nextConfig() {
  // Avoid Next "workspace root / lockfile" warnings by tracing from workspace root.
  // In a workspaces setup, root is correct.
  return `/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: process.cwd(),
};

module.exports = nextConfig;
`;
}

function frontendCss() {
  return `:root {
  --bg: #0b1220;
  --panel: rgba(255,255,255,.06);
  --panel2: rgba(255,255,255,.08);
  --text: rgba(255,255,255,.92);
  --muted: rgba(255,255,255,.65);
  --border: rgba(255,255,255,.10);
  --accent: #7c3aed;
}

* { box-sizing: border-box; }
html, body { height: 100%; }
body {
  margin: 0;
  background: radial-gradient(1200px 600px at 20% 0%, rgba(124,58,237,.18), transparent),
              radial-gradient(900px 500px at 80% 20%, rgba(59,130,246,.16), transparent),
              var(--bg);
  color: var(--text);
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
}

a { color: inherit; text-decoration: none; }
button, input, select, textarea { font: inherit; color: inherit; }

.container { max-width: 1100px; margin: 0 auto; padding: 24px; }
.nav {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 0;
}
.brand { display:flex; gap:10px; align-items:center; font-weight: 900; }
.logo {
  width: 34px; height: 34px; border-radius: 12px;
  background: rgba(255,255,255,.10);
  display: grid; place-items:center;
  border: 1px solid var(--border);
}

.grid { display: grid; gap: 16px; grid-template-columns: 280px 1fr; }
.panel {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 18px;
  overflow: hidden;
}
.panelHeader { padding: 12px 14px; border-bottom: 1px solid var(--border); font-weight: 800; color: var(--muted); }
.panelBody { padding: 14px; }

.sidebar a {
  display:block; padding: 10px 12px; border-radius: 12px;
  border: 1px solid transparent;
  color: var(--muted);
}
.sidebar a:hover { background: var(--panel2); }
.sidebar a.active {
  background: rgba(124,58,237,.18);
  border-color: rgba(124,58,237,.35);
  color: var(--text);
}

.card {
  background: rgba(255,255,255,.06);
  border: 1px solid var(--border);
  border-radius: 18px;
  padding: 14px;
}

.table { width: 100%; border-collapse: collapse; }
.table th, .table td { padding: 10px 8px; border-bottom: 1px solid var(--border); text-align: left; }
.table th { color: var(--muted); font-weight: 800; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }

.rowActions { display:flex; gap: 8px; justify-content:flex-end; }
.btn {
  padding: 8px 10px; border-radius: 12px;
  background: rgba(255,255,255,.06);
  border: 1px solid var(--border);
  cursor: pointer;
}
.btn:hover { background: rgba(255,255,255,.10); }
.btnPrimary {
  background: rgba(124,58,237,.25);
  border-color: rgba(124,58,237,.45);
}
.btnPrimary:hover { background: rgba(124,58,237,.35); }

.formGrid { display: grid; gap: 12px; grid-template-columns: 1fr 1fr; }
.field { display:flex; flex-direction: column; gap: 6px; }
.label { font-size: 12px; color: var(--muted); font-weight: 800; }
.input, .select, .textarea {
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: rgba(0,0,0,.20);
  outline: none;
}
.textarea { min-height: 90px; resize: vertical; }
.small { font-size: 12px; color: var(--muted); }

@media (max-width: 900px) {
  .grid { grid-template-columns: 1fr; }
  .formGrid { grid-template-columns: 1fr; }
}
`;
}

function frontendAppLayout(plan: AppPlan) {
  return `import "./globals.css";

export const metadata = {
  title: "${plan.appName}",
  description: "Generated app",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
`;
}

function frontendLibApi() {
  return `const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5050";

export async function getSpec() {
  const r = await fetch(\`\${BACKEND}/api/spec\`, { cache: "no-store" });
  if (!r.ok) throw new Error("Failed to load spec");
  return r.json();
}

export async function list(entity, { limit = 50, offset = 0 } = {}) {
  const r = await fetch(\`\${BACKEND}/api/\${entity}?limit=\${limit}&offset=\${offset}\`, { cache: "no-store" });
  if (!r.ok) throw new Error("Failed to list");
  return r.json();
}

export async function getOne(entity, id) {
  const r = await fetch(\`\${BACKEND}/api/\${entity}/\${id}\`, { cache: "no-store" });
  if (!r.ok) throw new Error("Not found");
  return r.json();
}

export async function createOne(entity, data) {
  const r = await fetch(\`\${BACKEND}/api/\${entity}\`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error("Failed to create");
  return r.json();
}

export async function updateOne(entity, id, data) {
  const r = await fetch(\`\${BACKEND}/api/\${entity}/\${id}\`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error("Failed to update");
  return r.json();
}

export async function deleteOne(entity, id) {
  const r = await fetch(\`\${BACKEND}/api/\${entity}/\${id}\`, { method: "DELETE" });
  if (!r.ok) throw new Error("Failed to delete");
  return r.json();
}
`;
}

function frontendHomePage(plan: AppPlan) {
  // a simple dashboard that lists entities and links to them
  const links = plan.entities
    .map((e) => {
      const label = (e.title || toTitle(e.name)) as string;
      return `<a className="card" href="/entity/${e.name}">
  <div style={{fontWeight: 900}}>${label}</div>
  <div className="small">Manage ${label.toLowerCase()} (CRUD)</div>
</a>`;
    })
    .join("\n");

  return `import { getSpec } from "../lib/api";

export default async function Home() {
  const spec = await getSpec();

  return (
    <div className="container">
      <div className="nav">
        <div className="brand">
          <div className="logo">✨</div>
          <div>${plan.appName}</div>
        </div>
        <a className="btn" href={\`\${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5050"}/api/spec\`} target="_blank">
          View Spec
        </a>
      </div>

      <div className="panel">
        <div className="panelHeader">Dashboard</div>
        <div className="panelBody">
          <div style={{display:"grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))"}}>
            ${links}
          </div>
          <div style={{marginTop: 14}} className="small">
            Entities: <strong>{spec.entities.length}</strong> • Backend: <strong>5050</strong> • Frontend: <strong>3001</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
`;
}

function frontendEntityPage() {
  return `"use client";

import { useEffect, useMemo, useState } from "react";
import { createOne, deleteOne, getSpec, list, updateOne } from "../../../lib/api";

function toTitle(s) {
  return String(s || "").replace(/_/g, " ").replace(/^\\w/, (c) => c.toUpperCase());
}

function FieldInput({ field, value, onChange }) {
  const t = field.type;

  if (t === "boolean") {
    return (
      <label style={{display:"flex", gap: 10, alignItems:"center"}}>
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked ? 1 : 0)}
        />
        <span className="small">Enabled</span>
      </label>
    );
  }

  if (t === "enum") {
    return (
      <select className="select" value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select...</option>
        {(field.enumValues || []).map((v) => (
          <option key={v} value={v}>{v}</option>
        ))}
      </select>
    );
  }

  if (t === "text") {
    return <textarea className="textarea" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
  }

  const inputType = t === "number" ? "number" : t === "date" ? "date" : "text";
  return <input className="input" type={inputType} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
}

export default function EntityPage({ params }) {
  const entity = params.entity;

  const [spec, setSpec] = useState(null);
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({});

  const entitySpec = useMemo(() => spec?.entities?.find((e) => e.name === entity), [spec, entity]);

  async function refresh() {
    setErr("");
    try {
      const res = await list(entity, { limit: 100, offset: 0 });
      setItems(res.items || []);
    } catch (e) {
      setErr(String(e?.message || e));
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const s = await getSpec();
        setSpec(s);
      } catch (e) {
        setErr(String(e?.message || e));
      }
    })();
  }, []);

  useEffect(() => {
    if (!entitySpec) return;
    refresh();
  }, [entitySpec]);

  function openNew() {
    setEditingId(null);
    setForm({});
    setDrawerOpen(true);
  }

  function openEdit(row) {
    setEditingId(row.id);
    const next = {};
    (entitySpec.fields || []).forEach((f) => {
      next[f.name] = row[f.name];
    });
    setForm(next);
    setDrawerOpen(true);
  }

  async function save() {
    setErr("");
    try {
      if (editingId == null) {
        await createOne(entity, form);
      } else {
        await updateOne(entity, editingId, form);
      }
      setDrawerOpen(false);
      await refresh();
    } catch (e) {
      setErr(String(e?.message || e));
    }
  }

  async function remove(id) {
    if (!confirm("Delete this item?")) return;
    setErr("");
    try {
      await deleteOne(entity, id);
      await refresh();
    } catch (e) {
      setErr(String(e?.message || e));
    }
  }

  if (!entitySpec) {
    return (
      <div className="container">
        <a className="btn" href="/">← Back</a>
        <div style={{marginTop: 12}} className="panel">
          <div className="panelHeader">Loading…</div>
          <div className="panelBody">{err ? <div style={{color:"#fca5a5"}}>{err}</div> : "Fetching spec..."}</div>
        </div>
      </div>
    );
  }

  const title = entitySpec.title || toTitle(entitySpec.name);

  return (
    <div className="container">
      <div className="nav">
        <div className="brand">
          <div className="logo">📦</div>
          <div>{title}</div>
        </div>
        <div style={{display:"flex", gap: 10}}>
          <a className="btn" href="/">Dashboard</a>
          <button className="btn btnPrimary" onClick={openNew}>New</button>
        </div>
      </div>

      {err ? <div className="card" style={{borderColor:"rgba(239,68,68,.5)"}}>{err}</div> : null}

      <div className="grid">
        <div className="panel">
          <div className="panelHeader">Entities</div>
          <div className="panelBody sidebar">
            {(spec.entities || []).map((e) => (
              <a key={e.name} className={e.name === entity ? "active" : ""} href={\`/entity/\${e.name}\`}>
                {e.title || toTitle(e.name)}
              </a>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panelHeader">Records</div>
          <div className="panelBody" style={{overflowX:"auto"}}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{width: 60}}>ID</th>
                  {(entitySpec.fields || []).map((f) => (
                    <th key={f.name}>{toTitle(f.name)}</th>
                  ))}
                  <th style={{width: 160, textAlign:"right"}}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(items || []).map((row) => (
                  <tr key={row.id}>
                    <td>{row.id}</td>
                    {(entitySpec.fields || []).map((f) => (
                      <td key={f.name}>
                        {f.type === "boolean" ? (row[f.name] ? "true" : "false") : String(row[f.name] ?? "")}
                      </td>
                    ))}
                    <td>
                      <div className="rowActions">
                        <button className="btn" onClick={() => openEdit(row)}>Edit</button>
                        <button className="btn" onClick={() => remove(row.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={(entitySpec.fields || []).length + 2} className="small">
                      No records yet. Click <strong>New</strong> to create one.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Drawer */}
      {drawerOpen ? (
        <div
          style={{
            position:"fixed",
            inset: 0,
            background:"rgba(0,0,0,.5)",
            display:"grid",
            placeItems:"center",
            padding: 14,
          }}
          onClick={() => setDrawerOpen(false)}
        >
          <div
            className="panel"
            style={{width:"min(820px, 100%)"}}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="panelHeader">
              {editingId == null ? "Create" : "Edit"} {title}
            </div>
            <div className="panelBody">
              <div className="formGrid">
                {(entitySpec.fields || []).map((f) => (
                  <div className="field" key={f.name} style={{gridColumn: f.type === "text" ? "1 / -1" : undefined}}>
                    <div className="label">{toTitle(f.name)}</div>
                    <FieldInput
                      field={f}
                      value={form[f.name]}
                      onChange={(v) => setForm((prev) => ({ ...prev, [f.name]: v }))}
                    />
                    {f.enumValues?.length ? (
                      <div className="small">Options: {f.enumValues.join(", ")}</div>
                    ) : null}
                  </div>
                ))}
              </div>

              <div style={{display:"flex", justifyContent:"flex-end", gap: 10, marginTop: 14}}>
                <button className="btn" onClick={() => setDrawerOpen(false)}>Cancel</button>
                <button className="btn btnPrimary" onClick={save}>Save</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
`;
}

export function rootFiles(plan: AppPlan) {
  return {
    "package.json": rootPkg(plan),
    "README.md": rootReadme(plan),
    "spec.json": json(plan),
  };
}

export function backendFiles(plan: AppPlan) {
  return {
    "backend/package.json": backendPkg(),
    "backend/server.js": backendServer(plan),
    "backend/src/db.js": backendDb(),
  };
}

export function frontendFiles(plan: AppPlan) {
  return {
    "frontend/package.json": frontendPkg(),
    "frontend/next.config.js": nextConfig(),
    "frontend/app/globals.css": frontendCss(),
    "frontend/app/layout.tsx": frontendAppLayout(plan),
    "frontend/app/page.tsx": frontendHomePage(plan),
    "frontend/app/entity/[entity]/page.tsx": frontendEntityPage(),
    "frontend/lib/api.ts": frontendLibApi(),
  };
}