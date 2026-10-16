import React, { useEffect, useRef, useState } from 'react';
import { createHarnessActions, requiresNativeComposer } from './harness-actions.mjs';

export const dockCss = `
.dhp-dock{position:absolute;pointer-events:auto;display:flex;gap:5px;padding:5px;border:1px solid var(--hp-border);border-radius:14px;background:var(--hp-bg);box-shadow:0 5px 24px #101e3d16}
.dhp-dock>button{border:0;background:transparent;border-radius:9px;padding:6px 9px;font-size:11px;white-space:nowrap}.dhp-dock>button:hover{background:var(--hp-soft)}
.dhp-tray{position:absolute;bottom:calc(100% + 9px);right:0;width:330px;max-width:calc(100vw - 24px);max-height:min(560px,75vh);overflow:auto;border:1px solid var(--hp-border);border-radius:16px;background:var(--hp-bg);padding:16px;box-shadow:0 15px 55px #15255026}
.dhp-tray h3{font-size:14px;margin:0}.dhp-tray-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}.dhp-tray-head button{border:0;background:transparent;padding:3px 7px;border-radius:6px}
.dhp-tray textarea,.dhp-tray select{width:100%;border:1px solid var(--hp-border);border-radius:9px;padding:8px;background:var(--hp-bg);color:var(--hp-text);font:inherit;margin-bottom:9px}.dhp-tray textarea{min-height:105px;resize:vertical}.dhp-tray label{font-size:11px;color:var(--hp-muted)}
.dhp-activity{border-top:1px solid var(--hp-border);padding:12px 0}.dhp-activity strong{display:block;font-size:12px;overflow-wrap:anywhere}.dhp-activity p{font-size:11px;color:var(--hp-muted);margin:3px 0 9px}.dhp-muted-note{font-size:11px;color:var(--hp-muted);margin:10px 0}
`;

export function PetDock({ ctx, rows, position, mini, focusRequest, onPreferences }) {
  const actions = React.useMemo(() => createHarnessActions(ctx), [ctx]);
  const [page, setPage] = useState(null);
  const [text, setText] = useState('');
  const [target, setTarget] = useState('new');
  const [workspaceId, setWorkspaceId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(new Map());
  const [muted, setMuted] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('dsh-hide-pet:muted') || '[]')); } catch { return new Set(); }
  });
  const input = useRef(null), root = useRef(null), previous = useRef(new Map());
  const context = actions.getContext();
  const keyFor = row => `${row.state}:${row.activityVersion}:${JSON.stringify(row.pendingInteraction)}:${JSON.stringify(row.error)}`;
  const visible = rows.filter(row => !muted.has(row.id) && dismissed.get(row.id) !== keyFor(row));
  const hidden = rows.length - visible.length;

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
    const outside = event => { if (!root.current?.contains(event.target)) setPage(null); };
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
  const reply = id => { setTarget(id); setPage('chat'); setError(''); };
  const mute = id => setMuted(current => {
    const next = new Set(current); next.add(id);
    try { localStorage.setItem('dsh-hide-pet:muted', JSON.stringify([...next])); } catch {}
    return next;
  });
  return <div className="dhp-dock" ref={root} style={{ left: Math.max(8, Math.min(position.x, window.innerWidth - 200)), top: Math.max(8, Math.min(position.y, window.innerHeight - 48)) }}>
    <button aria-label="快速聊天" aria-expanded={page === 'chat'} onClick={() => { setPage(page === 'chat' ? null : 'chat'); setError(''); }}>聊一聊</button>
    <button aria-label={`任务动态 ${visible.length} 条`} aria-expanded={page === 'activity'} onClick={() => { setPage(page === 'activity' ? null : 'activity'); setError(''); }}>动态{rows.length ? ` ${visible.length}` : ''}</button>
    {mini && <button aria-label="显示宠物形象" onClick={() => onPreferences({ mode: 'pet' })}>✦</button>}
    {page && <section className="dhp-tray" aria-label={page === 'chat' ? '伙伴快速聊天' : '任务动态'}>
      <div className="dhp-tray-head"><h3>{page === 'chat' ? '聊一聊' : '任务动态'}</h3><button aria-label="关闭伙伴操作" onClick={() => setPage(null)}>×</button></div>
      {error && <div className="dhp-message" data-error="true" role="alert">{error}</div>}
      {page === 'chat' ? <>
        <label>发送到<select aria-label="发送到" value={target} onChange={event => setTarget(event.target.value)}><option value="new">新会话</option>{Object.values(ctx.sessions?.list?.getSnapshot?.()?.byId || {}).map(row => <option key={row.id} value={row.id}>{row.displayTitle || row.title || row.id}</option>)}</select></label>
        {target === 'new' && <label>工作区<select aria-label="快速聊天工作区" value={workspaceId || context.currentWorkspaceId || ''} onChange={event => setWorkspaceId(event.target.value)}><option value="">请选择工作区</option>{context.workspaces.map(item => <option key={item.workspaceId} value={item.workspaceId}>{item.path}</option>)}</select></label>}
        <textarea ref={input} aria-label="快速聊天内容" placeholder="输入想法，Shift+Enter 换行" value={text} onChange={event => setText(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (text.trim() && !requiresNativeComposer(text)) submit(); } }} />
        <div className="dhp-actions"><button className="dhp-button primary" disabled={busy || !text.trim() || requiresNativeComposer(text) || !context.capabilities.sendMessage} onClick={submit}>发送</button><button className="dhp-button" disabled={busy || !context.capabilities.composer} onClick={composer}>在主会话编辑</button></div>
        <p className="dhp-muted-note">文件、@ 上下文、技能和语音输入可在主会话中添加。草稿转入后由你发送。</p>
      </> : <>
        {!visible.length && <p className="dhp-muted-note">{hidden ? '当前提醒已收起或静音。' : '暂时没有需要关注的任务。'}</p>}
        {visible.map(row => <article className="dhp-activity" key={row.id}><strong>{row.title}</strong><p>{row.label}</p>{row.state === 'blocked' && row.error && <p>{String(row.error.message || row.error).slice(0, 240)}</p>}<div className="dhp-actions">
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
