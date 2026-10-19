import fs from "node:fs";
import path from "node:path";

async function main() {
  const dataDir = path.join(process.cwd(), "data");
  for (const suffix of ["", "-wal", "-shm"]) {
    const target = path.join(dataDir, `app.db${suffix}`);
    if (fs.existsSync(target)) {
      fs.rmSync(target);
      console.log(`Dihapus: ${target}`);
    }
  }

  // Import dinamis: modul db membuat file baru + menjalankan migrasi otomatis.
  const { db, ensureDatabaseReady } = await import("../src/lib/db");
  const { seedDemoData } = await import("../src/lib/db/demo-seed");

  await ensureDatabaseReady();
  const result = await seedDemoData(db);
  console.log(
    result.created
      ? "Database baru siap. Masuk dengan demo@catatku.id / demo12345"
      : "Akun demo sudah ada.",
  );
}

main().catch((error) => {
  console.error("Reset gagal:", error);
  process.exit(1);
});
