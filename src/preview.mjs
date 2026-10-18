import http from 'node:http';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PetStore } from './store.mjs';
import { createHandler } from './http.mjs';

const HTML = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>codex-mini-pet · DeepSeek Harness</title><style>
*{box-sizing:border-box}body{margin:0;background:#f5f7fa;color:#182c41;font:15px/1.6 system-ui,"Microsoft YaHei",sans-serif}header{height:76px;display:flex;align-items:center;justify-content:space-between;padding:0 6vw;border-bottom:1px solid #dce5ed;background:#fff}header b{letter-spacing:.08em}header span{color:#617487;font-size:12px}main{max-width:1080px;padding:80px 28px;margin:auto}small{color:#4685a5;letter-spacing:.2em;font-weight:700}h1{font-size:52px;line-height:1.2;letter-spacing:-.04em;margin:20px 0}p{max-width:580px;color:#647789;font-size:16px}.stage{margin-top:44px;border:1px solid #dde7ee;border-radius:24px;background:#fff;padding:30px;box-shadow:0 16px 60px #163b6210}.stage h2{font-size:16px;margin-top:0}.controls{display:flex;gap:10px;flex-wrap:wrap}button{border:1px solid #d5e1eb;border-radius:10px;background:#f8fafc;color:#42566b;padding:10px 18px;font:inherit;cursor:pointer}button[data-active=true]{background:#e9f5ff;border-color:#7bb8de;color:#17628e}.note{font-size:13px;color:#8b9cac;margin-top:24px}.tag{display:inline-block;background:#e5f5ee;color:#43886c;border-radius:99px;padding:4px 12px;font-size:12px}.guides{display:flex;gap:24px;margin-top:28px;font-size:13px;color:#63798b}.guides span{display:block}#pet-root{position:fixed;inset:0;pointer-events:none;z-index:100}@media(prefers-color-scheme:dark){body{background:#101923;color:#edf4fa}header,.stage{background:#172330;border-color:#2b3c4b}p{color:#a4b4c2}button{background:#1a2a3a;color:#c1d4e3;border-color:#3b5061}}@media(max-width:640px){h1{font-size:34px}main{padding-top:40px}header{padding:0 20px}.guides{display:block}}
</style><header><b>codex-mini-pet</b><span>DeepSeek Harness · 本地预览</span></header><main><small>A LITTLE COMPANY, WHILE YOU CREATE</small><h1>让灵感，有个伴。</h1><p>deepseek、深蓝鲸娘与智域，陪你把想法变成行动。在左下角设置中选择“codex-mini-pet”，体验动画、视线跟随、拖动和自定义形象。</p><div class="stage"><span class="tag">独立预览 · 不修改应用设置</span><h2 style="margin-top:24px">模拟工作状态</h2><div class="controls"><button data-status="idle" data-active="true">休息</button><button data-status="running">正在工作</button><button data-status="waiting">等待确认</button><button data-status="review">完成待查看</button><button data-status="failed">遇到问题</button><button data-status="multi">多会话优先级</button></div><div class="guides"><span>拖动宠物 · 调整位置</span><span>双击 · 打个招呼</span><span>右键 · 更多动作</span></div><div class="note">状态按钮仅用于预览。安装插件后，工作状态由 Harness 会话提供。</div></div></main><div id="preview-draft" tabindex="-1" style="padding:24px;white-space:pre-wrap"></div><div id="pet-root"></div><script type="module" src="/preview.js"></script></html>`;

export async function startPreview({ dataDir, port = 0, file, petId } = {}) {
  let temporary;
  if (file && !dataDir) { temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-hide-pet-')); dataDir = temporary; }
  const store = new PetStore(dataDir ?? path.resolve('.preview-data'));
  if (file) { const result = await store.importBytes({ name: path.basename(file) }, await fs.readFile(file)); await store.select(result.pet.id); }
  if (petId) await store.select(petId);
  let previewScript;
  try { previewScript = await fs.readFile(new URL('../lib/preview.js', import.meta.url)); }
  catch { throw new Error('预览文件尚未构建，请先在项目目录运行 npm run build。'); }
  const handler = createHandler(store, req => {
    const origin = req.headers.origin, expected = `http://${req.headers.host}`;
    return origin && origin !== expected ? { rejection: 403 } : { peer: {} };
  });
  const server = http.createServer((req, res) => {
    if (req.url?.startsWith('/dsh-hide-pet/')) return void handler(req, res);
    if (req.url === '/preview.js') { res.writeHead(200, { 'Content-Type': 'text/javascript' }); return res.end(previewScript); }
    if (req.url === '/' || req.url === '/index.html') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(HTML); }
    res.writeHead(404); res.end();
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(Number(port), '127.0.0.1', resolve); });
  console.log(JSON.stringify({ url: `http://127.0.0.1:${server.address().port}`, dataDir: store.dataDir }));
  const close = () => { server.close(() => { if (temporary) fs.rm(temporary, { recursive: true, force: true }).finally(() => process.exit()); else process.exit(); }); };
  process.once('SIGINT', close); process.once('SIGTERM', close);
  return undefined;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) startPreview().catch(e => { console.error(e.message); process.exitCode = 1; });
