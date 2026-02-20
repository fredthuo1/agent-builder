"use client";
import { useEffect, useState } from "react";
type Task = { id: number; title: string; done: boolean };
export default function Page() {
  const [token, setToken] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5050";
  async function login(){ const r=await fetch(base+"/api/login",{method:"POST"}); const j=await r.json(); setToken(j.token||""); }
  async function load(){ const r=await fetch(base+"/api/tasks"); const j=await r.json(); setTasks(j.tasks||[]); }
  async function add(){ const t=title.trim(); if(!t) return; await fetch(base+"/api/tasks",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:t})}); setTitle(""); await load(); }
  async function del(id:number){ await fetch(base+"/api/tasks/"+id,{method:"DELETE"}); await load(); }
  useEffect(()=>{load();},[]);
  return (
    <main className="min-h-screen p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">build-a-task-app-with-au</h1>
      <p className="text-sm opacity-70 mb-6">Generated full-stack starter app.</p>
      <div className="flex items-center gap-3 mb-6">
        <button className="px-3 py-2 rounded border" onClick={login}>{token ? "Logged in ✅" : "Login (demo)"}</button>
        <span className="text-xs opacity-70">Token: {token || "(none)"}</span>
      </div>
      <div className="flex gap-2 mb-4">
        <input className="border rounded px-3 py-2 flex-1" value={title} placeholder="New task..." onChange={(e)=>setTitle(e.target.value)} />
        <button className="px-3 py-2 rounded border" onClick={add}>Add</button>
      </div>
      <ul className="space-y-2">
        {tasks.map((t)=>(
          <li key={t.id} className="border rounded p-3 flex justify-between">
            <span>{t.title}</span>
            <button className="text-sm underline" onClick={()=>del(t.id)}>delete</button>
          </li>
        ))}
      </ul>
    </main>
  );
}
