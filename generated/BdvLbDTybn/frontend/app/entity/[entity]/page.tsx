"use client";

import { useEffect, useMemo, useState } from "react";
import { createOne, deleteOne, getSpec, list, updateOne } from "../../../lib/api";

function toTitle(s) {
  return String(s || "").replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
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
              <a key={e.name} className={e.name === entity ? "active" : ""} href={`/entity/${e.name}`}>
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
