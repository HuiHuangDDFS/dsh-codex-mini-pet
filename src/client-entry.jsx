import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ANIMATIONS, CELL, activityRows, clampPosition, frameFor, gazeForPoint, resolveAssetUrl, taskPresentation } from './client-model.mjs';
import { combineSessionSources, sessionActivitySource } from './activity-source.mjs';
import { createHarnessActions } from './harness-actions.mjs';
import { PetDock, dockCss } from './pet-dock.jsx';
import { registerPetShortcut } from './shortcuts.mjs';
import { UiButton, UiInput, UiSwitch, UiTabs, setNativeUi, settingsCss } from './native-ui.jsx';

const nativeKit = DSH_PET_PREVIEW ? null : require('@deepseek-ai/dsh-client-ui-primitives');

export const inject = ['slots', 'uiSession', 'sessions', 'uiWorkspace', 'workspaces', 'conversation', 'remote', 'shortcuts'];

const EMPTY_SESSIONS = Object.freeze({ byId: {} });
const EMPTY_STATUS = new Map();
const emptySource = value => ({ getSnapshot: () => value, subscribe: () => () => {} });
const EMPTY_SESSION_SOURCE = emptySource(EMPTY_SESSIONS);
const EMPTY_STATUS_SOURCE = emptySource(EMPTY_STATUS);
const EMPTY_ACTIVE_SOURCE = emptySource(null);
const API_ROOT = () => new URL('dsh-hide-pet/api/', document.baseURI);

