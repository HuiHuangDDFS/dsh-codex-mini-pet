export const ANIMATIONS = Object.freeze([
  { id: 'idle', label: '待机', count: 6, fps: 6 },
  { id: 'running-right', label: '向右跑', count: 8, fps: 10 },
  { id: 'running-left', label: '向左跑', count: 8, fps: 10 },
  { id: 'waving', label: '打招呼', count: 4, fps: 5 },
  { id: 'jumping', label: '跳跃', count: 5, fps: 7 },
  { id: 'failed', label: '遇到问题', count: 8, fps: 6 },
  { id: 'waiting', label: '等待', count: 6, fps: 6 },
  { id: 'running', label: '工作中', count: 6, fps: 7 },
  { id: 'review', label: '检查', count: 6, fps: 6 },
]);

export const CELL = Object.freeze({ width: 192, height: 208, columns: 8 });

export function clampPosition(position, viewport, size, margin = 8) {
  const maxX = Math.max(margin, viewport.width - size.width - margin);
  const maxY = Math.max(margin, viewport.height - size.height - margin);
  const x = Number.isFinite(position?.x) ? position.x : maxX - 34;
  const y = Number.isFinite(position?.y) ? position.y : maxY - 58;
  return { x: Math.min(maxX, Math.max(margin, x)), y: Math.min(maxY, Math.max(margin, y)) };
}

/** The sheet uses viewer coordinates: 0 up, clockwise, in sixteen even steps. */
export function gazeForPoint(point, center, deadZone = 30) {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  if (Math.hypot(dx, dy) < deadZone) return null;
  const angle = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
  return Math.round(angle / 22.5) % 16;
}

export const FRAME_TIMES = Object.freeze({
  idle: [1680, 660, 660, 840, 840, 1920],
  'running-right': [120, 120, 120, 120, 120, 120, 120, 220],
  'running-left': [120, 120, 120, 120, 120, 120, 120, 220],
  waving: [140, 140, 140, 280], jumping: [140, 140, 140, 140, 280],
  failed: [140, 140, 140, 140, 140, 140, 140, 240],
  waiting: [150, 150, 150, 150, 150, 260],
  running: [120, 120, 120, 120, 120, 220],
  review: [150, 150, 150, 150, 150, 280],
});

export function frameFor(animation, elapsedMs, { reducedMotion = false, gaze = null, version = 2, loop = false } = {}) {
  if (!reducedMotion && ['idle', 'running', 'waving'].includes(animation) && version === 2 && Number.isInteger(gaze) && gaze >= 0 && gaze < 16) {
    return { row: 9 + Math.floor(gaze / 8), column: gaze % 8, rows: 11 };
  }
  let row = Math.max(0, ANIMATIONS.findIndex(item => item.id === animation));
  if (reducedMotion) return { row, column: 0, rows: version === 1 ? 9 : 11 };
  let times = FRAME_TIMES[ANIMATIONS[row].id];
  let duration = times.reduce((a, b) => a + b, 0);
  let time = Math.max(0, elapsedMs);
  if (!loop && row !== 0 && time >= duration * 3) {
    time -= duration * 3; row = 0; times = FRAME_TIMES.idle;
    duration = times.reduce((a, b) => a + b, 0);
  }
  time %= duration;
  let column = 0;
  while (column < times.length - 1 && time >= times[column]) time -= times[column++];
  return { row, column: reducedMotion ? 0 : column, rows: version === 1 ? 9 : 11 };
}

export const ACTIVITY_STATES = Object.freeze({
  'needs-input': { priority: 0, animation: 'waiting', label: '需要你的回应' },
  blocked: { priority: 1, animation: 'failed', label: '遇到了一点问题' },
  ready: { priority: 2, animation: 'review', label: '已完成，待查看' },
  running: { priority: 3, animation: 'running', label: '正在工作' },
  idle: { priority: 4, animation: 'idle', label: '随时准备好' },
});

export function activeSessionId(sessions) {
  return Object.values(sessions?.byId || {}).find(row => (row.retainedBy?.mainView || 0) > 0)?.id;
}

/** Only Host facts determine activity. An idle session is not a failed session. */
export function activityRows(sessions, statuses, snapshots = new Map(), { includeIdle = false } = {}) {
  const byId = sessions?.byId || {};
  const ids = new Set([...Object.keys(byId), ...(statuses?.keys?.() || [])]);
  return [...ids].map(id => {
    const row = byId[id] || { id }, status = statuses?.get?.(id) || {};
    const snapshot = snapshots?.get?.(id);
    const pending = status.pendingInteraction;
    const error = snapshot?.lastTurnError || snapshot?.lastAgentError || snapshot?.openError || snapshot?.promptError?.error || null;
    // Running takes precedence over an error from a previous turn in this same chat.
    const state = pending ? 'needs-input' : status.running || row.running ? 'running' : error ? 'blocked' : status.completionUnread ? 'ready' : 'idle';
    const spec = ACTIVITY_STATES[state];
    const kind = typeof pending === 'string' ? pending : pending?.kind || pending?.type || '';
    const label = state === 'needs-input' && /approv|review|permission/.test(kind) ? '等待你的确认' : spec.label;
    return { id, sessionId: id, title: row.displayTitle || row.title || '未命名会话', state, label, animation: spec.animation, priority: spec.priority, active: (row.retainedBy?.mainView || 0) > 0, running: Boolean(status.running || row.running), pendingInteraction: pending || null, error, activityVersion: snapshot?.activityVersion || '', unread: Boolean(status.completionUnread) };
  }).filter(row => includeIdle || row.state !== 'idle').sort((a, b) => a.priority - b.priority || Number(b.active) - Number(a.active) || a.title.localeCompare(b.title));
}

/** Codex's documented priority: needs input, blocked, ready, running. */
export function taskPresentation(sessions, statuses, sessionSnapshot = null, snapshots = null) {
  const activeId = activeSessionId(sessions);
  const facts = snapshots || new Map(activeId && sessionSnapshot ? [[activeId, sessionSnapshot]] : []);
  const activity = activityRows(sessions, statuses, facts);
  const first = activity[0];
  if (first) return { ...first, count: activity.length };
  const active = sessions?.byId?.[activeId];
  return { state: 'idle', animation: 'idle', label: ACTIVITY_STATES.idle.label, title: active?.displayTitle || active?.title || '你的工作伙伴', sessionId: activeId, count: 0 };
}

export function resolveAssetUrl(path, baseUri) {
  if (!path) return '';
  return new URL(path, baseUri).href;
}
