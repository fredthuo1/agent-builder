"use client";
import { useEffect, useMemo, useState } from "react";

const FIELDS = [
  {
    "name": "title",
    "type": "text",
    "required": true
  },
  {
    "name": "description",
    "type": "text",
    "required": false
  },
  {
    "name": "priority",
    "type": "select",
    "options": [
      "Low",
      "Medium",
      "High"
    ],
    "required": true
  },
  {
    "name": "status",
    "type": "select",
    "options": [
      "Todo",
      "In Progress",
      "Done"
    ],
    "required": true
  },
  {
    "name": "due_date",
    "type": "date",
    "required": false
  },
  {
    "name": "is_completed",
    "type": "boolean",
    "required": true
  }
];
const ENTITY = "tasks";

export default function Page() {
  const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5050";
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({});
  const [err, setErr] = useState("");

  const required = useMemo(() => FIELDS.filter(f => f.required), []);

  async function load() {
    setErr("");
    const r = await fetch(base + "/api/" + ENTITY);
    const j = await r.json();
    setItems(j.items || []);
  }

  async function create() {
    setErr("");
    for (const f of required) {
      const v = form[f.name];
      if (v == null || String(v).trim() === "") {
        setErr(f.name + " required");
        return;
      }
    }

    const r = await fetch(base + "/api/" + ENTITY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const j = await r.json();
    if (!r.ok) {
      setErr(j?.error || "create failed");
      return;
    }
    setForm({});
    await load();
  }

  async function del(id) {
    await fetch(base + "/api/" + ENTITY + "/" + id, { method: "DELETE" });
    await load();
  }

  useEffect(() => { load(); }, []);

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>Task Manager</h1>
      <p style={{ opacity: 0.7 }}>A simple task management application to track daily activities and progress.</p>

      {err && <div style={{ padding: 10, border: "1px solid #f2caca", background: "#fff7f7", borderRadius: 10, fontSize: 12 }}>{err}</div>}

      <section style={{ marginTop: 14, padding: 14, border: "1px solid #eee", borderRadius: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Create task</div>

        <div style={{ display: "grid", gap: 10 }}>
          {FIELDS.map((f) => {
            const v = form[f.name] ?? "";
            const label = f.name + (f.required ? " *" : "");
            if (f.type === "select") {
              return (
                <label key={f.name} style={{ display: "grid", gap: 6, fontSize: 12 }}>
                  <span>{label}</span>
                  <select
                    value={v}
                    onChange={(e) => setForm((s) => ({ ...s, [f.name]: e.target.value }))}
                    style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                  >
                    <option value="">Select…</option>
                    {(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </label>
              );
            }
            if (f.type === "boolean") {
              return (
                <label key={f.name} style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={!!form[f.name]}
                    onChange={(e) => setForm((s) => ({ ...s, [f.name]: e.target.checked }))}
                  />
                  <span>{label}</span>
                </label>
              );
            }
            const inputType = f.type === "number" ? "number" : f.type === "date" ? "date" : "text";
            return (
              <label key={f.name} style={{ display: "grid", gap: 6, fontSize: 12 }}>
                <span>{label}</span>
                <input
                  type={inputType}
                  value={v}
                  onChange={(e) => setForm((s) => ({ ...s, [f.name]: e.target.value }))}
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                />
              </label>
            );
          })}

          <button onClick={create} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", background: "#fff" }}>
            Create
          </button>
        </div>
      </section>

      <section style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Items</div>
        <div style={{ display: "grid", gap: 10 }}>
          {items.map((it) => (
            <div key={it.id} style={{ border: "1px solid #eee", borderRadius: 14, padding: 12, display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ fontSize: 12, opacity: 0.7 }}>id: {it.id}</div>
                {FIELDS.map((f) => (
                  <div key={f.name} style={{ fontSize: 13 }}>
                    <strong style={{ fontSize: 12 }}>{f.name}:</strong>{" "}
                    <span>{String(it[f.name] ?? "")}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => del(it.id)} style={{ height: 32, padding: "6px 10px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", fontSize: 12 }}>
                Delete
              </button>
            </div>
          ))}
        </div>
      </section>

      <footer style={{ marginTop: 22, fontSize: 12, opacity: 0.65 }}>
        Backend URL: <code>{base}</code> (set NEXT_PUBLIC_BACKEND_URL to override)
      </footer>
    </main>
  );
}
