import { db, ensureDatabaseReady } from "../src/lib/db";
import { seedDemoData } from "../src/lib/db/demo-seed";

async function main() {
  await ensureDatabaseReady();
  const result = await seedDemoData(db);
  console.log(
    result.created
      ? "Data demo dibuat. Masuk dengan demo@catatku.id / demo12345"
      : `Akun demo sudah ada (${result.userId}), tidak ada data ganda.`,
  );
}

main().catch((error) => {
  console.error("Seed gagal:", error);
  process.exit(1);
});
