import { COMPACT_CHROME_SCRIPT, SHARE_CONVERSATION_SCRIPT, conversationNavigationScript, managementScript } from './deepseek-page.mjs';
import { CHAT_PARTITION_KEY, DEEPSEEK_HOME, chatDestination } from './work-chat-model.mjs';

// Read only the visible website's navigation metadata. Never inspect storage or credentials.
export const CHAT_NAVIGATION_SCRIPT = String.raw`(() => ({ url: location.origin + location.pathname, title: document.title, navigationReady: !!document.querySelector('[data-dhp-site-sidebar]'), rows: Array.from(document.querySelectorAll('a[href]'), a => ({url:a.href, title:a.getAttribute('title') || a.textContent || ''})).filter(a => /^https:\/\/chat\.deepseek\.com\/a\/[a-zA-Z0-9_-]+\/s\/[a-zA-Z0-9_-]+\/?(?:[?#].*)?$/.test(a.url)).slice(0,500) }))()`;

export function createDeepSeekGuest({ bridge, host, report, observe, document: dom = globalThis.document }) {
  let element, lease, unsubscribe, ready = false, stopped = false, initializing, pending = DEEPSEEK_HOME, scanning = false, scanAgain = false, navigation = 0;
  const events = new AbortController();
  const fail = error => { if (!stopped) report({ status: 'error', error: error?.message || 'DeepSeek 网页暂时无法加载，请重试。' }); };
  const scan = async () => {
    if (stopped || !ready || !element) return;
    if (scanning) { scanAgain=true; return; }
    scanning = true;
    const revision=navigation;
    try { const owned=element; if (!chatDestination(owned.getURL())) return; await owned.executeJavaScript(COMPACT_CHROME_SCRIPT).catch(() => {}); const snapshot = await owned.executeJavaScript(CHAT_NAVIGATION_SCRIPT); if (!stopped && element===owned) { if (revision===navigation) observe(snapshot); else scanAgain=true; } }
    catch (error) { if (!stopped) report({ error: '网页已打开，会话列表暂未同步。可在网页中继续使用。' }); }
    finally { scanning = false; if (scanAgain && !stopped) { scanAgain=false; void scan(); } }
  };
  const loadPending = async () => {
    if (stopped || !ready || !pending) return;
    const url = pending, owned = element, revision = ++navigation; pending = null;
    try {
      if (owned.getURL() === url) { scan(); return; }
      const script = chatDestination(owned.getURL()) && conversationNavigationScript(url);
      if (script) {
        const switched = await owned.executeJavaScript(script);
        if (stopped || element !== owned || revision !== navigation) return;
        if (switched === true) { scan(); return; }
      }
      if (stopped || element !== owned || revision !== navigation) return;
      report({ status: 'loading', error: '' });
      await owned.loadURL(url);
    } catch (error) { if (!stopped && element === owned && revision === navigation && error?.code !== 'ERR_ABORTED') fail(error); }
  };
  const start = () => {
    if (initializing || element || stopped) return initializing;
    if (!bridge?.acquire || !bridge?.release) { fail(new Error('聊天模式需要 Harness 桌面版的内嵌浏览器支持。')); return Promise.resolve(); }
    initializing = (async () => {
      const reservation = await bridge.acquire(CHAT_PARTITION_KEY);
      if (stopped) { await bridge.release(reservation.lease); return; }
      lease = reservation.lease;
      element = dom.createElement('webview');
      element.className = 'dhp-deepseek-webview';
      element.dataset.sidebarBrowserFrame = 'webview';
      element.setAttribute('aria-label', 'DeepSeek 官方聊天网页');
      element.setAttribute('name', lease);
      element.setAttribute('partition', reservation.partition);
      element.setAttribute('allowpopups', '');
      element.setAttribute('src', `about:blank#${lease}`);
      const on = (name, callback) => element.addEventListener(name, callback, { signal: events.signal });
      on('dom-ready', () => { ready = true; loadPending(); scan(); });
      for (const name of ['did-navigate', 'did-navigate-in-page', 'page-title-updated', 'did-stop-loading']) on(name, scan);
      on('did-start-loading', () => { if (!stopped) report({ status: 'loading', error: '' }); });
      on('did-fail-load', event => { if (event.isMainFrame && event.errorCode !== -3) fail(new Error(event.errorDescription || 'DeepSeek 网页加载失败。')); });
      on('render-process-gone', () => { ready=false; fail(new Error('网页进程已退出，请关闭后重新打开聊天模式。')); });
      unsubscribe = bridge.onOpenRequested?.(lease, url => {
        const destination = chatDestination(url);
        if (destination) { pending = destination; loadPending(); }
      });
      host.append(element);
    })().catch(fail).finally(() => { initializing = null; });
    return initializing;
  };
  return {
    start,
    navigate(url) { const destination = chatDestination(url); if (!destination) throw new Error('DeepSeek 网页地址无效。'); pending = destination; loadPending(); },
    scan,
    async manage(row,action,title) {
      const script=managementScript(row,action,title);
      if (!ready || !element || !chatDestination(element.getURL())) throw new Error('请等待 DeepSeek 网页加载完成。');
      const result=await element.executeJavaScript(script);
      if (!result?.ok) throw new Error(result?.error || '网页操作未完成，请重试。');
      await scan(); return result;
    },
    async share() {
      if (!ready || !element || !chatDestination(element.getURL())) throw new Error('请等待 DeepSeek 网页加载完成。');
      const result=await element.executeJavaScript(SHARE_CONVERSATION_SCRIPT);
      if (!result?.ok) throw new Error(result?.error || '暂时找不到官网分享按钮，请确认会话页面已加载。');
      return result;
    },
    async reload() {
      if (ready) { report({status:'loading',error:''}); try { element.reload(); } catch(error) { fail(error); } return; }
      await initializing;
      if (stopped) return;
      unsubscribe?.(); unsubscribe=null; element?.remove(); element=null;
      if (lease) { const previous=lease; lease=null; await bridge.release(previous).catch(()=>{}); }
      report({status:'loading',error:''}); pending=pending || DEEPSEEK_HOME; return start();
    },
    async dispose() {
      if (stopped) return;
      stopped = true; events.abort(); unsubscribe?.(); element?.remove();
      if (lease) { const owned = lease; lease = null; await bridge.release(owned).catch(() => {}); }
      await initializing;
    },
  };
}
