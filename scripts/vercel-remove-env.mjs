import fs from "node:fs";

/**
 * Menghapus satu environment variable dari project Vercel.
 * Pemakaian: node scripts/vercel-remove-env.mjs INBOUND_EMAIL_USER
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

const key = process.argv[2];
if (!key) throw new Error("Sebutkan nama env yang dihapus.");

const env = readEnv();
if (!env.VERCEL_TOKEN) throw new Error("VERCEL_TOKEN kosong di .env.local");
const link = JSON.parse(fs.readFileSync(".vercel/project.json", "utf8"));
const headers = { authorization: `Bearer ${env.VERCEL_TOKEN}` };

const list = await fetch(
  `https://api.vercel.com/v9/projects/${link.projectId}/env`,
  { headers },
);
const body = await list.json();
if (!list.ok) throw new Error(`Gagal list env: ${list.status} ${JSON.stringify(body).slice(0, 200)}`);

const entries = (body.envs ?? []).filter((entry) => entry.key === key);
if (entries.length === 0) {
  console.log(`Env ${key} tidak ditemukan (mungkin sudah terhapus).`);
} else {
  for (const entry of entries) {
    const response = await fetch(
      `https://api.vercel.com/v9/projects/${link.projectId}/env/${entry.id}`,
      { method: "DELETE", headers },
    );
    console.log(`Hapus ${key} (${entry.id}): ${response.status}`);
    if (!response.ok) {
      console.log(await response.text());
    }
  }
}
