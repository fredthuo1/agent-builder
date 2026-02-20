"use client";
import { useEffect, useState } from "react";

export default function Page() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");

  const base = "http://localhost:5050";

  async function load() {
    const r = await fetch(base + "/api/tasks");
    const j = await r.json();
    setTasks(j.tasks || []);
  }

  async function add() {
    if (!title.trim()) return;

    await fetch(base + "/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });

    setTitle("");
    load();
  }

  async function del(id) {
    await fetch(base + "/api/tasks/" + id, { method: "DELETE" });
    load();
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main style={{ padding: 40 }}>
      <h1>Build A Task App With Auth And S</h1>

      <div>
        <input value={title} onChange={(e)=>setTitle(e.target.value)} />
        <button onClick={add}>Add</button>
      </div>

      <ul>
        {tasks.map((t)=>(
          <li key={t.id}>
            {t.title}
            <button onClick={()=>del(t.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </main>
  );
}
