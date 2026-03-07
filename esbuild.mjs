import { build } from 'esbuild';

const watch = process.argv.includes('--watch');

const shared = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  sourcemap: true,
  external: ['vscode'],
  logLevel: 'info',
};

const contexts = [
  {
    entryPoints: ['src/extension.ts'],
    outfile: 'dist/extension.js',
  },
  {
    entryPoints: ['src/broker.ts'],
    outfile: 'dist/broker.js',
  },
];

if (watch) {
  for (const config of contexts) {
    const ctx = await build({
      ...shared,
      ...config,
      watch: true,
    });
    void ctx;
  }
} else {
  await Promise.all(contexts.map((config) => build({ ...shared, ...config })));
}