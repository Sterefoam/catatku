import { db } from "../src/lib/db";
import { seedDemoData } from "../src/lib/db/demo-seed";

const result = seedDemoData(db);
console.log(
  result.created
    ? `Data demo dibuat. Masuk dengan demo@catatku.id / demo12345`
    : `Akun demo sudah ada (${result.userId}), tidak ada data ganda.`,
);
