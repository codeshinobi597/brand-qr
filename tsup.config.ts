import { defineConfig } from 'tsup';

// The two configs build in parallel, so `npm run build` cleans `build/` once up front rather than
// using tsup's `clean`, which could delete the other config's output mid-build.
export default defineConfig([
  {
    entry: { index: 'src/index.ts', react: 'src/react/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    outDir: 'build',
    target: 'es2020',
    external: ['react'],
  },
  {
    // Browser-only helpers (canvas / download). Marked as a client module for Next.js.
    entry: { client: 'src/client/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    outDir: 'build',
    target: 'es2020',
    banner: { js: "'use client';" },
  },
]);
