// Gera UM arquivo HTML autônomo (docs/simulacao/login-simulacao.html) com a tela de login + Secreto-Bot animado (2D recortado, não interativo),
// que abre com duplo clique, sem servidor e sem internet. Uso: node scripts/gerar-simulacao.mjs   (precisa de esbuild: NPM_TOOLS=/caminho/node_modules)
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const raiz = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const NPM = process.env.NPM_TOOLS || join(raiz, 'web/node_modules');
const esbuild = createRequire(`${NPM}/x.js`)('esbuild');
const web = join(raiz, 'web');
const stubs = { io: 'export const io = () => ({ emit() {}, on() {}, disconnect() {} });', 'video': "export async function criarSalaVideo() { return { modo: 'demo' }; }" };
const r = await esbuild.build({
  entryPoints: [join(web, 'src/main.jsx')], bundle: true, write: false, outdir: 'saida', format: 'iife', target: 'es2020', minify: true, logLevel: 'error', nodePaths: [NPM],
  define: { 'process.env.NODE_ENV': '"production"' }, loader: { '.css': 'css' },
  plugins: [{ name: 'stubs', setup(b) {
    b.onResolve({ filter: /^socket\.io-client$/ }, () => ({ path: 'io', namespace: 'stub' }));
    b.onResolve({ filter: /\/video\.js$/ }, () => ({ path: 'video', namespace: 'stub' }));
    b.onResolve({ filter: /^(agora-rtc-sdk-ng|video\.js)$/ }, () => ({ path: 'video', namespace: 'stub' }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, (a) => ({ contents: stubs[a.path], loader: 'js' }));
  } }],
});
let js = ''; let css = '';
for (const o of r.outputFiles) { if (o.path.endsWith('.js')) js = o.text; else if (o.path.endsWith('.css')) css = o.text; }
const uri = (arq, tipo) => `data:${tipo};base64,${readFileSync(join(web, 'public', arq)).toString('base64')}`;
const IMG = { '/marca/bot-corpo.webp': uri('marca/bot-corpo.webp', 'image/webp'), '/marca/bot-balao.webp': uri('marca/bot-balao.webp', 'image/webp'), '/marca/secreto-bot.jpg': uri('marca/secreto-bot.jpg', 'image/jpeg'),
  '/marca/fundo-hospital.svg': uri('marca/fundo-hospital.svg', 'image/svg+xml'), '/marca/logo.svg': uri('marca/logo.svg', 'image/svg+xml'), '/marca/avatar.png': uri('marca/avatar.png', 'image/png') };
for (const [k, v] of Object.entries(IMG)) js = js.split(k).join(v);
let html = readFileSync(join(web, 'index.html'), 'utf8');
for (const [k, v] of Object.entries(IMG)) html = html.split(`url(${k})`).join(`url(${v})`);
html = html.replace(/<link rel="(icon|apple-touch-icon)"[^>]*>\n?/g, '').replace('<title>Revalida Prático</title>', '<title>Revalida.M3D · simulação do login</title>')
  .replace(/<script type="module" src="\/src\/main.jsx"[^>]*><\/script>/, () => `<script>window.__SIMULACAO__=true;</script>\n<script>${js.replace(/<\/script>/g, '<\\/script>')}</script>`)
  .replace('</head>', () => `<style>${css}</style>\n</head>`);
const dest = join(raiz, 'docs/simulacao'); mkdirSync(dest, { recursive: true });
writeFileSync(join(dest, 'login-simulacao.html'), html);
console.log(`docs/simulacao/login-simulacao.html (${(html.length / 1024 / 1024).toFixed(2)} MB)`);
