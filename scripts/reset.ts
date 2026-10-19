import fs from "node:fs";
import path from "node:path";

const dataDir = path.join(process.cwd(), "data");
for (const suffix of ["", "-wal", "-shm"]) {
  const target = path.join(dataDir, `app.db${suffix}`);
  if (fs.existsSync(target)) {
    fs.rmSync(target);
    console.log(`Dihapus: ${target}`);
  }
}

// Import dinamis: modul db akan membuat file baru + menjalankan migrasi otomatis.
const { db } = await import("../src/lib/db");
const { seedDemoData } = await import("../src/lib/db/demo-seed");

const result = seedDemoData(db);
console.log(
  result.created
    ? "Database baru siap. Masuk dengan demo@catatku.id / demo12345"
    : "Akun demo sudah ada.",
);
