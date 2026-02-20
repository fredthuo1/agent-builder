const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5050";

export async function getSpec() {
  const r = await fetch(`${BACKEND}/api/spec`, { cache: "no-store" });
  if (!r.ok) throw new Error("Failed to load spec");
  return r.json();
}

export async function list(entity, { limit = 50, offset = 0 } = {}) {
  const r = await fetch(`${BACKEND}/api/${entity}?limit=${limit}&offset=${offset}`, { cache: "no-store" });
  if (!r.ok) throw new Error("Failed to list");
  return r.json();
}

export async function getOne(entity, id) {
  const r = await fetch(`${BACKEND}/api/${entity}/${id}`, { cache: "no-store" });
  if (!r.ok) throw new Error("Not found");
  return r.json();
}

export async function createOne(entity, data) {
  const r = await fetch(`${BACKEND}/api/${entity}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error("Failed to create");
  return r.json();
}

export async function updateOne(entity, id, data) {
  const r = await fetch(`${BACKEND}/api/${entity}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error("Failed to update");
  return r.json();
}

export async function deleteOne(entity, id) {
  const r = await fetch(`${BACKEND}/api/${entity}/${id}`, { method: "DELETE" });
  if (!r.ok) throw new Error("Failed to delete");
  return r.json();
}
