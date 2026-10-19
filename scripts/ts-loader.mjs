import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * Loader kecil agar skrip CLI (node scripts/*.ts) bisa mengimpor modul
 * aplikasi yang ditulis TypeScript tanpa ekstensi (gaya bundler/Next).
 * Node 26 sudah bisa menjalankan TypeScript secara native; hook ini hanya
 * melengkapi resolusi specifier relatif.
 */
export async function resolve(specifier, context, nextResolve) {
  const relative = specifier.startsWith("./") || specifier.startsWith("../");
  if (relative && context.parentURL && !path.extname(specifier)) {
    const parentPath = fileURLToPath(context.parentURL);
    const candidate = path.resolve(path.dirname(parentPath), specifier);

    for (const extension of [".ts", ".tsx", ".mts", ".js", ".mjs"]) {
      const file = `${candidate}${extension}`;
      if (existsSync(file)) {
        return { url: pathToFileURL(file).href, shortCircuit: true };
      }
    }

    for (const extension of [".ts", ".tsx", ".js"]) {
      const indexFile = path.join(candidate, `index${extension}`);
      if (existsSync(indexFile)) {
        return { url: pathToFileURL(indexFile).href, shortCircuit: true };
      }
    }
  }

  return nextResolve(specifier, context);
}
