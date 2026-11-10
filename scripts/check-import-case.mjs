/* Guard against case-sensitivity bugs.

   Windows and macOS resolve imports case-insensitively; Linux (Render, CI)
   does not. A file saved as `app.jsx` and imported as `./App` builds fine
   locally and then fails on the deploy with
   `Could not resolve "./App" from "src/main.jsx"`.

   This runs before `npm run build`, so that failure surfaces on the machine
   that introduced it instead of in the deploy log.

   Checks every relative import/require in the source trees and verifies the
   target exists with exactly the same casing. */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const trees = ['src', 'server/src', 'server/scripts', 'server/tests', 'tests'];
const extensions = ['', '.js', '.jsx', '.mjs', '.cjs', '.json', '.css'];
const sourceRe = /\.(jsx?|mjs|cjs)$/;
const importRe = /(?:from\s+|import\s*\(\s*|import\s+|require\s*\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g;

let checks = 0;
const problems = [];

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (sourceRe.test(entry.name)) files.push(full);
  }
  return files;
}

/* exists() with exact casing, which fs.existsSync does not guarantee. */
function exactFile(candidate) {
  let names;
  try {
    names = readdirSync(path.dirname(candidate));
  } catch {
    return false;
  }
  if (!names.includes(path.basename(candidate))) return false;
  try {
    return statSync(candidate).isFile();
  } catch {
    return false;
  }
}

function resolveImport(fromFile, spec) {
  const base = path.resolve(path.dirname(fromFile), spec);
  for (const extension of extensions) {
    if (exactFile(`${base}${extension}`)) return `${base}${extension}`;
  }
  for (const extension of extensions.filter(Boolean)) {
    if (exactFile(path.join(base, `index${extension}`))) return path.join(base, `index${extension}`);
  }
  return null;
}

for (const tree of trees) {
  let files;
  try {
    files = walk(path.join(root, tree));
  } catch {
    continue; // tree does not exist in this checkout
  }

  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(importRe)) {
      const spec = match[1];
      if (/[?*]/.test(spec)) continue; // bundler queries / globs
      checks += 1;

      const resolved = resolveImport(file, spec);
      const relative = path.relative(root, file);
      if (!resolved) {
        problems.push(`missing: ${relative} imports "${spec}"`);
        continue;
      }

      const strip = (value) => value.replace(/\.(jsx?|mjs|cjs|json|css)$/, '');
      const wanted = strip(path.basename(spec));
      const actual = strip(path.basename(resolved));
      if (wanted && wanted !== actual && wanted.toLowerCase() === actual.toLowerCase()) {
        problems.push(`case: ${relative} imports "${spec}" but the file is "${path.basename(resolved)}"`);
      }
    }
  }
}

if (problems.length) {
  console.error('Import path problems (case-sensitive filesystems will fail):\n');
  for (const problem of problems) console.error(`  ${problem}`);
  console.error('\nFix case-only renames with: git mv old.jsx tmp.jsx && git mv tmp.jsx New.jsx');
  process.exit(1);
}

console.log(`Import paths OK (${checks} relative imports checked).`);
