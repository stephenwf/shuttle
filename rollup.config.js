import { createRollupConfig } from 'rollup-library-template';

const config = createRollupConfig({
  input: './src/worker.ts',

  output: {
    dir: `./dist`,
    sourcemap: true,
    format: 'es',
  },
  minify: false,
  nodeResolve: {
    browser: true,
  },
});

// Roll up configs
export default [config];
