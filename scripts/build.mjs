import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
await mkdir('lib', { recursive: true });
await build({ entryPoints: ['src/index.mjs'], outfile: 'lib/index.js', bundle: true, platform: 'node', format: 'esm', packages: 'external', target: 'node22' });
await build({ entryPoints: ['src/client-entry.jsx'], outfile: 'lib/client.cjs', bundle: true, platform: 'browser', format: 'cjs', external: ['react', 'react/jsx-runtime', '@deepseek-ai/dsh-client-ui-primitives'], define: { DSH_PET_PREVIEW: 'false' }, target: 'es2022', jsx: 'automatic' });
const code = await readFile('lib/client.cjs', 'utf8');
await writeFile('lib/client.js', `window.__ModuleLoader__.load({id:"dsh-hide-pet",factory(require){const module={exports:{}};const exports=module.exports;\n${code}\nreturn module.exports;}});\n`);
await build({ entryPoints: ['src/preview-entry.jsx'], outfile: 'lib/preview.js', bundle: true, platform: 'browser', format: 'esm', external: ['@deepseek-ai/dsh-client-ui-primitives'], jsx: 'automatic', define: { DSH_PET_PREVIEW: 'true', 'process.env.NODE_ENV': '"production"' } });
console.log('Host 与 Client 构建完成。');