const css = `
.dhp-root{--hp-bg:var(--dsw-alias-bg-base,#fff);--hp-text:var(--dsw-alias-label-primary,#18213a);--hp-soft:var(--dsw-alias-interactive-bg-hover,#f1f5fb);--hp-border:var(--dsw-alias-border-l3,#dbe4f0);--hp-muted:var(--dsw-alias-label-secondary,#6c7890);font-family:Inter,"Segoe UI","Microsoft YaHei",sans-serif;color:var(--hp-text);position:absolute;inset:0;pointer-events:none;font-size:13px;line-height:1.5}
.dhp-root *{box-sizing:border-box}.dhp-root button,.dhp-root input,.dhp-root select{font:inherit}.dhp-root button{cursor:pointer}.dhp-root button:focus-visible,.dhp-root input:focus-visible,.dhp-root select:focus-visible{outline:3px solid #718dff;outline-offset:3px}.dhp-root button:disabled{cursor:wait;opacity:.5}.dhp-root button{color:inherit}.dhp-launcher{position:absolute;right:20px;bottom:20px;display:flex;align-items:center;gap:9px;padding:10px 15px;border:1px solid var(--hp-border);border-radius:99px;background:var(--hp-bg);box-shadow:0 5px 24px #101e3d16;pointer-events:auto;font-weight:600}.dhp-launcher span:first-child{color:#597aff;font-size:18px}.dhp-pet{position:absolute;touch-action:none;user-select:none;pointer-events:auto;cursor:grab;outline:none;filter:drop-shadow(0 8px 9px #263f7422)}.dhp-pet[data-dragging=true]{cursor:grabbing}.dhp-sprite{background-repeat:no-repeat;flex:none;image-rendering:auto;pointer-events:none}.dhp-load-art{display:grid;place-items:center;color:var(--hp-muted);font-size:11px;text-align:center;padding:12px}.dhp-pet-bubble{position:absolute;bottom:calc(100% - 10px);left:50%;transform:translateX(-50%);border:1px solid var(--hp-border);border-radius:12px;background:var(--hp-bg);padding:7px 11px;white-space:nowrap;font-size:11px;box-shadow:0 3px 12px #13294c11;pointer-events:none;opacity:0;transition:opacity .2s}.dhp-pet:hover .dhp-pet-bubble,.dhp-pet:focus-visible .dhp-pet-bubble{opacity:1}.dhp-panel{position:absolute;right:20px;bottom:76px;width:430px;max-width:calc(100vw - 24px);max-height:calc(100vh - 110px);overflow:auto;pointer-events:auto;background:var(--hp-bg);border:1px solid var(--hp-border);border-radius:22px;box-shadow:0 20px 70px #15255030;animation:dhp-in .16s ease-out}.dhp-head{display:flex;align-items:flex-start;justify-content:space-between;padding:22px 24px 16px}.dhp-eyebrow{font-size:10px;letter-spacing:.16em;color:#6680d9;font-weight:700}.dhp-head h2{font-size:23px;margin:3px 0 2px;letter-spacing:-.04em}.dhp-head p{color:var(--hp-muted);font-size:12px;margin:0}.dhp-icon-button{border:0;background:transparent;border-radius:10px;width:30px;height:30px;font-size:22px;display:grid;place-items:center;color:var(--hp-muted)!important}.dhp-icon-button:hover{background:var(--hp-soft)}.dhp-tabs{display:flex;gap:6px;margin:0 24px 16px;padding:4px;border-radius:12px;background:var(--hp-soft)}.dhp-tabs button{flex:1;border:0;background:transparent;border-radius:9px;padding:7px;font-size:12px;color:var(--hp-muted)}.dhp-tabs button[aria-selected=true]{background:var(--hp-bg);box-shadow:0 1px 5px #17274d12;color:var(--hp-text);font-weight:600}.dhp-body{padding:0 24px 24px}.dhp-status{display:flex;align-items:center;gap:7px;color:var(--hp-muted);font-size:11px;margin:0 0 15px}.dhp-dot{height:6px;width:6px;border-radius:50%;background:#6bbba2}.dhp-dot[data-working=true]{background:#6587ff;box-shadow:0 0 0 4px #6587ff15}.dhp-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.dhp-card{position:relative;min-width:0;border:1px solid var(--hp-border);background:var(--hp-bg);border-radius:16px;padding:9px 10px 14px;text-align:left;overflow:hidden}.dhp-card[aria-pressed=true]{border-color:#6684ef;box-shadow:0 0 0 2px #6684ef18;background:linear-gradient(145deg,#7194ff0b,transparent)}.dhp-art-stage{height:144px;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at 50% 65%,#7598f116,transparent 65%);border-radius:10px}.dhp-card-name{display:block;font-size:14px;font-weight:650;margin:6px 0 2px}.dhp-card-note{display:block;color:var(--hp-muted);font-size:10px;line-height:1.5}.dhp-check{position:absolute;right:10px;top:9px;display:grid;place-items:center;width:20px;height:20px;border-radius:50%;background:#6482ef;color:#fff;font-size:12px}.dhp-selected{margin-top:18px;padding-top:17px;border-top:1px solid var(--hp-border)}.dhp-detail-title{display:flex;align-items:center;justify-content:space-between;gap:8px;font-weight:650;margin-bottom:4px}.dhp-detail-note{font-size:11px;line-height:1.6;color:var(--hp-muted);margin:0 0 13px}.dhp-actions{display:flex;gap:7px;flex-wrap:wrap}.dhp-button{border:1px solid var(--hp-border);border-radius:9px;background:var(--hp-bg);padding:7px 11px;font-size:11px!important;transition:background .15s}.dhp-button:hover{background:var(--hp-soft)}.dhp-button.primary{background:#5879ed;border-color:#5879ed;color:#fff}.dhp-button.danger{color:#cb5e6b}.dhp-tag{font-size:9px;font-weight:500;padding:2px 6px;border-radius:5px;background:var(--hp-soft);color:var(--hp-muted)}.dhp-field{display:grid;gap:6px;font-size:12px;margin-bottom:15px}.dhp-field input[type=text],.dhp-field select{border:1px solid var(--hp-border);border-radius:9px;color:var(--hp-text);background:var(--hp-bg);padding:9px 10px;width:100%}.dhp-field input[type=range]{width:100%;accent-color:#6382ee}.dhp-field-head{display:flex;justify-content:space-between}.dhp-field-head small{color:var(--hp-muted)}.dhp-toggle{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:12px 0;border-top:1px solid var(--hp-border)}.dhp-toggle p{font-size:10px;color:var(--hp-muted);margin:2px 0 0}.dhp-toggle input{accent-color:#6382ee;margin-top:4px}.dhp-upload{border:1px dashed #8196cf;border-radius:15px;padding:24px 18px;text-align:center;background:#8196cf07;margin-bottom:17px}.dhp-upload strong{font-size:13px;display:block}.dhp-upload p{font-size:11px;line-height:1.8;color:var(--hp-muted);margin:8px 0 14px}.dhp-file{font-size:11px;overflow-wrap:anywhere;color:var(--hp-muted);margin-top:10px}.dhp-preview{display:grid;place-items:center;min-height:160px;background:radial-gradient(ellipse,#7598f118,transparent 70%);margin:-8px 0 10px}.dhp-animation-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.dhp-animation-grid button,.dhp-direction-grid button{font-size:10px;border:1px solid var(--hp-border);padding:7px 3px;border-radius:8px;background:var(--hp-bg)}.dhp-animation-grid button[aria-pressed=true],.dhp-direction-grid button[aria-pressed=true]{border-color:#6684ef;background:#6684ef12;color:#6684ef}.dhp-label{font-size:11px;font-weight:600;margin:17px 0 8px}.dhp-direction-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.dhp-message{font-size:11px;padding:10px 12px;border:1px solid #91adff55;background:#91adff0d;border-radius:10px;margin-bottom:12px;overflow-wrap:anywhere}.dhp-message[data-error=true]{color:#c35a6c;border-color:#d8879655;background:#d887960b}.dhp-empty{font-size:12px;color:var(--hp-muted);padding:25px;text-align:center}.dhp-menu{position:absolute;min-width:170px;padding:6px;border:1px solid var(--hp-border);border-radius:13px;background:var(--hp-bg);box-shadow:0 9px 35px #172b5426;pointer-events:auto;z-index:10}.dhp-menu button{display:block;border:0;background:transparent;width:100%;text-align:left;font-size:12px;padding:8px 11px;border-radius:8px}.dhp-menu button:hover{background:var(--hp-soft)}.dhp-menu small{display:block;font-size:10px;color:var(--hp-muted);padding:6px 11px;border-bottom:1px solid var(--hp-border);margin-bottom:3px}.dhp-footer{color:var(--hp-muted);font-size:10px;margin:14px 0 0;line-height:1.8}.dhp-spinner{display:inline-block;width:12px;height:12px;border:2px solid #7a91da44;border-top-color:#6684ef;border-radius:50%;animation:dhp-spin 1s linear infinite;margin-right:5px;vertical-align:middle}@keyframes dhp-spin{to{transform:rotate(360deg)}}@keyframes dhp-in{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}@media(prefers-reduced-motion:reduce){.dhp-root *{animation:none!important;transition:none!important}}@media(max-width:480px){.dhp-panel{right:12px;bottom:70px;border-radius:18px}.dhp-head{padding:18px 18px 13px}.dhp-body{padding:0 18px 18px}.dhp-tabs{margin:0 18px 14px}.dhp-launcher{right:12px;bottom:14px}}
`;

