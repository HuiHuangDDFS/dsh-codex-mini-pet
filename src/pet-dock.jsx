import React, { useEffect, useRef, useState } from 'react';
import { createHarnessActions, requiresNativeComposer } from './harness-actions.mjs';
import { sidePanelPosition } from './companion-behavior.mjs';

export const dockCss = `
.dhp-dock{position:absolute;pointer-events:auto;display:flex;gap:5px;padding:5px;border:1px solid var(--hp-border);border-radius:14px;background:var(--hp-bg);box-shadow:0 5px 24px #101e3d16}
.dhp-dock>button{border:0;background:transparent;border-radius:9px;padding:6px 9px;font-size:11px;white-space:nowrap}.dhp-dock>button:hover{background:var(--hp-soft)}
.dhp-tray{position:absolute;bottom:calc(100% + 9px);right:0;width:330px;max-width:calc(100vw - 24px);max-height:min(560px,75vh);overflow:auto;border:1px solid var(--hp-border);border-radius:16px;background:var(--hp-bg);padding:16px;box-shadow:0 15px 55px #15255026}
.dhp-tray h3{font-size:14px;margin:0}.dhp-tray-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}.dhp-tray-head button{border:0;background:transparent;padding:3px 7px;border-radius:6px}
.dhp-tray textarea,.dhp-tray select{width:100%;border:1px solid var(--hp-border);border-radius:9px;padding:8px;background:var(--hp-bg);color:var(--hp-text);font:inherit;margin-bottom:9px}.dhp-tray textarea{min-height:105px;resize:vertical}.dhp-tray label{font-size:11px;color:var(--hp-muted)}
.dhp-activity{border-top:1px solid var(--hp-border);padding:12px 0}.dhp-activity strong{display:block;font-size:12px;overflow-wrap:anywhere}.dhp-activity p{font-size:11px;color:var(--hp-muted);margin:3px 0 9px}.dhp-muted-note{font-size:11px;color:var(--hp-muted);margin:10px 0}
.dhp-dock{gap:0;padding:0;border-radius:20px;box-shadow:0 8px 24px #152d5014;align-items:stretch}
.dhp-dock>button{display:flex;align-items:center;justify-content:center;gap:7px;min-height:36px;padding:8px 13px;border-radius:0;transition:background .16s,color .16s}
.dhp-dock>button:first-of-type{border-radius:19px 0 0 19px}.dhp-dock>button:last-of-type{border-radius:0 19px 19px 0}.dhp-dock>button+button{border-left:1px solid var(--hp-border)}
.dhp-dock>button[aria-expanded=true]{background:var(--hp-soft);color:#608ed8}
.dhp-dock svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.5;flex:none}.dhp-count{font-size:10px;min-width:17px;border-radius:8px;padding:0 4px;background:var(--hp-soft);font-weight:650}
.dhp-tray{width:350px;border-radius:20px;padding:19px;box-shadow:0 15px 55px #15255026;transform-origin:bottom right;animation:dhp-tray-in .2s ease-out}
.dhp-tray h3{font-size:17px;letter-spacing:-.03em}.dhp-tray-head{margin-bottom:16px;align-items:flex-start}.dhp-tray-head p{font-size:11px;color:var(--hp-muted);margin:4px 0 0}
.dhp-tray label{display:block;margin-bottom:7px;font-size:10px}.dhp-tray select{margin-top:5px;font-size:12px;cursor:pointer;border-radius:10px;padding:8px 10px}
.dhp-tray textarea{min-height:112px;border-radius:13px;background:var(--hp-soft);padding:12px;transition:border-color .16s,box-shadow .16s;resize:vertical}.dhp-tray textarea:focus{outline:0;border-color:#6c96df;box-shadow:0 0 0 3px #6c96df18}
.dhp-compose-actions{justify-content:flex-end;align-items:center;margin-top:11px}.dhp-compose-actions .primary{border-radius:12px;padding:8px 17px}
.dhp-shortcut{font-size:10px;color:var(--hp-muted);margin:0}.dhp-activity{position:relative;border:1px solid var(--hp-border);border-radius:13px;padding:13px 12px 12px 24px;margin-top:9px;transition:background .16s,transform .16s}
.dhp-activity:hover{background:var(--hp-soft);transform:translateY(-1px)}.dhp-activity:before{content:'';position:absolute;left:10px;top:19px;width:6px;height:6px;border-radius:50%;background:#658fd4}
.dhp-activity[data-state=needs-input]:before{background:#cf9a42}.dhp-activity[data-state=blocked]:before{background:#d66b7b}.dhp-activity[data-state=ready]:before{background:#62ad90}
.dhp-activity .dhp-actions{gap:5px}.dhp-activity .dhp-button{padding:5px 8px;font-size:10px!important;border-radius:7px}.dhp-activity .dhp-actions .primary{background:transparent;color:var(--hp-text);border-color:var(--hp-border);font-weight:600}
.dhp-dock-empty{text-align:center;padding:24px 4px}.dhp-dock-empty span{display:inline-grid;place-items:center;width:38px;height:38px;background:var(--hp-soft);border-radius:50%;color:#70a997;font-size:20px}.dhp-dock-empty strong{display:block;font-size:14px;margin:10px 0 5px}
@keyframes dhp-tray-in{from{opacity:0;transform:translateY(7px) scale(.98)}to{opacity:1;transform:none}}@media(prefers-reduced-motion:reduce){.dhp-dock *{animation:none!important;transition:none!important;transform:none!important}}
.dhp-dock[data-reduced=true] *{animation:none!important;transition:none!important;transform:none!important}
.dhp-dock{transition:opacity .18s ease,transform .18s ease}.dhp-dock[data-shown=false]{opacity:0;transform:translateY(6px);pointer-events:none}.dhp-dock[data-reduced=true]{transition:none;transform:none}@media(prefers-reduced-motion:reduce){.dhp-dock,.dhp-completion{transition:none;animation:none;transform:none}}
.dhp-choice{position:relative;margin:5px 0 10px}.dhp-choice-trigger{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;border:1px solid var(--hp-border);background:var(--hp-soft);border-radius:10px;color:var(--hp-text);padding:10px 12px;text-align:left;font:inherit;font-size:12px}.dhp-choice-trigger span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dhp-choice-trigger:hover,.dhp-choice-trigger[aria-expanded=true]{border-color:#719cd8}
.dhp-choice-list{position:absolute;z-index:5;left:0;right:0;top:calc(100% + 5px);max-height:220px;overflow:auto;padding:5px;background:var(--hp-bg);border:1px solid var(--hp-border);border-radius:12px;box-shadow:0 12px 30px #172b5426}.dhp-choice-option{position:relative;width:100%;display:block;background:transparent;border:0;border-radius:8px;padding:9px 28px 9px 10px;color:var(--hp-text);text-align:left;font:inherit;font-size:12px}.dhp-choice-option:hover,.dhp-choice-option[aria-selected=true]{background:var(--hp-soft)}.dhp-choice-option span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dhp-choice-option small{display:block;font-size:10px;color:var(--hp-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:3px}.dhp-choice-option[aria-selected=true]:after{content:'✓';position:absolute;right:10px;top:10px;color:#719cd8}
.dhp-completion{position:absolute;width:250px;pointer-events:auto;background:var(--hp-bg);border:1px solid var(--hp-border);border-radius:15px;padding:14px;box-shadow:0 10px 30px #15255022;animation:dhp-tray-in .18s ease-out}.dhp-completion:after{content:'';position:absolute;bottom:-7px;width:12px;height:12px;background:var(--hp-bg);border-right:1px solid var(--hp-border);border-bottom:1px solid var(--hp-border);transform:rotate(45deg)}.dhp-completion[data-side=right]:after{left:18px}.dhp-completion[data-side=left]:after{right:18px}.dhp-completion>button:first-child{float:right;border:0;background:transparent;color:var(--hp-muted);padding:0 3px}.dhp-completion strong{font-size:13px}.dhp-completion-open{display:grid;gap:7px;text-align:left;background:transparent;border:0;color:var(--hp-text);padding:8px 0 0;width:100%;font:inherit}.dhp-completion-open span{max-height:40px;overflow:hidden;font-size:12px}.dhp-completion-open small{font-size:10px;color:var(--hp-muted)}.dhp-completion[data-reduced=true]{animation:none}
`;

