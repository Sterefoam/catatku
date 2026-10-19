import fs from "node:fs";

/**
 * Menyiapkan project Vercel + environment variables memakai Vercel REST API.
 * Membaca kredensial dari .env.local (tidak mencetak token).
 */
function readEnv() {
  const text = fs.readFileSync(".env.local", "utf8");
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const value = match[2].trim().replace(/^["']|["']$/g, "");
    if (value) values[match[1]] = value;
  }
  return values;
}

const env = readEnv();
const token = env.VERCEL_TOKEN;
const DB_URL = env.TURSO_DATABASE_URL;
const DB_TOKEN = env.TURSO_AUTH_TOKEN;
if (!token) throw new Error("VERCEL_TOKEN kosong di .env.local");
if (!DB_URL || !DB_TOKEN) throw new Error("Turso env kosong di .env.local");

const API = "https://api.vercel.com";
const headers = {
  authorization: `Bearer ${token}`,
  "content-type": "application/json",
};

async function api(path, init = {}) {
  const response = await fetch(`${API}${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(`Vercel API ${init.method ?? "GET"} ${path} -> ${response.status}: ${body?.error?.message ?? JSON.stringify(body)}`);
    error.body = body;
    error.status = response.status;
    throw error;
  }
  return body;
}

const user = await api("/v2/user");
const orgId = user.user?.id;
console.log("Akun Vercel:", user.user?.username ?? user.user?.email, "| org:", orgId);

// Cari atau buat project.
let project = null;
try {
  const existing = await api("/v9/projects?limit=100");
  project = existing.projects?.find((item) => item.name === "catatku") ?? null;
} catch (error) {
  console.log("Tidak bisa list project:", error.message);
}

if (!project) {
  project = await api("/v11/projects", {
    method: "POST",
    body: JSON.stringify({ name: "catatku", framework: "nextjs" }),
  });
  console.log("Project dibuat:", project.name, "| id:", project.id);
} else {
  console.log("Project sudah ada:", project.name, "| id:", project.id);
}

const envVars = [
  ["TURSO_DATABASE_URL", DB_URL],
  ["TURSO_AUTH_TOKEN", DB_TOKEN],
];

for (const [key, value] of envVars) {
  await api(`/v10/projects/${project.id}/env?upsert=true`, {
    method: "POST",
    body: JSON.stringify({
      key,
      value,
      type: "encrypted",
      target: ["production", "preview", "development"],
    }),
  });
  console.log(`Env ${key}: tersimpan`);
}

// Link project untuk Vercel CLI.
fs.mkdirSync(".vercel", { recursive: true });
fs.writeFileSync(
  ".vercel/project.json",
  JSON.stringify({ projectId: project.id, orgId }, null, 2),
);
fs.writeFileSync(
  ".vercel/deploy-env.json",
  JSON.stringify({ orgId, projectId: project.id }, null, 2),
);
console.log("Project ter-link:", project.name);
