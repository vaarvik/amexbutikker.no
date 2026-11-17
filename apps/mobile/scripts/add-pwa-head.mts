/// <reference types="node" />
// Adds the tags that make the web export installable from the Home Screen (manifest, icons,
// iOS full-screen tags) to every exported HTML file. Run after `expo export --platform web`.
// A +html.tsx would do the same, but with it Expo's static export leaves out the app's scripts.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const HEAD = [
  // Behind Cloudflare Access the manifest needs the login cookie too.
  '<link rel="manifest" href="/manifest.webmanifest" crossorigin="use-credentials">',
  '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-title" content="Tar de Amex?">',
  '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
  '<meta name="theme-color" content="#161D3A">',
  '<meta name="referrer" content="no-referrer">',
].join('');

const root = process.argv[2];
if (root === undefined) {
  console.error('usage: node scripts/add-pwa-head.mts <web export dir>');
  process.exit(1);
}

let count = 0;
for (const entry of await readdir(root, { recursive: true })) {
  if (!entry.endsWith('.html')) continue;
  const file = join(root, entry);
  const html = await readFile(file, 'utf8');
  if (html.includes('rel="manifest"') || !html.includes('</head>')) continue;
  await writeFile(file, html.replace('</head>', `${HEAD}</head>`));
  count += 1;
}
console.log(`add-pwa-head: ${String(count)} files`);
