// Bundles src/main.jsx -> public/assets/bundle.js (and the CSS it imports ->
// public/assets/bundle.css). Run `npm install` once, then `node build.js`
// for a one-off build or `node build.js --watch` to rebuild on save while
// the server (which serves public/) is running.
import esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes('--watch');

const options = {
  entryPoints: [path.join(__dirname, 'src', 'main.jsx')],
  outfile: path.join(__dirname, 'public', 'assets', 'bundle.js'),
  bundle: true,
  format: 'esm',
  jsx: 'automatic',
  loader: { '.js': 'jsx' },
  define: { 'process.env.NODE_ENV': JSON.stringify('development') },
  sourcemap: true,
  logLevel: 'info',
  absWorkingDir: __dirname,
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log('esbuild watching for changes…');
} else {
  await esbuild.build(options);
  console.log('build complete');
}