function useSource(source, fallback) {
  const actual = source || fallback;
  return useSyncExternalStore(actual.subscribe, actual.getSnapshot, actual.getSnapshot);
}

function Sprite({ pet, animation = 'idle', gaze = null, scale = .6, reducedMotion = false, loop = false }) {
  const [time, setTime] = useState(0);
  const [failed, setFailed] = useState(false);
  const start = useRef(Date.now());
  const version = Number(pet?.spriteVersion) === 1 ? 1 : 2;
  const src = pet?.spritesheetUrl ? resolveAssetUrl(pet.spritesheetUrl, document.baseURI) : '';
  useEffect(() => {
    setFailed(false);
    if (!src) return;
    const image = new Image();
    image.onerror = () => setFailed(true);
    image.src = src;
    return () => { image.onerror = null; };
  }, [src]);
  useEffect(() => {
    start.current = Date.now();
    setTime(0);
    if (reducedMotion || gaze !== null) return;
    const timer = setInterval(() => setTime(Date.now() - start.current), 80);
    return () => clearInterval(timer);
  }, [animation, gaze, reducedMotion, src]);
  const width = CELL.width * scale;
  const height = CELL.height * scale;
  if (!src || failed) return <div className="dhp-load-art" style={{ width, height }}>{failed ? '形象暂未加载' : '准备形象中…'}</div>;
  const frame = frameFor(animation, time, { reducedMotion, gaze, version, loop });
  return <div className="dhp-sprite" aria-hidden="true" style={{ width, height, backgroundImage: `url(${JSON.stringify(src)})`, backgroundSize: `${width * 8}px ${height * frame.rows}px`, backgroundPosition: `${-width * frame.column}px ${-height * frame.row}px` }} />;
}

async function apiRequest(endpoint, body, signal) {
  const response = await fetch(new URL(endpoint, API_ROOT()), {
    method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', signal,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let result;
  try { result = await response.json(); } catch { throw new Error(`宠物服务响应异常（${response.status}）`); }
  if (!response.ok || result?.error) throw new Error(typeof result?.error === 'string' ? result.error : result?.error?.message || `操作失败（${response.status}）`);
  return result;
}

function fileBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.readAsDataURL(file);
  });
}

