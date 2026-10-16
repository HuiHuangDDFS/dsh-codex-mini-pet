import { performAction } from './actions.mjs';
export const API_PREFIX = '/dsh-hide-pet';
const BODY_LIMIT = 34 * 1024 * 1024;
export function json(res, code, body) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(body)); }
async function readJson(req) {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw new Error('需要 application/json。');
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > BODY_LIMIT) throw new Error('请求过大。'); chunks.push(chunk); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export function createHandler(store, admit = () => ({ peer: {} })) {
  return async (req, res) => {
    try {
      const admission = admit(req);
      if ('rejection' in admission) return json(res, admission.rejection, { error: '请通过 DeepSeek Harness 的有效连接访问宠物。' });
      const url = new URL(req.url, 'http://localhost');
      if (!url.pathname.startsWith(API_PREFIX + '/')) return json(res, 404, { error: '找不到宠物资源。' });
      const route = url.pathname.slice(API_PREFIX.length + 1);
      if (req.method === 'GET' && route === 'api/state') return json(res, 200, await store.snapshot());
      if (req.method === 'POST' && route === 'api/action') return json(res, 200, await performAction(store, await readJson(req)));
      if (req.method === 'GET' && /^sprites\/[a-z0-9_-]+$/.test(route)) {
        const { bytes, type } = await store.sprite(route.slice('sprites/'.length));
        res.writeHead(200, { 'Content-Type': type, 'Content-Length': bytes.length, 'Cache-Control': 'private, max-age=0', 'X-Content-Type-Options': 'nosniff' }); return res.end(bytes);
      }
      return json(res, 404, { error: '找不到宠物资源。' });
    } catch (e) { if (!res.headersSent) json(res, 400, { error: e.message }); else res.end(); }
  };
}
