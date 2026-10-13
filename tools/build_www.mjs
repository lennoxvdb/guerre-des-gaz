// Prépare le dossier www/ (ce qui part dans l'appli Android).
// Usage : node tools/build_www.mjs [version]
import { cpSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';

const version = process.argv[2] || JSON.parse(readFileSync('package.json', 'utf8')).version;
rmSync('www', { recursive: true, force: true });
mkdirSync('www');
for (const p of ['index.html', 'css', 'src', 'lib', 'assets']) cpSync(p, 'www/' + p, { recursive: true });
writeFileSync('www/version.json', JSON.stringify({ version }) + '\n');
console.log('www/ prêt, version', version);
