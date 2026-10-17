import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { bindExternalSource } from './activity-source.mjs';
import { CHAT_PANEL, DEEPSEEK_HOME, createWorkChatController, chatSession } from './work-chat-model.mjs';
import { createDeepSeekGuest } from './deepseek-guest.mjs';
import { createTranslator } from './i18n.mjs';

export const workChatCss = `
.dhp-wc{font:inherit;color:var(--dsw-alias-label-primary,#202123)}.dhp-wc *{box-sizing:border-box}.dhp-wc button{font:inherit;color:inherit;cursor:pointer}.dhp-wc button:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#5178ef);outline-offset:3px}.dhp-wc button:disabled{cursor:default;opacity:.5}.dhp-wc-modes{display:flex;align-items:center;gap:3px;padding:4px;border-radius:99px;background:var(--dsw-alias-interactive-bg-hover,#f3f3f4);width:252px;max-width:100%}.dhp-wc-modes button{border:0;background:transparent;flex:1;border-radius:99px;padding:10px 20px;font-size:14px;line-height:20px;white-space:nowrap;transition:background .16s,box-shadow .16s}.dhp-wc-modes button[aria-selected=true]{background:var(--dsw-alias-bg-base,#fff);box-shadow:0 1px 5px #00000012;font-weight:600}.dhp-wc-panel{height:100%;min-height:0;flex:1;display:flex;flex-direction:column;background:var(--dsw-alias-bg-base,#fff)}.dhp-wc-panel-header{min-height:84px;flex:none;padding:16px 22px;display:flex;align-items:center;justify-content:center;position:relative;gap:16px;border-bottom:.5px solid var(--dsw-alias-border-l2,#eee)}.dhp-wc-panel-header .dhp-wc-domain{position:absolute;left:20px;font-size:11px;color:var(--dsw-alias-label-tertiary,#81858c)}.dhp-wc-tools{position:absolute;right:18px;display:flex;gap:5px}.dhp-wc-icon{border:0;background:transparent;border-radius:9px;width:30px;height:30px;display:grid;place-items:center;font-size:18px!important}.dhp-wc-icon:hover{background:var(--dsw-alias-interactive-bg-hover,#eee)}.dhp-wc-viewport{min-height:0;flex:1;position:relative}.dhp-wc-browser{position:fixed;z-index:1;pointer-events:auto;display:flex;flex-direction:column;background:var(--dsw-alias-bg-base,#fff);overflow:hidden}.dhp-wc-browser[hidden]{visibility:hidden;pointer-events:none}.dhp-wc-webhost{flex:1;min-height:0;display:flex}.dhp-deepseek-webview{display:flex;width:100%;height:100%;flex:1;min-height:0;border:0}.dhp-wc-notice{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 18px;background:var(--dsw-alias-interactive-bg-hover,#f6f6f7);font-size:12px;line-height:1.6;flex:none;color:var(--dsw-alias-label-secondary,#666)}.dhp-wc-failure{position:absolute;inset:0;display:grid;align-content:center;justify-items:center;gap:12px;padding:32px;text-align:center;background:var(--dsw-alias-bg-base,#fff);z-index:2}.dhp-wc-failure h2{font-size:20px;font-weight:500;margin:0}.dhp-wc-failure p{max-width:420px;color:var(--dsw-alias-label-secondary,#666);font-size:13px;line-height:1.7;margin:0}.dhp-wc-action{border:1px solid var(--dsw-alias-border-l3,#ddd);background:transparent;border-radius:10px;padding:8px 16px}.dhp-wc-work-switch{position:fixed;z-index:2;pointer-events:auto;transform:translateX(-50%)}.dhp-wc-work-switch .dhp-wc-modes{width:236px}.dhp-wc-work-switch .dhp-wc-modes button{padding:7px 18px}.dhp-wc-history{display:flex;flex-direction:column;flex:0 0 44%;min-height:90px;max-height:44%;overflow:hidden;padding:8px 6px 0 0;margin-top:8px;border-top:.5px solid var(--dsw-alias-border-l2,#e9e9ea)}.dhp-wc-history[data-expanded=false]{min-height:42px;flex:0 0 42px}.dhp-wc-history-body{min-height:0;overflow:auto;overscroll-behavior:contain;scrollbar-gutter:stable;padding-bottom:14px}.dhp-wc-history-body[hidden]{display:none}.dhp-wc-history-toggle{display:flex;align-items:center;gap:5px;flex:1;align-self:stretch;text-align:left;border:0;background:transparent;border-radius:7px;padding:5px 0;color:inherit!important;font-size:inherit!important}.dhp-wc-history-toggle:hover{color:var(--dsw-alias-label-primary,#202123)!important}.dhp-wc-history-toggle svg{transition:transform .15s}.dhp-wc-history[data-expanded=false] .dhp-wc-history-toggle svg{transform:rotate(-90deg)}.dhp-wc-history-head{flex:none;position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;padding:0 6px 6px 8px;color:var(--dsw-alias-label-tertiary,#81858c);font-size:13px}.dhp-wc-history-head h2{font:inherit;font-weight:500;margin:0}.dhp-wc-history-head>div{display:flex;gap:2px}.dhp-wc-chat-row{display:flex;align-items:center;gap:9px;min-height:33px;width:100%;border:0;background:transparent;border-radius:9px;padding:7px 10px;text-align:left;font-size:13px!important}.dhp-wc-chat-row:hover,.dhp-wc-chat-row[aria-current=page]{background:var(--dsw-alias-interactive-bg-hover,#eee)}.dhp-wc-chat-row span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dhp-wc-history-empty{padding:4px 10px 8px;font-size:12px;color:var(--dsw-alias-label-tertiary,#81858c);line-height:1.6;margin:0}
.dhp-wc-chat-item{position:relative;display:flex;align-items:center;border-radius:9px}.dhp-wc-chat-item:hover,.dhp-wc-chat-item[data-current=true]{background:var(--dsw-alias-interactive-bg-hover,#eee)}.dhp-wc-chat-item .dhp-wc-chat-row{min-width:0;flex:1;padding-right:30px;background:transparent}.dhp-wc-chat-row svg{flex:none}.dhp-wc-row-more{position:absolute;right:4px;width:26px;height:26px;display:grid;place-items:center;border:0;background:transparent;border-radius:7px;font-size:18px!important;opacity:0}.dhp-wc-chat-item:hover .dhp-wc-row-more,.dhp-wc-row-more:focus-visible,.dhp-wc-chat-item[data-current=true] .dhp-wc-row-more{opacity:1}.dhp-wc-row-more:hover{background:var(--dsw-alias-interactive-bg-hover,#e6e6e7)}.dhp-wc-session-menu{position:fixed;z-index:1400;background:var(--dsw-alias-bg-base,#fff);border:1px solid var(--dsw-alias-border-l3,#ddd);border-radius:12px;padding:5px;box-shadow:0 10px 40px #0002;min-width:150px}.dhp-wc-session-menu button{display:block;width:100%;padding:9px 12px;border:0;background:transparent;border-radius:8px;text-align:left;font-size:13px}.dhp-wc-session-menu button:hover{background:var(--dsw-alias-interactive-bg-hover,#eee)}.dhp-wc-danger{color:var(--dsw-alias-state-error-primary,#ca515b)!important}.dhp-wc-dialog-mask{position:fixed;inset:0;z-index:1400;background:#0005;display:grid;place-items:center;padding:20px}.dhp-wc-rename{background:var(--dsw-alias-bg-base,#fff);border:1px solid var(--dsw-alias-border-l3,#ddd);border-radius:18px;padding:24px;width:380px;max-width:100%;box-shadow:0 18px 70px #0002}.dhp-wc-rename h2{font-size:18px;margin:0 0 18px;font-weight:500}.dhp-wc-rename input,.dhp-wc-search{font:inherit;background:transparent;border:1px solid var(--dsw-alias-border-l3,#ddd);border-radius:10px;padding:10px 12px;width:100%;color:inherit;outline:none}.dhp-wc-rename input:focus,.dhp-wc-search:focus{border-color:var(--dsw-alias-state-business-primary,#5178ef)}.dhp-wc-rename>div{display:flex;justify-content:flex-end;gap:8px;margin-top:20px}.dhp-wc-rename>p{font-size:12px;color:var(--dsw-alias-state-error-primary,#ca515b);line-height:1.6}.dhp-wc-search{font-size:12px;padding:7px 9px;margin:0 6px 8px;width:calc(100% - 12px)}
.dhp-wc-loading{display:flex;justify-content:center;align-items:center;gap:8px;height:100%;font-size:13px;color:var(--dsw-alias-label-secondary,#666)}.dhp-wc-loading:before{content:'';width:14px;height:14px;border:2px solid #8097d444;border-top-color:#6585ee;border-radius:50%;animation:dhp-wc-spin .8s linear infinite}@keyframes dhp-wc-spin{to{transform:rotate(360deg)}}[data-sidebar-collapsed=true] .dhp-wc-history{display:none}@media(prefers-reduced-motion:reduce){.dhp-wc *{animation:none!important;transition:none!important}}@media(max-width:850px){.dhp-wc-panel-header .dhp-wc-domain{display:none}.dhp-wc-panel-header{justify-content:flex-start;padding-left:14px}.dhp-wc-modes{width:220px}}`;