function Choice({ label, value, options, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const host = useRef(null), trigger = useRef(null), list = useRef(null);
  const selected = options.find(item => item.value === value);
  useEffect(() => {
    if (!open) return;
    const outside = event => { if (!host.current?.contains(event.target)) setOpen(false); };
    window.addEventListener('pointerdown', outside);
    const items = list.current?.querySelectorAll('[role=option]');
    items?.[Math.max(0, options.findIndex(item => item.value === value))]?.focus();
    return () => window.removeEventListener('pointerdown', outside);
  }, [open]);
  return <div className="dhp-choice" ref={host}><button ref={trigger} className="dhp-choice-trigger" type="button" aria-label={label} aria-haspopup="listbox" aria-expanded={open && !disabled} disabled={disabled} onClick={() => setOpen(!open)} onKeyDown={event => { if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); setOpen(true); } }}><span>{selected?.label || '请选择'}</span><span aria-hidden="true">⌄</span></button>
    {open && !disabled && <div ref={list} className="dhp-choice-list" role="listbox" aria-label={label} onKeyDown={event => {
      const items = [...list.current.querySelectorAll('[role=option]')], index = items.indexOf(document.activeElement);
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) { event.preventDefault(); items[event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus(); }
      if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); trigger.current?.focus(); }
      if (event.key === 'Tab') setOpen(false);
    }}>{options.map(item => <button key={item.value} role="option" aria-selected={item.value === value} className="dhp-choice-option" title={item.detail || item.label} onClick={() => { onChange(item.value); setOpen(false); trigger.current?.focus(); }}><span>{item.label}</span>{item.detail && <small>{item.detail}</small>}</button>)}</div>}
  </div>;
}

