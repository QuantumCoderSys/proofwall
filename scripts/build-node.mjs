// Bundles the Node/Docker server into dist/server.mjs (run `npm run build` first for public/ assets).
import { build } from 'esbuild';

await build({
  entryPoints: ['src/node/server.ts'],
  outfile: 'dist/server.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
  logLevel: 'info',
  // Lets bundled CommonJS dependencies call require() from an ES module.
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
});