function useSource(source) {
  const bound = useMemo(() => bindExternalSource(source), [source]);
  return useSyncExternalStore(bound.subscribe, bound.getSnapshot);
}
export function ModeSwitch({ mode, controller, t }) {
  return <div className="dhp-wc-modes" role="tablist" aria-label={t('会话模式')} onKeyDown={event => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault(); if (mode === 'chat') controller.work(); else controller.open();
  }}><button role="tab" aria-selected={mode === 'chat'} onClick={() => controller.open()}>{t('聊天')}</button><button role="tab" aria-selected={mode === 'work'} onClick={() => controller.work()}>{t('工作')}</button></div>;
}
function ChatBubbleIcon() { return <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M4 3.5h12a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9L4 17v-2.5H3a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z" /></svg>; }
export function ChatHistory({ controller, active, t }) {
  const state = useSource(controller);
  const selected = chatSession(state.url)?.id;
  const [expanded,setExpanded]=useState(true), [searching,setSearching]=useState(false), [query,setQuery]=useState(''), [menu,setMenu]=useState(null), [rename,setRename]=useState(null), [draft,setDraft]=useState(''), [busy,setBusy]=useState(false), [error,setError]=useState('');
  const menuRef=useRef(null), inputRef=useRef(null);
  const rows=state.rows.filter(row=>row.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  useEffect(()=>{ if(!menu)return;const close=event=>{if(!menuRef.current?.contains(event.target)&&!menu.trigger?.contains(event.target))setMenu(null);};const key=event=>{if(event.key==='Escape'){setMenu(null);menu.trigger?.focus();}};document.addEventListener('pointerdown',close);document.addEventListener('keydown',key);return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',key);}; },[menu]);
  useEffect(()=>{if(!active)setMenu(null);},[active]);
  useEffect(()=>{if(rename){inputRef.current?.focus();inputRef.current?.select();}},[rename]);
  const manage=async(row,action,title)=>{setError('');if(!controller.manageRow)throw new Error(t('请先打开聊天网页后重试。'));return controller.manageRow(row,action,title);};
  const save=async event=>{event.preventDefault();if(busy||!draft.trim())return;setBusy(true);try{await manage(rename,'rename',draft);setRename(null);}catch(reason){setError(reason.message);}finally{setBusy(false);}};
  return <section className="dhp-wc dhp-wc-history" data-expanded={expanded} aria-label={t('网页聊天会话')}>
    <header className="dhp-wc-history-head"><button className="dhp-wc-history-toggle" aria-expanded={expanded} aria-label={t('聊天')} onClick={()=>{setExpanded(value=>!value);setMenu(null);}}><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg><h2>{t('聊天')}</h2></button><div><button className="dhp-wc-icon" title={t('搜索聊天标题')} aria-label={t('搜索聊天标题')} aria-expanded={searching} onClick={()=>{setExpanded(true);setSearching(value=>!value);setQuery('');}}><svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4 4"/></svg></button><button className="dhp-wc-icon" title={t('同步网页会话')} aria-label={t('同步网页会话')} onClick={() => controller.scan ? controller.scan() : controller.open(DEEPSEEK_HOME)}>↻</button><button className="dhp-wc-icon" title={t('新聊天')} aria-label={t('新聊天')} onClick={() => controller.open(DEEPSEEK_HOME)}>＋</button></div></header>
    <div className="dhp-wc-history-body" hidden={!expanded}>
    {searching&&<input className="dhp-wc-search" aria-label={t('搜索聊天标题')} placeholder={t('搜索聊天标题')} value={query} onChange={event=>setQuery(event.target.value)} autoFocus />}
    {error&&!rename&&<p className="dhp-wc-history-empty" role="alert">{t(error)}</p>}
    {rows.map(row => <div className="dhp-wc-chat-item" data-current={active&&selected===row.id} key={row.id}><button className="dhp-wc-chat-row" aria-current={active && selected === row.id ? 'page' : undefined} onClick={() => controller.open(row.url)} title={row.title}><ChatBubbleIcon/><span>{row.title}</span></button><button className="dhp-wc-row-more" aria-label={t('管理会话：{title}',{title:row.title})} aria-haspopup="menu" aria-expanded={menu?.row.id===row.id} onClick={event=>{const rect=event.currentTarget.getBoundingClientRect();const trigger=event.currentTarget;setMenu(current=>current?.row.id===row.id?null:{row,x:rect.left,y:rect.bottom,trigger});}}>…</button></div>)}
    {searching&&query&&!rows.length&&<p className="dhp-wc-history-empty">{t('没有匹配的聊天标题。')}</p>}
    {!state.rows.length && <><button className="dhp-wc-chat-row" onClick={() => controller.open(DEEPSEEK_HOME)}><span aria-hidden="true">＋</span><span>{t('在 DeepSeek 开始聊天')}</span></button><p className="dhp-wc-history-empty">{state.status === 'sign-in' ? t('登录官网后，会话显示在这里。') : state.opened ? t('同步网页侧栏中的聊天会话。') : t('与工作区分开，连接 DeepSeek 官方网页。')}</p></>}
    </div>
    {menu&&createPortal(<div className="dhp-wc dhp-wc-session-menu" role="menu" aria-label={t('会话操作')} ref={menuRef} style={{left:Math.max(8,Math.min(menu.x,window.innerWidth-180)),top:Math.min(menu.y+4,window.innerHeight-110)}}><button role="menuitem" onClick={()=>{setRename(menu.row);setDraft(menu.row.title);setError('');setMenu(null);}}>{t('重命名')}</button><button role="menuitem" className="dhp-wc-danger" onClick={async()=>{const row=menu.row;setMenu(null);try{await manage(row,'delete');}catch(reason){setError(reason.message);}}}>{t('删除')}</button></div>,document.body)}
    {rename&&createPortal(<div className="dhp-wc dhp-wc-dialog-mask" onKeyDown={event=>{if(event.key==='Escape'&&!busy)setRename(null);}}><form className="dhp-wc-rename" role="dialog" aria-modal="true" aria-label={t('重命名聊天')} onSubmit={save}><h2>{t('重命名聊天')}</h2><input ref={inputRef} aria-label={t('会话名称')} value={draft} onChange={event=>setDraft(event.target.value)} maxLength={160} disabled={busy}/>{error&&<p role="alert">{t(error)}</p>}<div><button type="button" className="dhp-wc-action" disabled={busy} onClick={()=>setRename(null)}>{t('取消')}</button><button className="dhp-wc-action" disabled={busy||!draft.trim()}>{busy?t('正在保存…'):t('保存')}</button></div></form></div>,document.body)}
  </section>;
}
function ChatPanel({ controller, language, onViewport }) {
  const state = useSource(controller);
  useEffect(() => { if (!state.opened) controller.open(); }, [state.opened, controller]);
  const t = createTranslator(language);
  return <section className="dhp-wc dhp-wc-panel" aria-label={t('DeepSeek 聊天模式')}>
    <header className="dhp-wc-panel-header"><span className="dhp-wc-domain">chat.deepseek.com</span><ModeSwitch mode="chat" controller={controller} t={t} /><div className="dhp-wc-tools"><button className="dhp-wc-icon" aria-label={t('新聊天')} title={t('新聊天')} onClick={() => controller.open(DEEPSEEK_HOME)}>＋</button><button className="dhp-wc-icon" aria-label={t('刷新网页')} title={t('刷新网页')} onClick={() => controller.reload?.()}>↻</button></div></header>
    <div className="dhp-wc-viewport" ref={onViewport}><div className="dhp-wc-loading" aria-hidden="true">{state.status === 'loading' ? t('正在打开 DeepSeek 官方网页…') : ''}</div></div>
  </section>;
}
function WorkChatExtension({ ctx, controller, viewport, useLanguage, activePanel }) {
  const state = useSource(controller);
  const panelInfo = useSource(activePanel);
  const sessions = useSource(ctx.sessions.list);
  const [language, setLanguage] = useState('zh-CN');
  const t = createTranslator(language);
  const [sidebar, setSidebar] = useState(null), [workRect, setWorkRect] = useState(null);
  const host = useRef(null), guest = useRef(null), browserFrame = useRef(null);
  const active = panelInfo.activePanelId === CHAT_PANEL;
  const current = Object.values(sessions.byId || {}).find(row => (row.retainedBy?.mainView || 0) > 0);
  const workActive = panelInfo.activePanelId === null;
  const workBlank = !current || current.blank === true;
  useEffect(() => {
    const languageChanged = event => { if (['zh-CN','en'].includes(event.detail)) { setLanguage(event.detail); useLanguage(event.detail); } };
    const initial = document.querySelector('[data-dsh-hide-pet]')?.lang;
    if (initial) { setLanguage(initial); useLanguage(initial); }
    window.addEventListener('dhp-language', languageChanged);
    return () => window.removeEventListener('dhp-language', languageChanged);
  }, [useLanguage]);
  useEffect(() => {
    const find = () => setSidebar(current => { const next = document.querySelector('[data-slot="sidebar.workspaces"]'); return current === next ? current : next; });
    const observer = new MutationObserver(find); observer.observe(document.body, { childList:true, subtree:true }); find(); return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    let frame;
    const observed = new Set();
    const measure = () => {
      const chat = viewport.current?.isConnected ? viewport.current.getBoundingClientRect() : null;
      const root = document.querySelector('[data-slot="main.conversation"]')?.firstElementChild;
      const work = root?.getBoundingClientRect();
      const node = browserFrame.current;
      if (node) {
        if (chat && chat.width > 0 && chat.height > 0) Object.assign(node.style, { left:`${chat.x}px`, top:`${chat.y}px`, width:`${chat.width}px`, height:`${chat.height}px` });
        node.hidden = !active || !chat || chat.width <= 0 || chat.height <= 0;
      }
      const next = work && work.width > 0 && work.height > 0 ? { x:work.x,y:work.y,width:work.width,height:work.height } : null;
      setWorkRect(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
      for (const element of [viewport.current, root]) if (element && !observed.has(element)) { observed.add(element); observer.observe(element); }
    };
    const observer = new ResizeObserver(measure);
    // Follow the host's sidebar animation before each paint, not a delayed poll.
    let until = 0;
    const follow = () => { measure(); if (performance.now() < until) frame=requestAnimationFrame(follow); };
    const changed = () => { cancelAnimationFrame(frame); until=performance.now()+400; follow(); };
    viewport.onChange = changed;
    const mutations = new MutationObserver(changed);
    const layout = document.querySelector('[data-shell-overlay]')?.parentElement;
    mutations.observe(layout || document.body, { attributes:true, attributeFilter:['data-sidebar-collapsed','data-animating','style'] });
    changed(); window.addEventListener('resize', changed); document.addEventListener('transitionrun', changed);
    return () => { viewport.onChange=null; cancelAnimationFrame(frame); observer.disconnect(); mutations.disconnect(); window.removeEventListener('resize', changed); document.removeEventListener('transitionrun', changed); };
  }, [viewport, active, state.opened]);
  useEffect(() => {
    if (!state.opened || !host.current) return;
    const browser = createDeepSeekGuest({ bridge: window.dshDesktop?.browser, host:host.current, report:controller.report, observe:controller.observe });
    guest.current = browser; controller.scan = () => browser.scan(); controller.reload = () => browser.reload(); controller.manageRow = async (row,action,title) => { ctx.layout.selectPanel(CHAT_PANEL); return browser.manage(row,action,title); }; browser.start();
    return () => { guest.current = null; delete controller.scan; delete controller.reload; delete controller.manageRow; browser.dispose(); };
  }, [state.opened, controller]);
  useEffect(() => { if (state.request) guest.current?.navigate(state.request.url); }, [state.request]);
  useEffect(() => { if (!active) return; const timer = setInterval(() => guest.current?.scan(), 3000); return () => clearInterval(timer); }, [active]);
  useEffect(() => {
    if (!active) return;
    const intercept = event => {
      const button = event.target.closest?.('[data-slot="sidebar"] button');
      if (!button) return;
      const label = button.getAttribute('aria-label') || button.textContent || '';
      if (!/^(新建会话|新会话|New session|New Session)$/.test(label.trim())) return;
      event.preventDefault(); event.stopPropagation(); controller.open(DEEPSEEK_HOME);
    };
    document.addEventListener('click', intercept, true); return () => document.removeEventListener('click', intercept, true);
  }, [active, controller]);
  return <>
    <style>{workChatCss}</style>
    {sidebar && createPortal(<ChatHistory controller={controller} active={active} t={t} />, sidebar)}
    {workActive && workRect && <div className="dhp-wc dhp-wc-work-switch" style={{left:workRect.x+workRect.width/2,top:workRect.y+(workBlank ? 12 : 4)}}><ModeSwitch mode="work" controller={controller} t={t} /></div>}
    {state.opened && <section className="dhp-wc dhp-wc-browser" ref={browserFrame} aria-label={t('DeepSeek 官方网页')}>
      {state.status === 'sign-in' && <div className="dhp-wc-notice">{t('请在官网使用与 Harness 相同的账号登录。')}</div>}
      {state.error && state.status !== 'error' && <div className="dhp-wc-notice">{t(state.error)}</div>}
      <div className="dhp-wc-webhost" ref={host} />
      {state.status === 'error' && <div className="dhp-wc-failure" role="alert"><h2>{t('暂时无法打开聊天网页')}</h2><p>{t(state.error)}</p><button className="dhp-wc-action" onClick={() => controller.reload?.()}>{t('重试')}</button><button className="dhp-wc-action" onClick={() => controller.work()}>{t('返回工作')}</button></div>}
    </section>}
  </>;
}
export function applyWorkChat(ctx) {
  if (!ctx.layout?.panelInfo || !ctx.sessions?.list) return;
  const controller = createWorkChatController(ctx.layout);
  const viewport = { current:null, onChange:null };
  const onViewport = element => { viewport.current=element; viewport.onChange?.(); };
  let language = 'zh-CN';
  const languageListeners = new Set();
  const languageStore = { getSnapshot:()=>language, subscribe:listener=>{languageListeners.add(listener);return()=>languageListeners.delete(listener);} };
  const setLanguage = value => { if (value !== language) { language=value; for (const listener of languageListeners) listener(); } };
  ctx.slots.inject('main', () => ctx.slots.register({ name:'main', key:CHAT_PANEL }, () => {
    const currentLanguage = useSource(languageStore);
    return <ChatPanel controller={controller} language={currentLanguage} onViewport={onViewport} />;
  }));
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name:'shell.overlay',id:'dsh-deepseek-chat',order:40 }, () => <WorkChatExtension ctx={ctx} controller={controller} viewport={viewport} useLanguage={setLanguage} activePanel={ctx.layout.panelInfo} />));
}