function DockIcon({ activity = false }) {
  return <svg viewBox="0 0 20 20" aria-hidden="true">{activity ? <><path d="M3 5h2m3 0h9M3 10h2m3 0h9M3 15h2m3 0h9" /></> : <path d="M5 3.5h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9L4 17v-3a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2Z" />}</svg>;
}

export function PetDock({ ctx, rows, position, petBounds, mini, focusRequest, onPreferences, reducedMotion = false }) {
  const actions = React.useMemo(() => createHarnessActions(ctx), [ctx]);
  const [page, setPage] = useState(null);
  const [text, setText] = useState('');
  const [target, setTarget] = useState('new');
  const [workspaceId, setWorkspaceId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [near, setNear] = useState(false);
  const [dismissed, setDismissed] = useState(new Map());
  const [muted, setMuted] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('dsh-hide-pet:muted') || '[]')); } catch { return new Set(); }
  });
  const input = useRef(null), root = useRef(null), previous = useRef(new Map());
  const context = actions.getContext();
  const keyFor = row => `${row.state}:${row.activityVersion}:${JSON.stringify(row.pendingInteraction)}:${JSON.stringify(row.error)}`;
  const visible = rows.filter(row => !muted.has(row.id) && dismissed.get(row.id) !== keyFor(row));
  const hidden = rows.length - visible.length;
  const dockLeft = Math.max(8, Math.min(position.x, window.innerWidth - 220));
  const dockTop = Math.max(8, Math.min(position.y, window.innerHeight - 48));
  const body = petBounds || { x: dockLeft, y: dockTop, width: 192, height: 40 };
  const placement = sidePanelPosition(body, { width: window.innerWidth, height: window.innerHeight });
  const selectedWorkspace = workspaceId || context.currentWorkspaceId || '';
  const availableSessions = context.sessions.filter(item => item.workspaceId === selectedWorkspace);
  const shown = mini || near || Boolean(page);

  useEffect(() => {
    let hiding;
    const observe = event => {
      const inside = event.clientX >= Math.min(body.x, dockLeft) - 42 && event.clientX <= Math.max(body.x + body.width, dockLeft + 220) + 42 && event.clientY >= body.y - 42 && event.clientY <= dockTop + 82;
      if (inside) { clearTimeout(hiding); hiding = null; setNear(true); }
      else if (!hiding) hiding = setTimeout(() => { hiding = null; setNear(false); }, 550);
    };
    window.addEventListener('pointermove', observe);
    return () => { window.removeEventListener('pointermove', observe); clearTimeout(hiding); };
  }, [body.x, body.y, body.width, dockLeft, dockTop]);
  useEffect(() => { if (target !== 'new' && !availableSessions.some(item => item.sessionId === target)) setTarget('new'); }, [target, selectedWorkspace, context.sessions.map(item => item.sessionId + item.workspaceId).join('|')]);
  useEffect(() => { if (workspaceId && !context.workspaces.some(item => item.workspaceId === workspaceId)) setWorkspaceId(''); }, [workspaceId, context.workspaces.map(item => item.workspaceId).join('|')]);

  useEffect(() => {
    // A new observed task state starts a new notification occurrence.
    const next = new Map(rows.map(row => [row.id, keyFor(row)]));
    const reset = [...dismissed.keys()].filter(id => previous.current.get(id) !== next.get(id));
    setDismissed(current => {
      const copy = new Map(current); let changed = false;
      for (const id of reset) { copy.delete(id); changed = true; }
      return changed ? copy : current;
    });
    previous.current = next;
  }, [rows]);
  useEffect(() => { if (focusRequest) setPage('chat'); }, [focusRequest]);
  useEffect(() => {
    if (page === 'chat') input.current?.focus();
    if (!page) return;
    const outside = event => { if (!root.current?.contains(event.target) && !event.target.closest?.('.dhp-pet')) setPage(null); };
    const escape = event => { if (event.key === 'Escape') { event.stopPropagation(); setPage(null); } };
    window.addEventListener('pointerdown', outside);
    root.current?.addEventListener('keydown', escape);
    const element = root.current;
    return () => { window.removeEventListener('pointerdown', outside); element?.removeEventListener('keydown', escape); };
  }, [page]);

  const run = async operation => {
    if (busy) return;
    setBusy(true); setError('');
    try { await operation(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const chatArgs = () => ({ text, ...(target === 'new' ? { workspaceId: workspaceId || context.currentWorkspaceId || undefined } : { sessionId: target }) });
  const submit = () => run(async () => {
    const result = await actions.sendMessage(chatArgs());
    setText(''); setTarget(result.sessionId); setPage(null);
  });
  const composer = () => run(async () => { await actions.openMainComposer(chatArgs()); setText(''); setPage(null); });
  const reply = id => { const session = context.sessions.find(item => item.sessionId === id); if (session?.workspaceId) setWorkspaceId(session.workspaceId); setTarget(id); setPage('chat'); setError(''); };
  const mute = id => setMuted(current => {
    const next = new Set(current); next.add(id);
    try { localStorage.setItem('dsh-hide-pet:muted', JSON.stringify([...next])); } catch {}
    return next;
  });
  return <div className="dhp-dock" data-reduced={reducedMotion} data-shown={shown} onFocusCapture={() => setNear(true)} ref={root} style={{ left: dockLeft, top: dockTop }}>
    <button aria-label="快速聊天" aria-expanded={page === 'chat'} onClick={() => { setPage(current => current === 'chat' ? null : 'chat'); setError(''); }}><DockIcon />聊一聊</button>
    <button aria-label={`任务动态 ${visible.length} 条`} aria-expanded={page === 'activity'} onClick={() => { setPage(current => current === 'activity' ? null : 'activity'); setError(''); }}><DockIcon activity />动态{visible.length > 0 && <span className="dhp-count">{visible.length}</span>}</button>
    {mini && <button aria-label="显示宠物形象" onClick={() => onPreferences({ mode: 'pet' })}>✦</button>}
    {page && <section className="dhp-tray" style={{ left: placement.x - dockLeft, top: placement.y - dockTop, right: 'auto', bottom: 'auto', width: placement.width, maxHeight: placement.maxHeight }} aria-label={page === 'chat' ? '伙伴快速聊天' : '任务动态'}>
      <div className="dhp-tray-head"><div><h3>{page === 'chat' ? '聊一聊' : '任务动态'}</h3><p>{page === 'chat' ? '有个想法？随时告诉我。' : visible.length ? `${visible.length} 项进展，陪你一起留意。` : '安心做你的事，新进展会出现在这里。'}</p></div><button aria-label="关闭伙伴操作" onClick={() => setPage(null)}>×</button></div>
      {error && <div className="dhp-message" data-error="true" role="alert">{error}</div>}
      {page === 'chat' ? <>
        <label>工作区</label><Choice label="快速聊天工作区" value={selectedWorkspace} disabled={busy} onChange={value => { setWorkspaceId(value); setTarget('new'); }} options={[{ value: '', label: context.workspacesReady ? '请选择工作区' : '正在读取工作区…' }, ...context.workspaces.map(item => ({ value: item.workspaceId, label: item.title, detail: item.path }))]} />
        <label>会话</label><Choice label="发送到" value={target} disabled={busy || !selectedWorkspace} onChange={setTarget} options={[{ value: 'new', label: '+ 新会话' }, ...availableSessions.map(item => ({ value: item.sessionId, label: item.title }))]} />
        <textarea ref={input} aria-label="快速聊天内容" placeholder="此刻，你想一起做点什么？" value={text} disabled={busy} onChange={event => setText(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (text.trim() && !requiresNativeComposer(text)) submit(); } }} />
        <p className="dhp-shortcut">{requiresNativeComposer(text) ? '这条想法包含上下文，请转到主会话继续编辑。' : 'Enter 发送 · Shift+Enter 换行'}</p>
        <div className="dhp-actions dhp-compose-actions"><button className="dhp-button" disabled={busy || !context.capabilities.composer} onClick={composer}>在主会话编辑</button><button className="dhp-button primary" disabled={busy || !text.trim() || requiresNativeComposer(text) || !context.capabilities.sendMessage} onClick={submit}>{busy ? '处理中…' : '发送 ↗'}</button></div>
        <p className="dhp-muted-note">文件、@ 上下文、技能和语音输入可在主会话中添加。草稿转入后由你发送。</p>
      </> : <>
        {!visible.length && <div className="dhp-dock-empty"><span aria-hidden="true">✓</span><strong>{hidden ? '提醒已收起' : '都安排好了'}</strong><p className="dhp-muted-note">{hidden ? '需要时可以恢复查看。' : '暂时没有需要关注的任务。'}</p></div>}
        {visible.map(row => <article className="dhp-activity" data-state={row.state} key={row.id}><strong>{row.title}</strong><p>{row.label}</p>{row.state === 'blocked' && row.error && <p>{String(row.error.message || row.error).slice(0, 240)}</p>}<div className="dhp-actions">
          <button className="dhp-button primary" disabled={busy} onClick={() => run(async () => { await actions.openSession(row.id); setPage(null); })}>{row.pendingInteraction ? '前往处理' : '打开'}</button>
          <button className="dhp-button" onClick={() => reply(row.id)}>回复</button>
          {row.running && <button className="dhp-button" disabled={busy} onClick={() => run(() => actions.stopSession(row.id))}>停止</button>}
          <button className="dhp-button" onClick={() => setDismissed(current => new Map(current).set(row.id, keyFor(row)))}>收起</button><button className="dhp-button" onClick={() => mute(row.id)}>静音</button>
        </div></article>)}
        {(hidden > 0 || muted.size > 0 || dismissed.size > 0) && <button className="dhp-button" onClick={() => { setDismissed(new Map()); setMuted(new Set()); try { localStorage.removeItem('dsh-hide-pet:muted'); } catch {} }}>恢复提醒{hidden ? `（已隐藏 ${hidden} 条）` : ''}</button>}
      </>}
    </section>}
  </div>;
}