function downloadArchive(result) {
  if (!result.archiveBase64) throw new Error('导出没有返回文件');
  const bytes = Uint8Array.from(atob(result.archiveBase64), char => char.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = result.filename || 'pet.zip';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function PetApp({ ctx, settingsOnly = false, closeSettings }) {
  const [state, setState] = useState({ pets: [], preferences: {} });
  const [ready, setReady] = useState(false);
  const open = settingsOnly;
  const [tab, setTab] = useState('library');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [menu, setMenu] = useState(null);
  const [position, setPosition] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [dragAnimation, setDragAnimation] = useState('running-right');
  const [hover, setHover] = useState(false);
  const [interaction, setInteraction] = useState(null);
  const [gaze, setGaze] = useState(null);
  const [preview, setPreview] = useState('idle');
  const [previewGaze, setPreviewGaze] = useState(null);
  const [upload, setUpload] = useState(null);
  const [uploadName, setUploadName] = useState('');
  const [rename, setRename] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState(new Map());
  const [chatFocus, setChatFocus] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [osReduced, setOsReduced] = useState(false);
  const mounted = useRef(true);
  const stateRef = useRef(state);
  const requestRef = useRef(null);
  const drag = useRef(null);
  const moveRaf = useRef(null);
  const timer = useRef(null);
  const panel = useRef(null);
  const fileInput = useRef(null);
  const replacementInput = useRef(null);
  const keyboardOrigin = useRef(null);
  const desktopFacts = useRef({});
  const native = useMemo(() => createHarnessActions(ctx), [ctx]);
  const sessions = useSource(ctx.sessions?.list, EMPTY_SESSION_SOURCE);
  const statuses = useSource(ctx.uiSession?.sessionStatus, EMPTY_STATUS_SOURCE);
  const ids = [...new Set([...Object.keys(sessions.byId || {}), ...statuses.keys()])].sort().join('\u0000');
  const sessionSources = useMemo(() => combineSessionSources(ids.split('\u0000').filter(Boolean).flatMap(id => {
    const source = ctx.sessions?.binding?.(id)?.session;
    return source ? [{ id, source: sessionActivitySource(source) }] : [];
  })), [ctx, ids, sessions]);
  const snapshots = useSource(sessionSources, EMPTY_ACTIVE_SOURCE);
  const facts = useMemo(() => {
    const result = new Map(snapshots);
    for (const [id, message] of errors) if (!statuses.get(id)?.running) result.set(id, { ...result.get(id), lastAgentError: message });
    return result;
  }, [snapshots, errors, statuses]);
  const rows = useMemo(() => activityRows(sessions, statuses, facts), [sessions, statuses, facts]);
  const presentation = taskPresentation(sessions, statuses, null, facts);
  const prefs = state.preferences || {};
  const desktopSurface = Boolean(state.desktop?.active && prefs.surface !== 'app');
  desktopFacts.current = { presentation: { animation: presentation.animation, label: presentation.label }, rows: rows.map(({ id, title, state, label }) => ({ id, title, state, label })), osReduced, context: native.getContext() };
  const pet = state.pets.find(item => item.id === prefs.selectedPetId) || state.pets[0];
  const scale = Number.isFinite(prefs.scale) ? prefs.scale : .72;
  const size = { width: CELL.width * scale, height: CELL.height * scale };
  const reduced = Boolean(prefs.reducedMotion || osReduced);
  const visible = prefs.visible !== false;
  const mini = prefs.mode === 'mini';
  const currentPosition = clampPosition(position || prefs.position, { width: window.innerWidth, height: window.innerHeight }, size);

  const acceptState = result => {
    const next = result?.state || result;
    if (Array.isArray(next?.pets) && next.preferences) {
      stateRef.current = next;
      setState(next);
      if (!drag.current && !keyboardOrigin.current) setPosition(next.preferences.position || null);
    }
  };

  useEffect(() => {
    mounted.current = true;
    let stopped = false;
    let polling;
    const controller = new AbortController();
    const refresh = async () => {
      clearTimeout(polling);
      try {
        const next = await apiRequest('state', undefined, controller.signal);
        if (!stopped) { acceptState(next); setReady(true); }
      } catch (error) {
        if (!stopped && error.name !== 'AbortError') setMessage({ error: true, text: error.message });
      } finally {
        if (!stopped) polling = setTimeout(refresh, 4000);
      }
    };
    refresh();
    window.addEventListener('dhp-state-change', refresh);
    const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onReduced = () => setOsReduced(reducedQuery.matches);
    onReduced();
    reducedQuery.addEventListener('change', onReduced);
    return () => {
      stopped = true;
      mounted.current = false;
      controller.abort();
      requestRef.current?.abort();
      clearTimeout(polling);
      window.removeEventListener('dhp-state-change', refresh);
      clearTimeout(timer.current);
      if (moveRaf.current) cancelAnimationFrame(moveRaf.current);
      reducedQuery.removeEventListener('change', onReduced);
    };
  }, []);

  useEffect(() => {
    setRename(pet?.name || '');
    setDescription(pet?.description || '');
    setConfirmDelete(false);
  }, [pet?.id, pet?.name]);

  useEffect(() => native.subscribeErrors(({ id, message }) => setErrors(previous => new Map(previous).set(id, message))), [native]);
  useEffect(() => {
    if (settingsOnly) return;
    const focus = () => {
      if (stateRef.current.desktop?.active && stateRef.current.preferences.surface !== 'app') apiRequest('desktop/command', { name: 'toggle-chat' }).catch(() => {});
      else setChatFocus(value => value + 1);
    };
    window.addEventListener('dhp-focus-chat', focus);
    return () => window.removeEventListener('dhp-focus-chat', focus);
  }, [settingsOnly]);
  useEffect(() => {
    if (settingsOnly || location.protocol !== 'dsh-app:' || !state.desktop?.supported) return;
    let stopped = false, polling, replies = [];
    const controller = new AbortController();
    const sync = async () => {
      try {
        const color = getComputedStyle(document.querySelector('.dhp-root') || document.body).color;
        const rgb = color.match(/[\d.]+/g)?.map(Number) || [30, 30, 30];
        const result = await apiRequest('desktop/sync', { facts: { ...desktopFacts.current, theme: { dark: rgb[0] + rgb[1] + rgb[2] > 400 } }, replies }, controller.signal);
        replies = [];
        for (const event of result.events || []) {
          try {
            if (event.type === 'send-chat') await native.sendMessage({ text: event.text });
            else if (event.type === 'edit-chat') await native.openMainComposer({ text: event.text });
            else if (event.type === 'open-session') native.openSession(event.sessionId);
            else if (event.type === 'open-settings') {
              const entry = ctx.slots.entries('sidebar.settings').find(item => item.options?.store?.create);
              const actions = entry?.options?.store?.create()?.actions;
              if (!actions?.openSection) throw new Error('请从更多 → 设置打开宠物伙伴。');
              actions.openSection('dsh-hide-pet');
            }
            replies.push({ id: event.id, kind: event.type, ok: true, ...(event.type === 'edit-chat' ? { message: '已转入主会话草稿，由你发送' } : {}) });
          } catch (error) { replies.push({ id: event.id, kind: event.type, ok: false, error: error.message }); }
        }
      } catch { /* The existing state poll reports connection failures. */ }
      finally { if (!stopped) polling = setTimeout(sync, 750); }
    };
    sync();
    return () => { stopped = true; controller.abort(); clearTimeout(polling); };
  }, [settingsOnly, state.desktop?.supported, native, ctx]);
  useEffect(() => {
    setErrors(previous => {
      const next = new Map(previous);
      for (const [id] of next) if (statuses.get(id)?.running || !sessions.byId?.[id]) next.delete(id);
      return next.size === previous.size ? previous : next;
    });
  }, [statuses, sessions]);

  useEffect(() => {
    if (!menu) return;
    const close = event => {
      if (event.key === 'Escape') setMenu(null);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open, menu]);

  useEffect(() => {
    if (!menu) return;
    const dismiss = event => { if (!event.target.closest('.dhp-menu')) setMenu(null); };
    window.addEventListener('pointerdown', dismiss);
    return () => window.removeEventListener('pointerdown', dismiss);
  }, [menu]);

  useEffect(() => {
    const resize = () => setPosition(previous => clampPosition(previous || stateRef.current.preferences.position,
      { width: window.innerWidth, height: window.innerHeight }, { width: CELL.width * (stateRef.current.preferences.scale || .72), height: CELL.height * (stateRef.current.preferences.scale || .72) }));
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    if (prefs.followPointer === false || reduced || !visible || Number(pet?.spriteVersion) === 1) { setGaze(null); return; }
    let latest;
    const look = event => {
      latest = { x: event.clientX, y: event.clientY };
      if (moveRaf.current) return;
      moveRaf.current = requestAnimationFrame(() => {
        moveRaf.current = null;
        if (drag.current) return;
        setGaze(gazeForPoint(latest, { x: currentPosition.x + size.width / 2, y: currentPosition.y + size.height * .4 }));
      });
    };
    const leave = () => setGaze(null);
    window.addEventListener('pointermove', look, { passive: true });
    document.documentElement.addEventListener('pointerleave', leave);
    return () => {
      window.removeEventListener('pointermove', look);
      document.documentElement.removeEventListener('pointerleave', leave);
      if (moveRaf.current) { cancelAnimationFrame(moveRaf.current); moveRaf.current = null; }
    };
  }, [prefs.followPointer, reduced, visible, pet?.spriteVersion, currentPosition.x, currentPosition.y, size.width, size.height]);

  const perform = async (action, values = {}, success) => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      const result = await apiRequest('action', { action, ...values }, controller.signal);
      if (!mounted.current) return;
      acceptState(result);
      if (!['export', 'validate'].includes(action) && !Array.isArray((result?.state || result)?.pets)) {
        const refreshed = await apiRequest('state', undefined, controller.signal);
        if (!mounted.current) return;
        acceptState(refreshed);
      }
      if (success) setMessage({ text: success });
      if (!['export', 'validate'].includes(action)) window.dispatchEvent(new Event('dhp-state-change'));
      return result;
    } catch (error) {
      if (mounted.current && error.name !== 'AbortError') setMessage({ error: true, text: error.message });
    } finally {
      if (mounted.current) setBusy(false);
      if (requestRef.current === controller) requestRef.current = null;
    }
  };
  const preferences = patch => perform('preferences', { patch });
  useEffect(() => {
    if (settingsOnly || desktopSurface || !visible || prefs.visibilityBehavior !== 'on-demand') return;
    const outside = event => {
      if (!event.target.closest('.dhp-pet,.dhp-dock,.dhp-menu,[role="dialog"]')) preferences({ visible: false });
    };
    window.addEventListener('pointerdown', outside);
    return () => window.removeEventListener('pointerdown', outside);
  }, [settingsOnly, desktopSurface, visible, prefs.visibilityBehavior, busy]);
  const play = stateName => {
    clearTimeout(timer.current);
    setGaze(null);
    setInteraction(stateName);
    timer.current = setTimeout(() => setInteraction(null), stateName === 'jumping' ? 2520 : 2100);
  };
  const onDown = event => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, start: currentPosition, moved: false };
    setMenu(null);
  };
  const onMove = event => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    const dx = event.clientX - current.x, dy = event.clientY - current.y;
    if (Math.hypot(dx, dy) > 4) { current.moved = true; setDragging(true); setDragAnimation(dx < 0 ? 'running-left' : 'running-right'); }
    if (current.moved) setPosition(clampPosition({ x: current.start.x + dx, y: current.start.y + dy }, { width: window.innerWidth, height: window.innerHeight }, size));
  };
  const onUp = event => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (current.moved) preferences({ position: clampPosition({ x: current.start.x + event.clientX - current.x, y: current.start.y + event.clientY - current.y }, { width: window.innerWidth, height: window.innerHeight }, size) });
    else play('waving');
  };
  const importPet = async () => {
    if (!upload) return;
    try {
      if (upload.size > 24 * 1024 * 1024) throw new Error('文件超过 24 MB，请压缩后导入。');
      const base64 = await fileBase64(upload);
      let result;
      if (/\.zip$/i.test(upload.name)) result = await perform('import', { archiveBase64: base64 }, '已加入宠物库');
      else result = await perform('import', { manifest: { name: uploadName.trim() || upload.name.replace(/\.[^.]+$/, ''), description: '导入的自定义伙伴' }, spritesheetBase64: base64 }, '已加入宠物库');
      if (result) { setUpload(null); setUploadName(''); setTab('library'); }
    } catch (error) { setMessage({ error: true, text: error.message }); }
  };
  const validatePet = async () => {
    if (!upload || /\.zip$/i.test(upload.name)) return;
    try {
      if (upload.size > 24 * 1024 * 1024) throw new Error('文件超过 24 MB，请压缩后校验。');
      const report = await perform('validate', { spritesheetBase64: await fileBase64(upload) });
      if (report) setMessage({ error: report.valid === false || report.ok === false, text: report.valid === false || report.ok === false ? `校验未通过：${JSON.stringify(report.errors || report.issues || report)}` : '结构校验通过，可导入。' });
    } catch (error) { setMessage({ error: true, text: error.message }); }
  };
  const exportPet = async () => {
    const result = await perform('export', { id: pet.id });
    if (result) try { downloadArchive(result); } catch (error) { setMessage({ error: true, text: error.message }); }
  };
  const replacePet = async file => {
    if (!file || !pet || pet.builtin) return;
    try {
      if (file.size > 24 * 1024 * 1024) throw new Error('文件超过 24 MB。');
      await perform('replace', { id: pet.id, spritesheetBase64: await fileBase64(file) }, '图集已替换，伙伴 ID 与显示偏好已保留');
    } catch (error) { setMessage({ error: true, text: error.message }); }
  };
  const nativePrompt = async text => {
    if (busy) return;
    setBusy(true); setMessage(null);
    try { await native.openMainComposer({ text, workspaceId: native.getContext().currentWorkspaceId }); closeSettings?.(); }
    catch (error) { setMessage({ error: true, text: error.message }); }
    finally { if (mounted.current) setBusy(false); }
  };
  const createPet = () => nativePrompt(native.createPetPrompt());
  const actualAnimation = dragging ? dragAnimation : interaction || (hover && presentation.animation === 'idle' ? 'jumping' : presentation.animation);
  const actualGaze = !dragging && !interaction && !hover && ['idle', 'running', 'waving'].includes(presentation.animation) ? gaze : null;

  return <div className={`dhp-root${settingsOnly ? ' dhp-settings' : ''}`} data-dsh-hide-pet="true">
    <style>{css + dockCss + `.dhp-settings{position:relative;inset:auto;pointer-events:auto;width:100%;height:100%;min-width:0}.dhp-settings .dhp-panel{position:static;width:100%;max-width:none;max-height:none;overflow:visible;border:0;border-radius:0;box-shadow:none;animation:none}.dhp-settings .dhp-head{padding:0 0 18px}.dhp-settings .dhp-tabs{margin:0 0 18px}.dhp-settings .dhp-body{padding:0 0 24px}.dhp-settings .dhp-head h2{font-size:20px}.dhp-settings .dhp-art-stage{height:125px}`}</style><style>{settingsCss}</style>
    {!settingsOnly && !desktopSurface && visible && !mini && pet && <div className="dhp-pet" role="button" tabIndex={0} aria-label={`${pet.name}，点击打招呼，拖动移动，方向键调整位置，右键打开菜单`} data-dragging={dragging} style={{ left: currentPosition.x, top: currentPosition.y }}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => { drag.current = null; setDragging(false); }}
      onPointerEnter={() => setHover(true)} onPointerLeave={() => setHover(false)} onDoubleClick={() => play('waving')}
      onContextMenu={event => { event.preventDefault(); setMenu({ x: Math.min(event.clientX, window.innerWidth - 185), y: Math.min(event.clientY, window.innerHeight - 210) }); }}
      onBlur={() => { if (keyboardOrigin.current) { keyboardOrigin.current = null; preferences({ position: currentPosition }); } }}
      onKeyDown={event => {
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
          event.preventDefault(); keyboardOrigin.current ||= currentPosition;
          const step = event.shiftKey ? 20 : 5;
          setPosition(clampPosition({ x: currentPosition.x + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0), y: currentPosition.y + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0) }, { width: window.innerWidth, height: window.innerHeight }, size));
        }
        if (event.key === 'Escape' && keyboardOrigin.current) { event.preventDefault(); setPosition(keyboardOrigin.current); keyboardOrigin.current = null; }
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (keyboardOrigin.current) { keyboardOrigin.current = null; preferences({ position: currentPosition }); } else play('waving'); }
        if (event.key === 'ContextMenu') setMenu({ x: currentPosition.x, y: Math.max(8, currentPosition.y - 170) });
      }}>
      <div className="dhp-pet-bubble">{presentation.label} · {pet.name}</div>
      <Sprite pet={pet} animation={actualAnimation} gaze={actualGaze} scale={scale} reducedMotion={reduced} />
    </div>}
    {!settingsOnly && !desktopSurface && visible && <PetDock ctx={ctx} rows={rows} mini={mini} focusRequest={chatFocus} position={{ x: currentPosition.x, y: currentPosition.y + (mini ? 0 : size.height) }} onPreferences={preferences} />}
    {menu && <div className="dhp-menu" role="menu" style={{ left: Math.max(8, menu.x), top: Math.max(8, menu.y) }}>
      <small>{pet?.name} · {presentation.label}</small>
      <button role="menuitem" onClick={() => { play('waving'); setMenu(null); }}>向我打招呼</button>
      <button role="menuitem" onClick={() => { play('jumping'); setMenu(null); }}>跳一下</button>
      <button role="menuitem" onClick={() => { preferences({ mode: mini ? 'pet' : 'mini' }); setMenu(null); }}>{mini ? '显示宠物形象' : '精简模式'}</button>
      <button role="menuitem" onClick={() => { preferences({ visible: false }); setMenu(null); }}>收起伙伴</button>
      <small>设置 › 宠物伙伴 中管理形象</small>
    </div>}
    {open && <section className="dhp-panel" aria-label="宠物伙伴" ref={panel}>
      <header className="dhp-head"><div><h2>宠物伙伴</h2><p>选择形象，设置桌面显示与互动。</p></div><UiButton className="dhp-button" disabled={busy} onClick={() => apiRequest('state').then(acceptState).catch(error => setMessage({ error: true, text: error.message }))}>刷新</UiButton></header>
      <div className="dhp-tabs"><UiTabs value={tab} onChange={setTab} /></div>
      <div className="dhp-body" id="dhp-tab-content" role="tabpanel" aria-label="宠物伙伴选项">
        {message && <div className="dhp-message" data-error={message.error || false} role={message.error ? 'alert' : 'status'}>{message.text}</div>}
        {!ready && <div className="dhp-empty"><span className="dhp-spinner" />连接伙伴库…</div>}
        {ready && tab === 'library' && <>
          <div className="dhp-status"><span className="dhp-dot" data-working={presentation.animation === 'running'} />{presentation.label}<span style={{ marginLeft: 'auto', maxWidth: 140, textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>{presentation.title}</span></div>
          <div className="dhp-grid">{state.pets.map(item => <button className="dhp-card" key={item.id} aria-pressed={item.id === pet?.id} disabled={busy} onClick={() => perform('select', { id: item.id })}>
            {item.id === pet?.id && <span className="dhp-check">✓</span>}<div className="dhp-art-stage"><Sprite pet={item} scale={.48} reducedMotion={reduced} /></div><span className="dhp-card-name">{item.name}</span><span className="dhp-card-note">{item.builtin ? '初始伙伴' : '自定义伙伴'} · {Number(item.spriteVersion) === 1 ? '经典动作' : '16 向目光'}</span>
          </button>)}</div>
          {pet && <div className="dhp-selected"><div className="dhp-detail-title"><span>{pet.name}</span><span className="dhp-tag">{pet.builtin ? '内置' : '自定义'}</span></div><p className="dhp-detail-note">{pet.description}</p>
            {!pet.builtin && <><label className="dhp-field"><span>伙伴名称</span><UiInput type="text" value={rename} maxLength={64} onChange={event => setRename(event.target.value)} /></label><label className="dhp-field"><span>描述</span><UiInput type="text" value={description} maxLength={500} onChange={event => setDescription(event.target.value)} /></label></>}
            <div className="dhp-actions"><UiButton className="dhp-button primary" disabled={busy} onClick={() => preferences({ visible: !visible })}>{visible ? '收起伙伴' : '唤出伙伴'}</UiButton><UiButton className="dhp-button" disabled={busy} onClick={exportPet}>导出 ZIP</UiButton>
              {!pet.builtin && <><UiButton className="dhp-button" disabled={busy || !rename.trim() || (rename === pet.name && description === pet.description)} onClick={() => perform('update', { id: pet.id, patch: { name: rename.trim(), description } }, '伙伴信息已更新')}>保存信息</UiButton><UiButton className="dhp-button" disabled={busy} onClick={() => replacementInput.current?.click()}>替换图集</UiButton><input ref={replacementInput} type="file" accept=".png,.webp" hidden onChange={event => { replacePet(event.target.files?.[0]); event.target.value = ''; }} /><UiButton className="dhp-button danger" disabled={busy} onClick={() => confirmDelete ? perform('delete', { id: pet.id }, '已移出宠物库') : setConfirmDelete(true)}>{confirmDelete ? '确认删除此伙伴' : '删除'}</UiButton>{confirmDelete && <UiButton className="dhp-button" onClick={() => setConfirmDelete(false)}>取消</UiButton>}</>}
            </div></div>}
          <div className="dhp-actions" style={{ marginTop: 16 }}><UiButton className="dhp-button" disabled={busy || !native.getContext().capabilities.composer || !native.getContext().currentWorkspaceId} onClick={createPet}>创建新伙伴…</UiButton>{pet && !pet.builtin && Number(pet.spriteVersion) === 1 && <UiButton className="dhp-button" disabled={busy || !native.getContext().currentWorkspaceId} onClick={() => nativePrompt(`请使用 dsh-hide-pet 技能将现有自定义宠物 ${pet.id}（${pet.name}）升级为 v2。先导出备份，保留角色、九类动作和原 ID，增加十六方向注视，校验及动画预览通过后用 pet_replace 替换图集；不要用重新导入来代替更新。`)}>升级为 v2…</UiButton>}<UiButton className="dhp-button" disabled={busy} onClick={() => preferences({ mode: 'mini', visible: true })}>精简模式 · 只显示操作栏</UiButton></div>
          <p className="dhp-footer">拖动调整位置 · 点击打招呼 · 悬停跳跃 · 方向键移动，Enter 保存，Esc 还原</p>
        </>}
        {ready && tab === 'motion' && <>
          <div className="dhp-preview"><Sprite pet={pet} animation={preview} gaze={previewGaze} scale={.75} reducedMotion={reduced} loop /></div>
          <div className="dhp-animation-grid">{ANIMATIONS.map(item => <button key={item.id} aria-pressed={previewGaze === null && preview === item.id} onClick={() => { setPreview(item.id); setPreviewGaze(null); }}>{item.label}</button>)}</div>
          {Number(pet?.spriteVersion) !== 1 && <><div className="dhp-label">目光方向 · 0° 朝上，顺时针</div><div className="dhp-direction-grid">{Array.from({ length: 16 }, (_, index) => <button key={index} aria-pressed={previewGaze === index} onClick={() => { setPreview('idle'); setPreviewGaze(index); }}>{index * 22.5}°</button>)}</div></>}
          <p className="dhp-footer">工作、等待和确认状态会跟随当前对话自动切换。预览仅在此面板播放。</p>
        </>}
        {ready && tab === 'settings' && <>
          <div className="dhp-setting-row"><div>桌面置顶<p>{state.desktop?.supported ? 'Harness 在后台或最小化时，伙伴仍显示在桌面上。' : '独立桌面窗口适用于 Windows 桌面版 Harness。'}</p></div><UiSwitch label="桌面置顶" checked={prefs.surface !== 'app' && Boolean(state.desktop?.supported)} disabled={busy || !state.desktop?.supported} onChange={next => preferences({ surface: next ? 'desktop' : 'app' })} /></div>
          {state.desktop?.error && <p className="dhp-footer">桌面窗口暂不可用，已回到应用内显示。请重启 Harness 后重试。</p>}
          <label className="dhp-field"><span className="dhp-field-head">伙伴大小<small>{Math.round(scale * 100)}%</small></span><input type="range" min="0.35" max="1.5" step="0.01" value={scale} disabled={busy} onChange={event => { const value = Number(event.target.value); setState(current => ({ ...current, preferences: { ...current.preferences, scale: value } })); }} onPointerUp={event => preferences({ scale: Number(event.target.value) })} onKeyUp={event => preferences({ scale: Number(event.currentTarget.value) })} /></label>
          <div className="dhp-setting-row"><div>显示伙伴<p>收起后可在此处或用 /pet show 唤回。</p></div><UiSwitch label="显示伙伴" checked={visible} disabled={busy} onChange={next => preferences({ visible: next })} /></div>
          <div className="dhp-setting-row"><div>精简模式<p>保留聊天与动态操作，暂时收起形象。</p></div><UiSwitch label="精简模式" checked={mini} disabled={busy} onChange={next => preferences({ mode: next ? 'mini' : 'pet' })} /></div>
          <label className="dhp-field"><span>显示方式</span><select value={prefs.visibilityBehavior || 'always'} disabled={busy} onChange={event => preferences({ visibilityBehavior: event.target.value })}><option value="always">始终显示</option><option value="on-demand">按需显示 · 点击空白收起</option></select></label>
          <div className="dhp-setting-row"><div>目光跟随指针<p>闲暇时朝你的鼠标方向望一望。</p></div><UiSwitch label="目光跟随指针" checked={prefs.followPointer !== false} disabled={busy || Number(pet?.spriteVersion) === 1} onChange={next => preferences({ followPointer: next })} /></div>
          <div className="dhp-setting-row"><div>减少动态效果<p>{osReduced ? '系统已启用减少动态效果。' : '保留静态姿态，减少循环动作。'}</p></div><UiSwitch label="减少动态效果" checked={Boolean(prefs.reducedMotion)} disabled={busy} onChange={next => preferences({ reducedMotion: next })} /></div>
          <div className="dhp-actions" style={{ marginTop: 18 }}><UiButton className="dhp-button" disabled={busy} onClick={() => perform('reset', { scope: 'position' })}>重置位置</UiButton><UiButton className="dhp-button" disabled={busy} onClick={() => perform('reset', { scope: 'size' })}>重置大小</UiButton></div>
          <p className="dhp-footer">偏好保存在本机。桌面模式下，Ctrl+Alt+Shift+P 可在其他应用中唤出快速聊天；若热键被占用，可点击伙伴操作栏。应用内快捷键可在 Harness 设置中调整。</p>
        </>}
        {ready && tab === 'import' && <>
          <div className="dhp-upload"><strong>让新伙伴加入</strong><p>导入宠物 ZIP 包，或透明 PNG / WebP 动作图。<br />v2：1536 × 2288 · 9 组动作 + 16 个目光方向</p><UiButton className="dhp-button" disabled={busy} onClick={() => fileInput.current?.click()}>选择文件</UiButton><input ref={fileInput} type="file" hidden accept=".zip,.png,.webp,application/zip,image/png,image/webp" onChange={event => { setUpload(event.target.files?.[0] || null); setMessage(null); event.target.value = ''; }} />{upload && <div className="dhp-file">{upload.name} · {(upload.size / 1024 / 1024).toFixed(2)} MB</div>}</div>
          {upload && !/\.zip$/i.test(upload.name) && <label className="dhp-field">伙伴名称<UiInput type="text" placeholder="为新伙伴取个名字" maxLength={64} value={uploadName} onChange={event => setUploadName(event.target.value)} /></label>}
          <div className="dhp-actions"><UiButton className="dhp-button primary" disabled={busy || !upload} onClick={importPet}>{busy ? '处理中…' : '导入伙伴'}</UiButton>{upload && !/\.zip$/i.test(upload.name) && <UiButton className="dhp-button" disabled={busy} onClick={validatePet}>先检查动作图</UiButton>}</div>
          <p className="dhp-footer">ZIP 包保留名称与描述；单张图片自动识别 v1 / v2。请使用你有权使用的形象，导入前会检查文件结构。</p>
        </>}
      </div>
    </section>}
  </div>;
}

export function apply(ctx) {
  setNativeUi(nativeKit);
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'dsh-hide-pet', order: 90 }, () => <PetApp ctx={ctx} />));
  ctx.slots.inject('settings.section', () => ctx.slots.register({ name: 'settings.section', id: 'dsh-hide-pet', order: 40, label: () => '宠物伙伴' }, ({ close }) => <PetApp ctx={ctx} settingsOnly closeSettings={close} />));
  ctx.effect(() => registerPetShortcut(ctx.shortcuts, () => {
      apiRequest('action', { action: 'preferences', patch: { visible: true } }).then(() => { window.dispatchEvent(new Event('dhp-state-change')); window.dispatchEvent(new Event('dhp-focus-chat')); }).catch(() => {});
  }));
}
