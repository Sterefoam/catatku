import fs from "node:fs";

/** Matikan Deployment Protection (Vercel Authentication) untuk project. */
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
const projectId = "prj_ot5wVHDmTHW3GNScz0cLql9PB92U";
if (!token) throw new Error("VERCEL_TOKEN kosong");

const response = await fetch(`https://api.vercel.com/v9/projects/${projectId}`, {
  method: "PATCH",
  headers: {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  },
  body: JSON.stringify({
    ssoProtection: null,
    passwordProtection: null,
    publicSource: false,
  }),
});

const body = await response.json().catch(() => ({}));
console.log("status:", response.status);
console.log("ssoProtection:", body.ssoProtection ?? null);
console.log("passwordProtection:", body.passwordProtection ?? null);
if (!response.ok) {
  console.error(JSON.stringify(body).slice(0, 400));
  process.exit(1);
}
