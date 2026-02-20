"use client";
import { useEffect, useMemo, useState } from "react";

const ENTITY = "tasks";
const SINGULAR = "task";
const FIELDS = [
  {
    "name": "title",
    "type": "text",
    "required": true
  },
  {
    "name": "status",
    "type": "select",
    "options": [
      "todo",
      "doing",
      "done"
    ],
    "required": true
  },
  {
    "name": "priority",
    "type": "number"
  }
];

function pretty(s) {
  return String(s || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function isSelectField(f) {
  return f && f.type === "select" && Array.isArray(f.options) && f.options.length > 0;
}

export default function Page() {
  const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5050";

  const [items, setItems] = useState([]);
  const [form, setForm] = useState({});
  const [err, setErr] = useState("");

  const [q, setQ] = useState("");
  const [filterField, setFilterField] = useState("");
  const [filterValue, setFilterValue] = useState("");

  const required = useMemo(() => FIELDS.filter((f) => f.required), []);
  const selectFields = useMemo(() => FIELDS.filter(isSelectField), []);
  const firstSelect = selectFields[0]?.name || "";

  useEffect(() => {
    if (!filterField && firstSelect) setFilterField(firstSelect);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstSelect]);

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

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();

    return items.filter((it) => {
      if (query) {
        const hay = [
          String(it.id ?? ""),
          ...FIELDS.map((f) => String(it[f.name] ?? "")),
        ].join(" | ").toLowerCase();
        if (!hay.includes(query)) return false;
      }

      if (filterField && filterValue) {
        if (String(it[filterField] ?? "") !== String(filterValue)) return false;
      }

      return true;
    });
  }, [items, q, filterField, filterValue]);

  const stats = useMemo(() => {
    const total = items.length;
    const recent = items.slice(0, Math.min(5, items.length)).length;

    let reqFilled = 0;
    let reqTotal = 0;
    for (const it of filtered) {
      for (const f of required) {
        reqTotal += 1;
        const v = it[f.name];
        if (v != null && String(v).trim() !== "") reqFilled += 1;
      }
    }
    const completion = reqTotal === 0 ? 100 : Math.round((reqFilled / reqTotal) * 100);

    return { total, recent, completion };
  }, [items, filtered, required]);

  const columns = useMemo(() => ["id", ...FIELDS.map((f) => f.name)], []);

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0 }}>Build A Habit Tracker For Daily</h1>
          <p style={{ opacity: 0.7, marginTop: 6 }}>Full-stack app generated from: "Build a habit tracker for daily workouts"</p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ fontSize: 12, opacity: 0.7, textAlign: "right" }}>
            <div>Entity</div>
            <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", opacity: 1 }}>
              /api/{ENTITY}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginTop: 14 }}>
        <div style={{ border: "1px solid #eee", borderRadius: 16, padding: 14 }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Total {pretty(ENTITY)}</div>
          <div style={{ fontSize: 28, fontWeight: 900, marginTop: 4 }}>{stats.total}</div>
        </div>
        <div style={{ border: "1px solid #eee", borderRadius: 16, padding: 14 }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Recent (top 5)</div>
          <div style={{ fontSize: 28, fontWeight: 900, marginTop: 4 }}>{stats.recent}</div>
        </div>
        <div style={{ border: "1px solid #eee", borderRadius: 16, padding: 14 }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Required filled (filtered)</div>
          <div style={{ fontSize: 28, fontWeight: 900, marginTop: 4 }}>{stats.completion}%</div>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 14, alignItems: "center" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search..."
          style={{ flex: 1, minWidth: 220, padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd" }}
        />

        {selectFields.length > 0 && (
          <>
            <select
              value={filterField}
              onChange={(e) => {
                setFilterField(e.target.value);
                setFilterValue("");
              }}
              style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd" }}
              title="Filter field"
            >
              {selectFields.map((f) => (
                <option key={f.name} value={f.name}>
                  Filter: {pretty(f.name)}
                </option>
              ))}
            </select>

            <select
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd" }}
              title="Filter value"
            >
              <option value="">All</option>
              {(selectFields.find((x) => x.name === filterField)?.options || []).map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </>
        )}

        <button
          onClick={load}
          style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", background: "#fff", fontWeight: 700 }}
          title="Refresh data"
        >
          Refresh
        </button>
      </div>

      <section style={{ marginTop: 14, padding: 14, border: "1px solid #eee", borderRadius: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div style={{ fontWeight: 900 }}>Create {pretty(SINGULAR)}</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            {required.length > 0 ? "Fields with * are required" : "No required fields"}
          </div>
        </div>

        {err && (
          <div style={{ marginTop: 10, padding: 10, border: "1px solid #f2caca", background: "#fff7f7", borderRadius: 12, fontSize: 12 }}>
            <strong>Error:</strong> {err}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, marginTop: 12 }}>
          {FIELDS.map((f) => {
            const value = form[f.name] ?? "";
            const label = pretty(f.name) + (f.required ? " *" : "");

            if (f.type === "select") {
              return (
                <label key={f.name} style={{ display: "grid", gap: 6, fontSize: 12 }}>
                  <span>{label}</span>
                  <select
                    value={value}
                    onChange={(e) => setForm((s) => ({ ...s, [f.name]: e.target.value }))}
                    style={{ padding: 10, borderRadius: 12, border: "1px solid #ddd" }}
                  >
                    <option value="">Select…</option>
                    {(f.options || []).map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </label>
              );
            }

            if (f.type === "boolean") {
              return (
                <label key={f.name} style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 12, paddingTop: 22 }}>
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
                  value={value}
                  onChange={(e) => setForm((s) => ({ ...s, [f.name]: e.target.value }))}
                  style={{ padding: 10, borderRadius: 12, border: "1px solid #ddd" }}
                />
              </label>
            );
          })}
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
          <button
            onClick={create}
            style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", background: "#fff", fontWeight: 800 }}
          >
            Create
          </button>
          <button
            onClick={() => setForm({})}
            style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", background: "#fff" }}
          >
            Clear
          </button>
        </div>
      </section>

      <section style={{ marginTop: 14, border: "1px solid #eee", borderRadius: 16, overflow: "hidden" }}>
        <div style={{ padding: 12, borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 900 }}>Table</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Showing <strong>{filtered.length}</strong> of {items.length}
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#fafafa" }}>
                {columns.map((c) => (
                  <th key={c} style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #eee", whiteSpace: "nowrap" }}>
                    {pretty(c)}
                  </th>
                ))}
                <th style={{ textAlign: "right", padding: 10, borderBottom: "1px solid #eee" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((it) => (
                <tr key={it.id}>
                  {columns.map((c) => (
                    <td key={c} style={{ padding: 10, borderBottom: "1px solid #f1f1f1", verticalAlign: "top" }}>
                      {String(it[c] ?? "")}
                    </td>
                  ))}
                  <td style={{ padding: 10, borderBottom: "1px solid #f1f1f1", textAlign: "right" }}>
                    <button
                      onClick={() => del(it.id)}
                      style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #ddd", background: "#fff" }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 1} style={{ padding: 14, fontSize: 12, opacity: 0.7 }}>
                    No results. Try clearing filters or creating a new item.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <footer style={{ marginTop: 16, fontSize: 12, opacity: 0.65 }}>
        Backend URL: <code>{base}</code> (set NEXT_PUBLIC_BACKEND_URL to override)
      </footer>
    </main>
  );
}
