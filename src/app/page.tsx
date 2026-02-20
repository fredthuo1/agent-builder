"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Prism from "prismjs";

import "prismjs/components/prism-markup";
import "prismjs/components/prism-css";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-json";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-markdown";

type Build = any;

function ModePill({
  generationMode,
  aiProvider,
}: {
  generationMode: string;
  aiProvider?: string;
}) {
  const mode = (generationMode || "").toLowerCase();
  const provider = (aiProvider || "").toLowerCase();

  let label = "Mode: Unknown";
  let bg = "#f4f4f5";
  let border = "#e4e4e7";
  let color = "#111827";

  if (mode === "ai") {
    if (provider === "openai") {
      label = "Mode: AI (OpenAI)";
      bg = "#f5f3ff";
      border = "#ddd6fe";
      color = "#4c1d95";
    } else if (provider === "gemini") {
      label = "Mode: AI (Gemini)";
      bg = "#eff6ff";
      border = "#bfdbfe";
      color = "#1e3a8a";
    } else {
      label = "Mode: AI";
      bg = "#eef2ff";
      border = "#c7d2fe";
      color = "#3730a3";
    }
  } else if (mode === "local") {
    label = "Mode: Local Templates";
    bg = "#ecfdf5";
    border = "#bbf7d0";
    color = "#065f46";
  } else if (mode === "fallback") {
    label = "Mode: Fallback (Local)";
    bg = "#fffbeb";
    border = "#fde68a";
    color = "#92400e";
  }

  const tip =
    mode === "ai"
      ? `AI provider: ${provider || "unknown"}`
      : "Shows whether the build used AI or local generation";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "8px 12px",
        borderRadius: 999,
        border: `1px solid ${border}`,
        background: bg,
        color,
        fontSize: 12,
        fontWeight: 700,
        gap: 8,
      }}
      title={tip}
    >
      {label}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  const s = (status || "").toLowerCase();
  let bg = "#9ca3af";
  if (s === "running") bg = "#3b82f6";
  if (s === "done") bg = "#10b981";
  if (s === "failed") bg = "#ef4444";
  return (
    <span
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: 999,
        background: bg,
        marginRight: 8,
      }}
    />
  );
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 18,
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: 16, borderBottom: "1px solid #f3f4f6" }}>
        <div style={{ fontSize: 14, fontWeight: 900 }}>{title}</div>
        {subtitle ? (
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>{subtitle}</div>
        ) : null}
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
}

type TreeNode = {
  name: string;
  path: string; // full path from root (e.g. "frontend/app/page.tsx" or "frontend/app")
  kind: "file" | "dir";
  children?: TreeNode[];
};

function buildTree(paths: string[]): TreeNode {
  const root: TreeNode = { name: "root", path: "", kind: "dir", children: [] };

  const ensureDir = (parent: TreeNode, name: string, fullPath: string) => {
    parent.children ||= [];
    let existing = parent.children.find((c) => c.kind === "dir" && c.name === name);
    if (!existing) {
      existing = { name, path: fullPath, kind: "dir", children: [] };
      parent.children.push(existing);
    }
    return existing;
  };

  for (const p of paths) {
    const parts = p.split("/").filter(Boolean);
    let cur = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      const full = parts.slice(0, i + 1).join("/");
      const isLast = i === parts.length - 1;

      if (isLast) {
        cur.children ||= [];
        cur.children.push({ name: part, path: full, kind: "file" });
      } else {
        cur = ensureDir(cur, part, full);
      }
    }
  }

  const sortNode = (n: TreeNode) => {
    if (!n.children) return;
    n.children.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    n.children.forEach(sortNode);
  };
  sortNode(root);

  return root;
}

function languageForPath(path: string) {
  const p = (path || "").toLowerCase();
  if (p.endsWith(".ts")) return "typescript";
  if (p.endsWith(".tsx")) return "tsx";
  if (p.endsWith(".js")) return "javascript";
  if (p.endsWith(".jsx")) return "jsx";
  if (p.endsWith(".json")) return "json";
  if (p.endsWith(".md")) return "markdown";
  if (p.endsWith(".css")) return "css";
  if (p.endsWith(".html")) return "markup";
  if (p.endsWith(".yml") || p.endsWith(".yaml")) return "yaml";
  if (p.endsWith(".sh") || p.endsWith(".bash")) return "bash";
  return "markup";
}

