import fs from "node:fs";

/**
 * Menyimpan environment integrasi BCA ke project Vercel.
 * Jalankan setelah VERCEL_TOKEN diisi di .env.local.
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
if (!token) throw new Error("VERCEL_TOKEN kosong di .env.local");
if (!env.INBOUND_EMAIL_SECRET) throw new Error("INBOUND_EMAIL_SECRET kosong");
if (!env.INBOUND_EMAIL_USER) throw new Error("INBOUND_EMAIL_USER kosong");

const link = JSON.parse(fs.readFileSync(".vercel/project.json", "utf8"));
const projectId = link.projectId;

async function upsertEnv(key, value) {
  const response = await fetch(
    `https://api.vercel.com/v10/projects/${projectId}/env?upsert=true`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        key,
        value,
        type: "encrypted",
        target: ["production", "preview", "development"],
      }),
    },
  );
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gagal set ${key}: ${response.status} ${body.slice(0, 200)}`);
  }
  console.log(`Env ${key}: tersimpan`);
}

await upsertEnv("INBOUND_EMAIL_SECRET", env.INBOUND_EMAIL_SECRET);
await upsertEnv("INBOUND_EMAIL_USER", env.INBOUND_EMAIL_USER);
console.log("Selesai. Lanjut redeploy: npx vercel deploy --prod --yes");
