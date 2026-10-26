// Bundles the browser-side TypeScript into ./public. Wrangler runs this before dev/deploy.
import { build } from 'esbuild';

const watch = process.argv.includes('--watch');

const shared = {
  bundle: true,
  minify: !watch,
  sourcemap: watch ? 'inline' : false,
  target: ['es2020'],
  format: 'iife',
  logLevel: 'info',
};

await Promise.all([
  build({ ...shared, entryPoints: ['src/widget/embed.ts'], outfile: 'public/embed.js' }),
  build({ ...shared, entryPoints: ['src/client/app.ts'], outfile: 'public/assets/app.js' }),
]);
