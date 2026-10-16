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

export function frameFor(animation, elapsedMs, { reducedMotion = false, gaze = null, version = 2 } = {}) {
  if (version === 2 && Number.isInteger(gaze) && gaze >= 0 && gaze < 16) {
    return { row: 9 + Math.floor(gaze / 8), column: gaze % 8, rows: 11 };
  }
  const row = Math.max(0, ANIMATIONS.findIndex(item => item.id === animation));
  const spec = ANIMATIONS[row];
  return { row, column: reducedMotion ? 0 : Math.floor(elapsedMs * spec.fps / 1000) % spec.count, rows: version === 1 ? 9 : 11 };
}

/** Only use facts exposed by the Host. In particular, idle is not evidence of failure. */
export function taskPresentation(sessions, statuses, sessionSnapshot = null) {
  const rows = Object.values(sessions?.byId || {});
  const active = rows.find(row => (row.retainedBy?.mainView || 0) > 0);
  const status = active ? statuses?.get?.(active.id) : undefined;
  const pending = status?.pendingInteraction;
  if (pending) {
    const approval = /approv|review|permission/.test(String(pending.kind || pending.type || ''));
    return { animation: approval ? 'review' : 'waiting', label: approval ? '等待你的确认' : '等待你的回应', title: active.title || '当前对话', sessionId: active.id };
  }
  if (status?.running || active?.running) return { animation: 'running', label: '正在陪你工作', title: active.title || '当前对话', sessionId: active.id };
  if (active && sessionSnapshot?.lastAgentError) return { animation: 'failed', label: '遇到了一点问题', title: active.title || '当前对话', sessionId: active.id };
  if ([...(statuses?.values?.() || [])].some(item => item.completionUnread)) return { animation: 'waving', label: '有任务完成啦', title: active?.title || '任务提醒', sessionId: active?.id };
  return { animation: 'idle', label: '随时准备好', title: active?.title || '你的工作伙伴', sessionId: active?.id };
}

export function resolveAssetUrl(path, baseUri) {
  if (!path) return '';
  return new URL(path, baseUri).href;
}