function splitLines(text: string) {
  return (text || "").replace(/\r\n/g, "\n").split("\n");
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function Home() {
  const [prompt, setPrompt] = useState(
    "Build a habit tracker with fields: habitName, frequency (daily, weekly), streak (number), lastCompletedDate (date), active (boolean)."
  );

  // ✅ NEW: generation mode toggle (auto/ai/local)
  const [mode, setMode] = useState<"auto" | "ai" | "local">("auto");

  const [buildId, setBuildId] = useState<string>("");
  const [build, setBuild] = useState<Build | null>(null);

  const [files, setFiles] = useState<string[]>([]);
  const [fileQuery, setFileQuery] = useState("");

  // Tabs
  const [tabs, setTabs] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>("");

  const [fileContent, setFileContent] = useState<string>("");
  const [fileError, setFileError] = useState<string>("");

  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [wrap, setWrap] = useState(true);

  // Collapsed folders
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // IDE context menu
  const [ctxOpen, setCtxOpen] = useState(false);
  const [ctxX, setCtxX] = useState(0);
  const [ctxY, setCtxY] = useState(0);
  const [ctxPath, setCtxPath] = useState<string>("");
  const [ctxKind, setCtxKind] = useState<"file" | "editor" | "none">("none");
  const [ctxMsg, setCtxMsg] = useState<string>("");

  // Find in file
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [findIndex, setFindIndex] = useState(0);

  // Selection copy
  const [selectionText, setSelectionText] = useState("");
  const [selectionCopyState, setSelectionCopyState] = useState<"idle" | "copied" | "failed">("idle");

  const editorScrollRef = useRef<HTMLDivElement | null>(null);
  const gutterScrollRef = useRef<HTMLDivElement | null>(null);
  const editorContentRef = useRef<HTMLDivElement | null>(null);
  const findInputRef = useRef<HTMLInputElement | null>(null);

  const starters = [
    {
      title: "Mini CRM",
      desc: "Contacts + pipeline stages",
      prompt:
        "Build a mini CRM for contacts with fields: name, email, phone, company, stage (lead, qualified, customer), notes.",
    },
    {
      title: "Bug Tracker",
      desc: "Triage issues quickly",
      prompt:
        "Build a bug tracker with fields: title, severity (low, medium, high), status (open, investigating, fixed), assignee, dueDate.",
    },
    {
      title: "Habit Tracker",
      desc: "Track streaks & routines",
      prompt:
        "Build a habit tracker with fields: habitName, frequency (daily, weekly), streak (number), lastCompletedDate (date), active (boolean).",
    },
    {
      title: "Inventory",
      desc: "Stock levels & reorder points",
      prompt:
        "Build an inventory tracker with fields: itemName, sku, quantity (number), location, reorderLevel (number), status (in_stock, low, out).",
    },
  ];

  async function start() {
    setBuild(null);
    setFiles([]);
    setFileQuery("");
    setSelected("");
    setTabs([]);
    setFileContent("");
    setFileError("");
    setCopyState("idle");
    setCollapsed({});
    setFindOpen(false);
    setFindQuery("");
    setFindIndex(0);

    const r = await fetch("/api/build", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // ✅ NEW: send mode
      body: JSON.stringify({ prompt, mode }),
    });

    const j = await r.json();
    setBuildId(j.buildId);
    poll(j.buildId);
  }

  async function poll(id: string) {
    const tick = async () => {
      const r = await fetch(`/api/status?buildId=${encodeURIComponent(id)}`);
      const j = await r.json();

      setBuild(j.build);
      setFiles(j.files || []);

      if (j.build?.status === "running") setTimeout(tick, 900);
    };

    tick();
  }

  async function openFile(relPath: string) {
    setSelected(relPath);
    setFileContent("");
    setFileError("");
    setCopyState("idle");

    setTabs((prev) => (prev.includes(relPath) ? prev : [...prev, relPath]));

    try {
      const r = await fetch(
        `/api/file?buildId=${encodeURIComponent(buildId)}&path=${encodeURIComponent(relPath)}`
      );
      const j = await r.json();

      if (!r.ok) {
        setFileError(j?.error || "Failed to load file");
        return;
      }

      setFileContent(j.content || "");
      setSelectionText("");
      setSelectionCopyState("idle");

      // reset scroll
      requestAnimationFrame(() => {
        if (editorScrollRef.current) editorScrollRef.current.scrollTop = 0;
        if (gutterScrollRef.current) gutterScrollRef.current.scrollTop = 0;
      });
    } catch (e: any) {
      setFileError(e?.message || "Failed to load file");
    }
  }

  function closeTab(path: string) {
    setTabs((prev) => {
      const next = prev.filter((t) => t !== path);
      if (selected === path) {
        const idx = prev.indexOf(path);
        const fallback = next[idx - 1] || next[idx] || "";
        setSelected(fallback);
        if (!fallback) {
          setFileContent("");
          setFileError("");
        } else {
          void openFile(fallback);
        }
      }
      return next;
    });
  }

  async function handleCopyCode() {
    const ok = await copyToClipboard(fileContent || "");
    setCopyState(ok ? "copied" : "failed");
    setTimeout(() => setCopyState("idle"), 1100);
  }

  async function handleCopySelection() {
    if (!selectionText) return;
    const ok = await copyToClipboard(selectionText);
    setSelectionCopyState(ok ? "copied" : "failed");
    setTimeout(() => setSelectionCopyState("idle"), 1100);
  }

  function syncScroll() {
    const e = editorScrollRef.current;
    const g = gutterScrollRef.current;
    if (!e || !g) return;
    g.scrollTop = e.scrollTop;
  }

  const agents = useMemo(() => (build?.agents ? Object.values(build.agents) : []), [build]);

    const generationMode = useMemo(() => {
      const out = build?.agents?.planner?.output;
      if (out?.generationMode) return String(out.generationMode);
      if (out?.plan?.generationMode) return String(out.plan.generationMode);
      return "unknown";
    }, [build]);

  const aiProvider = useMemo(() => {
      const out = build?.agents?.planner?.output;
      if (out?.aiProvider) return String(out.aiProvider);
      if (out?.plan?.aiProvider) return String(out.plan.aiProvider);
      return "";
    }, [build]);

  const plannerOutput = useMemo(() => build?.agents?.planner?.output ?? {}, [build]);

  const statusText = build?.status ? String(build.status).toUpperCase() : "READY";

  const filteredFiles = useMemo(() => {
    const q = fileQuery.trim().toLowerCase();
    if (!q) return files;
    return files.filter((f) => f.toLowerCase().includes(q));
  }, [files, fileQuery]);

  const tree = useMemo(() => buildTree(filteredFiles), [filteredFiles]);

  const lines = useMemo(() => splitLines(fileContent), [fileContent]);

  const prismLang = useMemo(() => languageForPath(selected), [selected]);

  const findMatches = useMemo(() => {
    const q = findQuery;
    if (!q || !fileContent) return [];
    const src = fileContent;
    const out: Array<{ start: number; end: number }> = [];
    const needle = q.toLowerCase();
    const hay = src.toLowerCase();

    let idx = 0;
    while (idx < hay.length) {
      const at = hay.indexOf(needle, idx);
      if (at === -1) break;
      out.push({ start: at, end: at + needle.length });
      idx = at + needle.length;
      if (out.length > 5000) break; // safety
    }
    return out;
  }, [findQuery, fileContent]);

  useEffect(() => {
    setFindIndex(0);
  }, [findQuery, selected]);

  function scrollToMatch(i: number) {
    const m = findMatches[i];
    if (!m) return;

    // Compute line number from char index
    const before = fileContent.slice(0, m.start);
    const line = before.split("\n").length; // 1-based
    const editor = editorScrollRef.current;
    if (!editor) return;

    // Approx line height (matches CSS)
    const lineHeight = 1.6 * 12; // 19.2px-ish
    const target = (line - 1) * lineHeight;

    editor.scrollTop = target - 80;
    if (gutterScrollRef.current) gutterScrollRef.current.scrollTop = editor.scrollTop;
  }

  function nextMatch() {
    if (findMatches.length === 0) return;
    const ni = (findIndex + 1) % findMatches.length;
    setFindIndex(ni);
    scrollToMatch(ni);
  }

  function prevMatch() {
    if (findMatches.length === 0) return;
    const ni = (findIndex - 1 + findMatches.length) % findMatches.length;
    setFindIndex(ni);
    scrollToMatch(ni);
  }

  const highlightedHtml = useMemo(() => {
    try {
      const langObj = (Prism.languages as any)[prismLang] || Prism.languages.markup;
      return Prism.highlight(fileContent || "", langObj, prismLang);
    } catch {
      const esc = (fileContent || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      return esc;
    }
  }, [fileContent, prismLang]);

  function toggleFolder(path: string) {
    setCollapsed((prev) => ({ ...prev, [path]: !prev[path] }));
  }

  function openContextMenu(e: React.MouseEvent, kind: "file" | "editor", path?: string) {
    e.preventDefault();
    setCtxKind(kind);
    setCtxPath(path || selected || "");
    setCtxOpen(true);

    // keep inside viewport
    const x = clamp(e.clientX, 8, window.innerWidth - 220);
    const y = clamp(e.clientY, 8, window.innerHeight - 160);
    setCtxX(x);
    setCtxY(y);
    setCtxMsg("");
  }

  function closeContextMenu() {
    setCtxOpen(false);
    setCtxKind("none");
    setCtxPath("");
    setCtxMsg("");
  }

  async function ctxCopyPath() {
    const ok = await copyToClipboard(ctxPath || "");
    setCtxMsg(ok ? "Copied path" : "Copy failed");
    setTimeout(closeContextMenu, 700);
  }

  async function ctxCopyFilename() {
    const name = (ctxPath || "").split("/").pop() || "";
    const ok = await copyToClipboard(name);
    setCtxMsg(ok ? "Copied filename" : "Copy failed");
    setTimeout(closeContextMenu, 700);
  }

  async function ctxCopyAll() {
    const ok = await copyToClipboard(fileContent || "");
    setCtxMsg(ok ? "Copied file" : "Copy failed");
    setTimeout(closeContextMenu, 700);
  }

  function renderTree(node: TreeNode, depth: number) {
    if (!node.children) return null;

    return node.children.map((child) => {
      const indent = 10 + depth * 12;

      if (child.kind === "dir") {
        const isCollapsed = !!collapsed[child.path];
        return (
          <div key={child.path}>
            <button
              onClick={() => toggleFolder(child.path)}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "8px 10px",
                paddingLeft: indent,
                borderRadius: 10,
                border: "1px solid transparent",
                background: "transparent",
                cursor: "pointer",
                color: "rgba(255,255,255,0.92)",
                fontSize: 12,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
              title={child.path}
            >
              <span style={{ opacity: 0.9 }}>{isCollapsed ? "▶" : "▼"}</span>
              <span style={{ fontWeight: 800 }}>{child.name}/</span>
            </button>

            {!isCollapsed && <div>{renderTree(child, depth + 1)}</div>}
          </div>
        );
      }

      const active = child.path === selected;
      return (
        <button
          key={child.path}
          onClick={() => openFile(child.path)}
          onContextMenu={(e) => openContextMenu(e, "file", child.path)}
          style={{
            width: "100%",
            textAlign: "left",
            padding: "8px 10px",
            paddingLeft: indent + 18,
            borderRadius: 10,
            border: active ? "1px solid rgba(255,255,255,0.18)" : "1px solid transparent",
            background: active ? "rgba(255,255,255,0.08)" : "transparent",
            cursor: "pointer",
            color: "rgba(255,255,255,0.92)",
            fontSize: 12,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          }}
          title={child.path}
        >
          {child.name}
        </button>
      );
    });
  }

  // Global keybindings: Ctrl/Cmd+F opens find; Esc closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setFindOpen(true);
        setTimeout(() => findInputRef.current?.focus(), 0);
      }
      if (e.key === "Escape") {
        setFindOpen(false);
        closeContextMenu();
      }
      if (findOpen && e.key === "Enter") {
        e.preventDefault();
        nextMatch();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [findOpen, findIndex, findMatches.length, findQuery, fileContent]);

  // Track selection for "copy selection"
  useEffect(() => {
    const onSel = () => {
      const sel = window.getSelection();
      if (!sel) return;

      const text = sel.toString();
      if (!text) {
        setSelectionText("");
        return;
      }

      const editor = editorContentRef.current;
      if (!editor) return;

      const anchor = sel.anchorNode;
      const focus = sel.focusNode;
      if (!anchor || !focus) return;

      const inEditor =
        editor.contains(anchor.nodeType === 3 ? (anchor.parentElement as any) : (anchor as any)) &&
        editor.contains(focus.nodeType === 3 ? (focus.parentElement as any) : (focus as any));

      setSelectionText(inEditor ? text : "");
    };

    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, []);

  return (
    <main style={{ minHeight: "100vh", background: "#fafafa", color: "#111827" }}>
      {/* Prism theme */}
      <style jsx global>{`
        .token.comment,
        .token.prolog,
        .token.doctype,
        .token.cdata {
          color: #6b7280;
        }
        .token.punctuation {
          color: #9ca3af;
        }
        .token.property,
        .token.tag,
        .token.constant,
        .token.symbol,
        .token.deleted {
          color: #fca5a5;
        }
        .token.boolean,
        .token.number {
          color: #fbbf24;
        }
        .token.selector,
        .token.attr-name,
        .token.string,
        .token.char,
        .token.builtin,
        .token.inserted {
          color: #86efac;
        }
        .token.operator,
        .token.entity,
        .token.url {
          color: #93c5fd;
        }
        .token.atrule,
        .token.attr-value,
        .token.keyword {
          color: #c4b5fd;
        }
        .token.function,
        .token.class-name {
          color: #f9a8d4;
        }
        .token.regex,
        .token.important,
        .token.variable {
          color: #fdba74;
        }
      `}</style>

      {/* Header */}
      <header style={{ background: "#fff", borderBottom: "1px solid #e5e7eb" }}>
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            padding: "14px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 12,
                background: "#111827",
                color: "#fff",
                display: "grid",
                placeItems: "center",
                fontWeight: 900,
              }}
            >
              AB
            </div>
            <div>
              <div style={{ fontWeight: 900, lineHeight: 1.1 }}>Agent Builder</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Generate full-stack apps from a prompt</div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              <StatusDot status={build?.status || "ready"} />
              {statusText}
            </div>

            {/* ✅ NEW: Mode selector (doesn't change your UI vibe) */}
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as any)}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                background: "#fff",
                color: "#111827",
                fontSize: 13,
                fontWeight: 800,
                outline: "none",
              }}
              title="Choose generation mode"
            >
              <option value="auto">Auto</option>
              <option value="ai">AI (Gemini)</option>
              <option value="local">Local</option>
            </select>

            <ModePill generationMode={generationMode} aiProvider={aiProvider} />

            <a
              href={`/api/export?buildId=${encodeURIComponent(buildId)}`}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                background: build?.status === "done" ? "#111827" : "#e5e7eb",
                color: build?.status === "done" ? "#fff" : "#6b7280",
                textDecoration: "none",
                fontSize: 13,
                fontWeight: 800,
                pointerEvents: build?.status === "done" ? "auto" : "none",
              }}
              title="Download generated project as ZIP"
            >
              Download ZIP
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "22px 18px 8px" }}>
        <div
          style={{
            background: "linear-gradient(135deg, #ffffff, #eef2ff)",
            border: "1px solid #e5e7eb",
            borderRadius: 22,
            padding: 18,
            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
          }}
        >
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 950 }}>Build an app in minutes — from one prompt</h1>
          <p style={{ margin: "8px 0 0", opacity: 0.8, maxWidth: 720 }}>
            Describe what you want. The builder generates a backend + frontend you can run locally or export as a ZIP.
          </p>
          {buildId && (
            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
              Build ID:{" "}
              <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{buildId}</span>
            </div>
          )}
        </div>
      </section>

      {/* Main */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "12px 18px 24px" }}>
        <div style={{ display: "grid", gap: 14 }}>
          <Card title="Describe your app" subtitle="Tip: include fields + select options for best results">
            <div style={{ display: "grid", gap: 10 }}>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. Build a bug tracker with fields..."
                style={{
                  width: "100%",
                  minHeight: 120,
                  padding: 12,
                  borderRadius: 14,
                  border: "1px solid #e5e7eb",
                  outline: "none",
                  fontSize: 14,
                  background: "#fff",
                }}
              />

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {starters.map((s) => (
                    <button
                      key={s.title}
                      onClick={() => setPrompt(s.prompt)}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 999,
                        border: "1px solid #e5e7eb",
                        background: "#fff",
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                      title={s.desc}
                    >
                      {s.title}
                    </button>
                  ))}
                </div>

                <button
                  onClick={start}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 14,
                    border: "1px solid #111827",
                    background: "#111827",
                    color: "#fff",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  Generate App
                </button>
              </div>
            </div>
          </Card>

          <Card title="Build progress" subtitle="Friendly logs (last 10 lines per agent)">
            {agents.length === 0 ? (
              <div style={{ fontSize: 14, opacity: 0.75 }}>
                Click <strong>Generate App</strong> to start.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {agents.map((a: any) => (
                  <div
                    key={a.name}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 16,
                      overflow: "hidden",
                      background: "#fff",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "10px 12px",
                        borderBottom: "1px solid #f3f4f6",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ fontWeight: 900 }}>{a.name}</div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        <StatusDot status={a.status} />
                        {a.status}
                      </div>
                    </div>
                    <div
                      style={{
                        padding: 12,
                        fontSize: 12,
                        background: "#fafafa",
                        whiteSpace: "pre-wrap",
                        lineHeight: 1.4,
                      }}
                    >
                      {(a.log || []).slice(-10).join("\n") || "—"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Planner output" subtitle="What the builder used to generate this app">
            <pre
              style={{
                margin: 0,
                fontSize: 12,
                lineHeight: 1.4,
                padding: 12,
                borderRadius: 14,
                border: "1px solid #e5e7eb",
                background: "#fafafa",
                maxHeight: 260,
                overflow: "auto",
                whiteSpace: "pre-wrap",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              }}
            >
              {JSON.stringify(plannerOutput, null, 2)}
            </pre>
          </Card>

          <Card title="Generated files" subtitle="Mini IDE: right-click menu, find in file, copy selection">
            <div
              onClick={closeContextMenu}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 18,
                overflow: "hidden",
                background: "#0b1220",
                position: "relative",
              }}
            >
              {/* IDE top bar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: "10px 12px",
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.9)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 999, background: "#ef4444" }} />
                    <span style={{ width: 10, height: 10, borderRadius: 999, background: "#f59e0b" }} />
                    <span style={{ width: 10, height: 10, borderRadius: 999, background: "#10b981" }} />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800 }}>Generated Project</div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <input
                    value={fileQuery}
                    onChange={(e) => setFileQuery(e.target.value)}
                    placeholder="Search files…"
                    style={{
                      width: 220,
                      padding: "8px 10px",
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "#0a0f1a",
                      color: "rgba(255,255,255,0.9)",
                      outline: "none",
                      fontSize: 12,
                    }}
                  />
                  <span style={{ fontSize: 12, opacity: 0.75 }}>
                    {files.length ? `${filteredFiles.length} / ${files.length}` : "0 / 0"} files
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setFindOpen((v) => !v);
                      setTimeout(() => findInputRef.current?.focus(), 0);
                    }}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.14)",
                      background: "transparent",
                      color: "rgba(255,255,255,0.92)",
                      fontSize: 12,
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                    title="Find in file (Ctrl/Cmd+F)"
                  >
                    Find
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", minHeight: 560 }}>
                {/* Sidebar tree */}
                <div
                  style={{
                    borderRight: "1px solid rgba(255,255,255,0.08)",
                    background: "#0a0f1a",
                    color: "rgba(255,255,255,0.92)",
                    overflow: "auto",
                    padding: 8,
                  }}
                >
                  {filteredFiles.length === 0 ? (
                    <div style={{ fontSize: 13, opacity: 0.75, padding: 10 }}>
                      {files.length === 0 ? "Run a build to generate files." : "No matches."}
                    </div>
                  ) : (
                    <div>{renderTree(tree, 0)}</div>
                  )}
                </div>

                {/* Editor */}
                <div
                  style={{
                    background: "#0b1220",
                    color: "rgba(255,255,255,0.92)",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  {/* Tabs */}
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      padding: "8px 10px",
                      borderBottom: "1px solid rgba(255,255,255,0.08)",
                      overflowX: "auto",
                      background: "#0b1220",
                    }}
                  >
                    {tabs.length === 0 ? (
                      <div style={{ fontSize: 12, opacity: 0.7, padding: "6px 2px" }}>Open a file to start…</div>
                    ) : (
                      tabs.map((t) => {
                        const isActive = t === selected;
                        const label = t.split("/").slice(-1)[0] || t;
                        return (
                          <div
                            key={t}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 8,
                              padding: "8px 10px",
                              borderRadius: 12,
                              border: isActive
                                ? "1px solid rgba(255,255,255,0.18)"
                                : "1px solid rgba(255,255,255,0.08)",
                              background: isActive ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
                              cursor: "pointer",
                              userSelect: "none",
                              whiteSpace: "nowrap",
                            }}
                            title={t}
                            onClick={(e) => {
                              e.stopPropagation();
                              void openFile(t);
                            }}
                            onContextMenu={(e) => openContextMenu(e, "file", t)}
                          >
                            <span style={{ fontSize: 12, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                              {label}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                closeTab(t);
                              }}
                              style={{
                                border: "none",
                                background: "transparent",
                                color: "rgba(255,255,255,0.7)",
                                cursor: "pointer",
                                fontSize: 14,
                                lineHeight: 1,
                              }}
                              title="Close tab"
                            >
                              ×
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Find bar */}
                  {findOpen && (
                    <div
                      style={{
                        padding: "10px 12px",
                        borderBottom: "1px solid rgba(255,255,255,0.08)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                        flexWrap: "wrap",
                        background: "rgba(255,255,255,0.03)",
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <input
                          ref={findInputRef}
                          value={findQuery}
                          onChange={(e) => setFindQuery(e.target.value)}
                          placeholder="Find…"
                          style={{
                            width: 260,
                            padding: "8px 10px",
                            borderRadius: 12,
                            border: "1px solid rgba(255,255,255,0.14)",
                            background: "#0a0f1a",
                            color: "rgba(255,255,255,0.9)",
                            outline: "none",
                            fontSize: 12,
                          }}
                        />
                        <div style={{ fontSize: 12, opacity: 0.8 }}>
                          {findMatches.length ? (
                            <>
                              <strong>{findIndex + 1}</strong> / {findMatches.length}
                            </>
                          ) : (
                            "0 / 0"
                          )}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            prevMatch();
                          }}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 12,
                            border: "1px solid rgba(255,255,255,0.14)",
                            background: "transparent",
                            color: "rgba(255,255,255,0.92)",
                            fontSize: 12,
                            fontWeight: 900,
                            cursor: "pointer",
                          }}
                        >
                          Prev
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            nextMatch();
                          }}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 12,
                            border: "1px solid rgba(255,255,255,0.14)",
                            background: "transparent",
                            color: "rgba(255,255,255,0.92)",
                            fontSize: 12,
                            fontWeight: 900,
                            cursor: "pointer",
                          }}
                        >
                          Next
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setFindOpen(false);
                          }}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 12,
                            border: "1px solid rgba(255,255,255,0.14)",
                            background: "transparent",
                            color: "rgba(255,255,255,0.92)",
                            fontSize: 12,
                            fontWeight: 900,
                            cursor: "pointer",
                          }}
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Editor toolbar */}
                  <div
                    style={{
                      padding: "10px 12px",
                      borderBottom: "1px solid rgba(255,255,255,0.08)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      flexWrap: "wrap",
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: 900 }}>{selected ? selected : "Editor"}</div>
                      {selected && <span style={{ fontSize: 12, opacity: 0.7 }}>{prismLang}</span>}
                      {selectionText && (
                        <span style={{ fontSize: 12, opacity: 0.75 }}>
                          Selection: {selectionText.length.toLocaleString()} chars
                        </span>
                      )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <button
                        onClick={() => setWrap((w) => !w)}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 12,
                          border: "1px solid rgba(255,255,255,0.14)",
                          background: "transparent",
                          color: "rgba(255,255,255,0.92)",
                          fontSize: 12,
                          fontWeight: 800,
                          cursor: "pointer",
                        }}
                        title="Toggle line wrapping"
                      >
                        {wrap ? "Wrap: On" : "Wrap: Off"}
                      </button>

                      <button
                        onClick={handleCopyCode}
                        disabled={!fileContent}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 12,
                          border: "1px solid rgba(255,255,255,0.14)",
                          background: fileContent ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.05)",
                          color: fileContent ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.45)",
                          fontSize: 12,
                          fontWeight: 900,
                          cursor: fileContent ? "pointer" : "default",
                        }}
                        title="Copy file contents"
                      >
                        {copyState === "copied" ? "Copied!" : copyState === "failed" ? "Copy failed" : "Copy file"}
                      </button>

                      <button
                        onClick={handleCopySelection}
                        disabled={!selectionText}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 12,
                          border: "1px solid rgba(255,255,255,0.14)",
                          background: selectionText ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.05)",
                          color: selectionText ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.45)",
                          fontSize: 12,
                          fontWeight: 900,
                          cursor: selectionText ? "pointer" : "default",
                        }}
                        title="Copy selected text only"
                      >
                        {selectionCopyState === "copied"
                          ? "Copied!"
                          : selectionCopyState === "failed"
                          ? "Copy failed"
                          : "Copy selection"}
                      </button>
                    </div>
                  </div>

                  {fileError && (
                    <div
                      style={{
                        padding: 10,
                        background: "rgba(239,68,68,0.12)",
                        borderBottom: "1px solid rgba(255,255,255,0.08)",
                        color: "rgba(255,255,255,0.92)",
                        fontSize: 12,
                      }}
                    >
                      <strong>Error:</strong> {fileError}
                    </div>
                  )}

                  {/* Editor content */}
                  <div
                    style={{ display: "grid", gridTemplateColumns: "56px 1fr", flex: 1, overflow: "hidden" }}
                    onContextMenu={(e) => openContextMenu(e, "editor", selected)}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Gutter */}
                    <div
                      ref={gutterScrollRef}
                      style={{
                        background: "#0a0f1a",
                        borderRight: "1px solid rgba(255,255,255,0.08)",
                        color: "rgba(255,255,255,0.45)",
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                        fontSize: 12,
                        lineHeight: 1.6,
                        padding: "12px 10px",
                        overflow: "hidden",
                        userSelect: "none",
                      }}
                    >
                      {selected ? lines.map((_, i) => <div key={i}>{i + 1}</div>) : <div style={{ opacity: 0.7 }}>—</div>}
                    </div>

                    {/* Code */}
                    <div
                      ref={editorScrollRef}
                      onScroll={syncScroll}
                      style={{
                        overflow: "auto",
                        padding: 12,
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                        fontSize: 12,
                        lineHeight: 1.6,
                      }}
                    >
                      <div ref={editorContentRef}>
                        {selected ? (
                          <pre
                            style={{
                              margin: 0,
                              whiteSpace: wrap ? "pre-wrap" : "pre",
                              wordBreak: wrap ? "break-word" : "normal",
                            }}
                          >
                            <code
                              className={`language-${prismLang}`}
                              dangerouslySetInnerHTML={{ __html: highlightedHtml || " " }}
                            />
                          </pre>
                        ) : (
                          <div style={{ opacity: 0.7, fontSize: 13 }}>Select a file from the tree…</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Context menu */}
              {ctxOpen && (
                <div
                  style={{
                    position: "fixed",
                    left: ctxX,
                    top: ctxY,
                    width: 210,
                    background: "#0a0f1a",
                    border: "1px solid rgba(255,255,255,0.14)",
                    borderRadius: 14,
                    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
                    color: "rgba(255,255,255,0.92)",
                    zIndex: 9999,
                    overflow: "hidden",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    style={{
                      padding: 10,
                      borderBottom: "1px solid rgba(255,255,255,0.08)",
                      fontSize: 12,
                      opacity: 0.85,
                    }}
                  >
                    {ctxKind === "editor" ? "Editor" : "File"} menu
                  </div>

                  <button
                    onClick={ctxCopyPath}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 12px",
                      border: "none",
                      background: "transparent",
                      color: "inherit",
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    Copy path
                  </button>

                  <button
                    onClick={ctxCopyFilename}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 12px",
                      border: "none",
                      background: "transparent",
                      color: "inherit",
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    Copy filename
                  </button>

                  {ctxKind === "editor" && (
                    <button
                      onClick={ctxCopyAll}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "10px 12px",
                        border: "none",
                        background: "transparent",
                        color: "inherit",
                        cursor: "pointer",
                        fontSize: 12,
                      }}
                    >
                      Copy file
                    </button>
                  )}

                  {ctxMsg && (
                    <div style={{ padding: 10, fontSize: 12, opacity: 0.85, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                      {ctxMsg}
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>
      </section>
    </main>
  );
}