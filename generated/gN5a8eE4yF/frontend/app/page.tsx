"use client";

import { useEffect, useState } from "react";

type Task = { id: number; title: string; done: boolean };

export default function Page() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");

  const base =
    process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5050";

  async function load() {
    setError("");
    try {
      const r = await fetch(base + "/api/tasks");
      const j = await r.json();
      setTasks(j.tasks || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load tasks");
    }
  }

  async function add() {
    const t = title.trim();
    if (!t) return;
    setError("");
    try {
      await fetch(base + "/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t }),
      });
      setTitle("");
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to add task");
    }
  }

  async function del(id: number) {
    setError("");
    try {
      await fetch(base + "/api/tasks/" + id, { method: "DELETE" });
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to delete task");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>
        build-a-task-app-with-auth-and-s
      </h1>
      <p style={{ opacity: 0.7 }}>
        Frontend on :3001 — Backend on :5050
      </p>

      {error && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            border: "1px solid #f2caca",
            borderRadius: 10,
            background: "#fff7f7",
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <input
          value={title}
          placeholder="New task..."
          onChange={(e) => setTitle(e.target.value)}
          style={{
            flex: 1,
            padding: "10px 12px",
            border: "1px solid #ddd",
            borderRadius: 10,
          }}
        />
        <button
          onClick={add}
          style={{
            padding: "10px 12px",
            border: "1px solid #ddd",
            borderRadius: 10,
            background: "#fff",
          }}
        >
          Add
        </button>
      </div>

      <ul style={{ listStyle: "none", padding: 0, marginTop: 16, display: "grid", gap: 10 }}>
        {tasks.map((t) => (
          <li
            key={t.id}
            style={{
              border: "1px solid #eee",
              borderRadius: 12,
              padding: 12,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>{t.title}</span>
            <button
              onClick={() => del(t.id)}
              style={{
                padding: "6px 10px",
                border: "1px solid #ddd",
                borderRadius: 10,
                background: "#fff",
                fontSize: 12,
              }}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>

      {tasks.length === 0 && (
        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
          No tasks yet. Add one above.
        </div>
      )}
    </main>
  );
}
