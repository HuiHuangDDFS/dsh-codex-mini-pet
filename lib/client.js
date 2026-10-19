window.__ModuleLoader__.load({id:"dsh-codex-mini-pet",factory(require){const module={exports:{}};const exports=module.exports;
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client-entry.jsx
var client_entry_exports = {};
__export(client_entry_exports, {
  PetApp: () => PetApp,
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(client_entry_exports);
var import_react4 = __toESM(require("react"), 1);

// src/client-model.mjs
var ANIMATIONS = Object.freeze([
  { id: "idle", label: "\u5F85\u673A", count: 6, fps: 6 },
  { id: "running-right", label: "\u5411\u53F3\u8DD1", count: 8, fps: 10 },
  { id: "running-left", label: "\u5411\u5DE6\u8DD1", count: 8, fps: 10 },
  { id: "waving", label: "\u6253\u62DB\u547C", count: 4, fps: 5 },
  { id: "jumping", label: "\u8DF3\u8DC3", count: 5, fps: 7 },
  { id: "failed", label: "\u9047\u5230\u95EE\u9898", count: 8, fps: 6 },
  { id: "waiting", label: "\u7B49\u5F85", count: 6, fps: 6 },
  { id: "running", label: "\u5DE5\u4F5C\u4E2D", count: 6, fps: 7 },
  { id: "review", label: "\u68C0\u67E5", count: 6, fps: 6 }
]);
var CELL = Object.freeze({ width: 192, height: 208, columns: 8 });
function clampPosition(position, viewport, size, margin = 8) {
  const maxX = Math.max(margin, viewport.width - size.width - margin);
  const maxY = Math.max(margin, viewport.height - size.height - margin);
  const x = Number.isFinite(position?.x) ? position.x : maxX - 34;
  const y = Number.isFinite(position?.y) ? position.y : maxY - 58;
  return { x: Math.min(maxX, Math.max(margin, x)), y: Math.min(maxY, Math.max(margin, y)) };
}
function gazeForPoint(point, center, deadZone = 30) {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  if (Math.hypot(dx, dy) < deadZone) return null;
  const angle = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
  return Math.round(angle / 22.5) % 16;
}
var FRAME_TIMES = Object.freeze({
  idle: [1680, 660, 660, 840, 840, 1920],
  "running-right": [120, 120, 120, 120, 120, 120, 120, 220],
  "running-left": [120, 120, 120, 120, 120, 120, 120, 220],
  waving: [140, 140, 140, 280],
  jumping: [140, 140, 140, 140, 280],
  failed: [140, 140, 140, 140, 140, 140, 140, 240],
  waiting: [150, 150, 150, 150, 150, 260],
  running: [120, 120, 120, 120, 120, 220],
  review: [150, 150, 150, 150, 150, 280]
});
function frameFor(animation, elapsedMs, { reducedMotion = false, gaze = null, version = 2, loop = false } = {}) {
  if (!reducedMotion && ["idle", "running", "waving"].includes(animation) && version === 2 && Number.isInteger(gaze) && gaze >= 0 && gaze < 16) {
    return { row: 9 + Math.floor(gaze / 8), column: gaze % 8, rows: 11 };
  }
  let row = Math.max(0, ANIMATIONS.findIndex((item) => item.id === animation));
  if (reducedMotion) return { row, column: 0, rows: version === 1 ? 9 : 11 };
  let times = FRAME_TIMES[ANIMATIONS[row].id];
  let duration = times.reduce((a, b) => a + b, 0);
  let time = Math.max(0, elapsedMs);
  if (!loop && row !== 0 && time >= duration * 3) {
    time -= duration * 3;
    row = 0;
    times = FRAME_TIMES.idle;
    duration = times.reduce((a, b) => a + b, 0);
  }
  time %= duration;
  let column = 0;
  while (column < times.length - 1 && time >= times[column]) time -= times[column++];
  return { row, column: reducedMotion ? 0 : column, rows: version === 1 ? 9 : 11 };
}
var ACTIVITY_STATES = Object.freeze({
  "needs-input": { priority: 0, animation: "waiting", label: "\u9700\u8981\u4F60\u7684\u56DE\u5E94" },
  blocked: { priority: 1, animation: "failed", label: "\u9047\u5230\u4E86\u4E00\u70B9\u95EE\u9898" },
  ready: { priority: 2, animation: "review", label: "\u5DF2\u5B8C\u6210\uFF0C\u5F85\u67E5\u770B" },
  running: { priority: 3, animation: "running", label: "\u6B63\u5728\u5DE5\u4F5C" },
  idle: { priority: 4, animation: "idle", label: "\u968F\u65F6\u51C6\u5907\u597D" }
});
function activeSessionId(sessions) {
  return Object.values(sessions?.byId || {}).find((row) => (row.retainedBy?.mainView || 0) > 0)?.id;
}
function activityRows(sessions, statuses, snapshots = /* @__PURE__ */ new Map(), { includeIdle = false } = {}) {
  const byId = sessions?.byId || {};
  const ids = /* @__PURE__ */ new Set([...Object.keys(byId), ...statuses?.keys?.() || []]);
  return [...ids].map((id) => {
    const row = byId[id] || { id }, status = statuses?.get?.(id) || {};
    const snapshot = snapshots?.get?.(id);
    const running = status.running ?? snapshot?.running ?? row.running ?? false;
    const pending = status.pendingInteraction;
    const error = snapshot?.lastTurnError || snapshot?.lastAgentError || snapshot?.openError || snapshot?.promptError?.error || null;
    const state = pending ? "needs-input" : running ? "running" : error ? "blocked" : status.completionUnread ? "ready" : "idle";
    const spec = ACTIVITY_STATES[state];
    const kind = typeof pending === "string" ? pending : pending?.kind || pending?.type || "";
    const label = state === "needs-input" && /approv|review|permission/.test(kind) ? "\u7B49\u5F85\u4F60\u7684\u786E\u8BA4" : spec.label;
    return { id, sessionId: id, title: row.displayTitle || row.title || "\u672A\u547D\u540D\u4F1A\u8BDD", state, label, animation: spec.animation, priority: spec.priority, active: (row.retainedBy?.mainView || 0) > 0, running: Boolean(running), pendingInteraction: pending || null, error, activityVersion: snapshot?.activityVersion || "", turnEnded: Boolean(snapshot?.turnEnded), turnOutcome: snapshot?.turnOutcome ?? null, unread: Boolean(status.completionUnread) };
  }).filter((row) => includeIdle || row.state !== "idle").sort((a, b) => a.priority - b.priority || Number(b.active) - Number(a.active) || a.title.localeCompare(b.title));
}
function taskPresentation(sessions, statuses, sessionSnapshot = null, snapshots = null) {
  const activeId = activeSessionId(sessions);
  const facts = snapshots || new Map(activeId && sessionSnapshot ? [[activeId, sessionSnapshot]] : []);
  const activity = activityRows(sessions, statuses, facts);
  const first = activity[0];
  if (first) return { ...first, count: activity.length };
  const active = sessions?.byId?.[activeId];
  return { state: "idle", animation: "idle", label: ACTIVITY_STATES.idle.label, title: active?.displayTitle || active?.title || "\u4F60\u7684\u5DE5\u4F5C\u4F19\u4F34", sessionId: activeId, count: 0 };
}
function resolveAssetUrl(path, baseUri) {
  if (!path) return "";
  return new URL(path, baseUri).href;
}

// src/activity-source.mjs
function bindExternalSource(source) {
  return { subscribe: (listener) => source.subscribe(listener), getSnapshot: () => source.getSnapshot() };
}
function combineSessionSources(sources) {
  let previousValues = [], previous = /* @__PURE__ */ new Map();
  return {
    subscribe(listener) {
      const disposers = sources.map(({ source }) => source.subscribe(listener));
      return () => disposers.forEach((dispose) => dispose());
    },
    getSnapshot() {
      const values = sources.map(({ source }) => source.getSnapshot());
      if (values.length === previousValues.length && values.every((value, index) => value === previousValues[index])) return previous;
      previousValues = values;
      previous = new Map(sources.map(({ id }, index) => [id, values[index]]));
      return previous;
    }
  };
}
function sessionActivitySource(session) {
  let previousSnapshot, previousEvents, cached;
  return {
    subscribe(listener) {
      const offSession = session.subscribe(listener);
      const offEvents = session.eventSource?.subscribe(listener);
      return () => {
        offSession();
        offEvents?.();
      };
    },
    getSnapshot() {
      const snapshot = session.getSnapshot();
      const events = session.eventSource?.getSnapshot();
      if (cached && previousSnapshot === snapshot && previousEvents === events) return cached;
      previousSnapshot = snapshot;
      previousEvents = events;
      let lastTurnError = null, activityVersion = null, turnEnded = false, turnOutcome = null;
      const entries = events?.entries || [];
      for (let i = entries.length - 1; i >= 0; i--) {
        const event = entries[i].event || entries[i];
        if (!["turn/start", "turn/end"].includes(event.type)) continue;
        activityVersion = `${event.data?.turn}:${event.seq}`;
        turnEnded = event.type === "turn/end";
        turnOutcome = turnEnded ? event.data?.reason?.kind ?? null : null;
        if (event.type === "turn/end" && event.data?.reason?.kind === "error") lastTurnError = event.data.reason.error;
        break;
      }
      cached = { ...snapshot, lastTurnError, activityVersion, turnEnded, turnOutcome };
      return cached;
    }
  };
}

// src/harness-actions.mjs
var SOURCE = "hidePet";
var emptyList = { ids: [], byId: {}, phase: "pending" };
function service(ctx, name) {
  return ctx.get?.(name) ?? ctx[name];
}
function failure(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}
function requireText(text) {
  if (typeof text !== "string" || !text.trim()) throw failure("EMPTY_PROMPT", "\u8BF7\u5148\u8F93\u5165\u8981\u53D1\u9001\u7684\u5185\u5BB9\u3002");
  return text;
}
function samePath(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const normalize = (value) => value.replaceAll("\\", "/").replace(/\/+$/, "");
  const left = normalize(a), right = normalize(b);
  return /^[A-Za-z]:\//.test(left) ? left.toLowerCase() === right.toLowerCase() : left === right;
}
function sessionTitle(row) {
  if (typeof row.title === "string" && row.title.trim()) return row.title.trim();
  if (!row.cwd && row.displayTitle) return row.displayTitle;
  return "\u672A\u547D\u540D\u4F1A\u8BDD";
}
function requiresNativeComposer(text) {
  return /(^|\s)[@$]/u.test(text) || /^\s*\//u.test(text);
}
function createPetPrompt() {
  return "\u8BF7\u5E2E\u6211\u521B\u5EFA\u4E00\u53EA\u65B0\u7684 DeepSeek Harness \u684C\u9762\u5BA0\u7269\u3002\u5148\u8BE2\u95EE\u6211\u60F3\u8981\u7684\u89D2\u8272\u3001\u98CE\u683C\u548C\u540D\u5B57\uFF0C\u518D\u5236\u4F5C\u5305\u542B\u4E5D\u7C7B\u52A8\u4F5C\u548C\u5341\u516D\u65B9\u5411\u6CE8\u89C6\u7684\u900F\u660E v2 \u56FE\u96C6\uFF0C\u9010\u9879\u9884\u89C8\u540E\u5BFC\u5165 dsh-codex-mini-pet\u3002\u5982\u679C\u5DF2\u5B89\u88C5 dsh-codex-mini-pet \u6280\u80FD\uFF0C\u8BF7\u6309\u8BE5\u6280\u80FD\u6267\u884C\uFF1B\u5982\u679C\u5C1A\u672A\u5B89\u88C5\uFF0C\u8BF7\u5148\u8BF4\u660E\u7F3A\u5C11\u6280\u80FD\uFF0C\u4E0D\u8981\u58F0\u79F0\u5DF2\u7ECF\u8C03\u7528\u3002";
}
function createHarnessActions(ctx) {
  const sessions = () => service(ctx, "sessions");
  const navigation = () => service(ctx, "uiWorkspace");
  const conversation = () => service(ctx, "conversation");
  function getContext() {
    const list = sessions()?.list?.getSnapshot?.() ?? emptyList;
    const rows = Object.values(list.byId ?? {});
    const current = rows.find((row) => (row.retainedBy?.mainView ?? 0) > 0);
    const workspaceState = service(ctx, "workspaces")?.list?.getSnapshot?.();
    const archived = new Set(workspaceState?.archivedSessionIds ?? []);
    const workspaces = (workspaceState?.items ?? []).filter((item) => !item.archived).map((item) => ({
      workspaceId: item.workspaceId,
      path: item.path,
      title: item.title || item.path?.split(/[\\/]/).filter(Boolean).at(-1) || item.workspaceId,
      sessionIds: [...item.sessionIds ?? []].filter((id) => !archived.has(id))
    }));
    const allRows = new Map(rows.map((row) => [row.id, row]));
    for (const item of workspaces) for (const id of item.sessionIds) if (!allRows.has(id)) {
      allRows.set(id, { id, title: list.projectionsBySession?.[id]?.values?.title || "\u672A\u547D\u540D\u4F1A\u8BDD" });
    }
    const availableSessions = [...allRows.values()].filter((row) => !archived.has(row.id) && !row.archived && !row.parentId && row.blank !== true).map((row) => {
      const workspace2 = workspaces.find((item) => item.sessionIds.includes(row.id)) ?? workspaces.find((item) => samePath(item.path, row.cwd));
      return { sessionId: row.id, title: sessionTitle(row), workspaceId: workspace2?.workspaceId ?? null, updatedAt: row.updatedAt ?? 0 };
    }).sort((a, b) => (Number(b.updatedAt) || Date.parse(b.updatedAt) || 0) - (Number(a.updatedAt) || Date.parse(a.updatedAt) || 0));
    const workspace = current ? workspaces.find((item) => item.sessionIds.includes(current.id) || samePath(item.path, current.cwd)) : void 0;
    return {
      currentSessionId: current?.id ?? null,
      currentSessionTitle: current?.displayTitle ?? current?.title ?? null,
      currentWorkspaceId: workspace?.workspaceId ?? null,
      currentWorkspacePath: workspace?.path ?? null,
      workspaces,
      sessions: availableSessions,
      sessionsReady: list.phase === "ready",
      workspacesReady: workspaceState?.phase === "ready",
      capabilities: {
        openSession: typeof navigation()?.openSession === "function",
        sendMessage: typeof sessions()?.create === "function" && typeof sessions()?.using === "function",
        composer: typeof conversation()?.input?.for === "function",
        stopSession: typeof sessions()?.using === "function",
        errors: typeof service(ctx, "remote")?.$on === "function",
        shortcuts: typeof service(ctx, "shortcuts")?.register === "function",
        voice: false,
        systemFloatingWindow: false,
        globalShortcut: false
      },
      unavailable: {
        voice: "\u5BBF\u4E3B\u7684\u5B9E\u9A8C\u6027\u8BED\u97F3\u6309\u94AE\u4F4D\u4E8E\u539F\u751F\u8F93\u5165\u680F\uFF0C\u672A\u516C\u5F00\u8DE8\u63D2\u4EF6\u542F\u52A8\u5F55\u97F3\u7684\u65B9\u6CD5\u3002",
        systemFloatingWindow: "\u6B64\u7248\u672C\u7684\u63D2\u4EF6\u63A5\u53E3\u53EA\u63D0\u4F9B\u5E94\u7528\u5185 overlay\uFF0C\u672A\u516C\u5F00\u7CFB\u7EDF\u60AC\u6D6E\u7A97\u63A5\u53E3\u3002",
        globalShortcut: "\u539F\u751F\u5FEB\u6377\u952E\u6CE8\u518C\u4F5C\u7528\u4E8E Harness \u7A97\u53E3\uFF0C\u672A\u516C\u5F00\u7CFB\u7EDF\u5168\u5C40\u70ED\u952E\u63A5\u53E3\u3002"
      }
    };
  }
  function requireSessions() {
    const value = sessions();
    if (typeof value?.using !== "function") throw failure("CAPABILITY_UNAVAILABLE", "\u5F53\u524D\u73AF\u5883\u672A\u63D0\u4F9B Harness \u4F1A\u8BDD\u64CD\u4F5C\uFF0C\u8BF7\u5728\u5DF2\u5B89\u88C5\u63D2\u4EF6\u7684\u5BBF\u4E3B\u4E2D\u4F7F\u7528\u3002");
    return value;
  }
  function requireId(sessionId) {
    if (typeof sessionId !== "string" || !sessionId) throw failure("SESSION_REQUIRED", "\u8BF7\u9009\u62E9\u4E00\u4E2A\u4F1A\u8BDD\u3002");
    return sessionId;
  }
  async function target({ sessionId, workspaceId } = {}) {
    const controller = requireSessions();
    const context = getContext();
    if (sessionId != null) {
      requireId(sessionId);
      const session = context.sessions.find((item) => item.sessionId === sessionId);
      if (!session && context.sessionsReady) throw failure("SESSION_UNAVAILABLE", "\u8FD9\u4E2A\u4F1A\u8BDD\u5DF2\u5F52\u6863\u6216\u4E0D\u518D\u53EF\u7528\uFF0C\u8BF7\u91CD\u65B0\u9009\u62E9\u3002");
      const workspace2 = context.workspaces.find((item) => item.workspaceId === session?.workspaceId);
      return { sessionId, created: false, workspaceId: workspace2?.workspaceId ?? null, workspacePath: workspace2?.path ?? null };
    }
    const id = workspaceId ?? context.currentWorkspaceId;
    const workspace = context.workspaces.find((item) => item.workspaceId === id);
    if (!workspace) throw failure("WORKSPACE_REQUIRED", "\u8BF7\u5148\u9009\u62E9\u5DE5\u4F5C\u533A\uFF1B\u65B0\u4F1A\u8BDD\u5C06\u5728\u4F60\u9009\u62E9\u7684\u76EE\u5F55\u4E2D\u521B\u5EFA\u3002");
    if (typeof controller.create !== "function") throw failure("CAPABILITY_UNAVAILABLE", "\u5F53\u524D\u73AF\u5883\u4E0D\u652F\u6301\u521B\u5EFA\u539F\u751F\u4F1A\u8BDD\u3002");
    const createdId = await controller.create({ workspaceId: workspace.workspaceId });
    return { sessionId: createdId, created: true, workspaceId: workspace.workspaceId, workspacePath: workspace.path };
  }
  function openSession(id) {
    requireId(id);
    const ui = navigation();
    if (typeof ui?.openSession !== "function") throw failure("CAPABILITY_UNAVAILABLE", "\u5F53\u524D\u73AF\u5883\u672A\u63D0\u4F9B\u539F\u751F\u4F1A\u8BDD\u5BFC\u822A\u3002");
    ui.openSession(id);
    return { sessionId: id };
  }
  async function sendMessage({ text, sessionId, workspaceId } = {}) {
    requireText(text);
    if (requiresNativeComposer(text)) throw failure("NATIVE_COMPOSER_REQUIRED", "\u542B @\u3001$ \u6216\u547D\u4EE4\u7684\u5185\u5BB9\u8BF7\u4F7F\u7528\u201C\u5728\u4E3B\u4F1A\u8BDD\u7F16\u8F91\u201D\uFF0C\u901A\u8FC7\u539F\u751F\u8F93\u5165\u680F\u9009\u62E9\u4E0A\u4E0B\u6587\u540E\u53D1\u9001\u3002");
    const result = await target({ sessionId, workspaceId });
    await requireSessions().using(result.sessionId, { source: SOURCE }, async (reference) => {
      const admission = await reference.binding.session.prompt([{ type: "text", text }], "queue");
      if (!admission?.ok) throw failure(admission?.error?.code ?? "PROMPT_FAILED", admission?.error?.message ?? "\u5BBF\u4E3B\u672A\u63A5\u53D7\u8FD9\u6761\u6D88\u606F\u3002");
    });
    return result;
  }
  async function stopSession(id) {
    requireId(id);
    await requireSessions().using(id, { source: SOURCE }, async (reference) => {
      const result = await reference.binding.session.cancel();
      if (!result?.ok) throw failure(result?.error?.code ?? "STOP_FAILED", result?.error?.message ?? "\u5BBF\u4E3B\u672A\u80FD\u505C\u6B62\u8FD9\u4E2A\u4F1A\u8BDD\u3002");
    });
    return { sessionId: id };
  }
  async function openMainComposer({ text = "", sessionId, workspaceId } = {}) {
    if (typeof text !== "string") throw failure("INVALID_PROMPT", "\u8349\u7A3F\u5185\u5BB9\u5FC5\u987B\u662F\u6587\u5B57\u3002");
    const resolver = conversation()?.input;
    if (typeof resolver?.for !== "function") throw failure("CAPABILITY_UNAVAILABLE", "\u5F53\u524D\u73AF\u5883\u672A\u63D0\u4F9B\u539F\u751F\u8F93\u5165\u680F\u3002");
    const result = await target({ sessionId, workspaceId });
    openSession(result.sessionId);
    await requireSessions().using(result.sessionId, { source: SOURCE }, async (reference) => {
      const input = resolver.for(reference.binding.ctx);
      if (text) {
        const span = input.actions.captureInsertion();
        if (!input.actions.insertText(text, span)) throw failure("COMPOSER_BUSY", "\u539F\u751F\u8F93\u5165\u680F\u6B63\u5728\u5904\u7406\u5185\u5BB9\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\uFF1B\u539F\u6709\u8349\u7A3F\u5DF2\u4FDD\u7559\u3002");
      }
      const list = sessions()?.list;
      if (typeof list?.subscribe === "function") {
        await new Promise((resolve, reject) => {
          const check = () => (list.getSnapshot()?.byId?.[result.sessionId]?.retainedBy?.mainView ?? 0) > 0;
          if (check()) {
            resolve();
            return;
          }
          let off = () => {
          };
          const timeout = setTimeout(() => {
            off();
            reject(failure("NAVIGATION_TIMEOUT", "\u4E3B\u4F1A\u8BDD\u5C1A\u672A\u6253\u5F00\uFF0C\u8349\u7A3F\u5DF2\u4FDD\u7559\uFF0C\u8BF7\u5728 Harness \u4E2D\u67E5\u770B\u3002"));
          }, 5e3);
          const changed = () => {
            if (check()) {
              clearTimeout(timeout);
              off();
              resolve();
            }
          };
          off = list.subscribe(changed);
          changed();
        });
      }
      if (typeof globalThis.requestAnimationFrame === "function") {
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      }
      input.focus();
    });
    return result;
  }
  function subscribeErrors(listener) {
    if (typeof listener !== "function") throw new TypeError("listener must be a function");
    const remote = service(ctx, "remote");
    if (typeof remote?.$on !== "function") return () => {
    };
    return remote.$on("api-session/error", (id, message) => listener({ id, message: String(message) }));
  }
  return { getContext, openSession, sendMessage, stopSession, openMainComposer, createPetPrompt, subscribeErrors };
}

// src/work-chat.jsx
var import_react = __toESM(require("react"), 1);
var import_react_dom = require("react-dom");

// src/work-chat-model.mjs
var CHAT_PANEL = "dsh-deepseek-chat";
var DEEPSEEK_HOME = "https://chat.deepseek.com/";
var CHAT_PARTITION_KEY = "session:dsh-codex-mini-pet:deepseek-chat";
var MODE_SWITCH_LAYOUT = Object.freeze({ width: 252, compactWidth: 220, height: 48, headerHeight: 84 });
function newSessionMode({ activePanelId, sessions, chat }) {
  if (activePanelId === CHAT_PANEL) {
    if (chat?.status !== "ready" || chat.pendingUrl) return null;
    const destination = chatDestination(chat.url);
    return destination && /^\/(?:a\/[a-zA-Z0-9_-]+\/?)?$/.test(new URL(destination).pathname) ? "chat" : null;
  }
  if (activePanelId !== null) return null;
  const current = Object.values(sessions?.byId || {}).find((row) => (row.retainedBy?.mainView || 0) > 0);
  return (current ? current.blank === true : sessions?.phase === "ready") ? "work" : null;
}
function modeSwitchPosition(rect) {
  if (!rect || ![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) || rect.width <= 0 || rect.height <= 0) return null;
  return { left: rect.x + rect.width / 2, top: rect.y + (MODE_SWITCH_LAYOUT.headerHeight - MODE_SWITCH_LAYOUT.height) / 2, maxWidth: Math.max(0, rect.width - 32) };
}
function chatDestination(value) {
  if (typeof value !== "string" || !value.trim() || value.length > 8192) return null;
  try {
    const url = new URL(value, DEEPSEEK_HOME);
    if (url.origin !== new URL(DEEPSEEK_HOME).origin || url.username || url.password) return null;
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}
function chatSession(value) {
  const url = chatDestination(value);
  if (!url) return null;
  const path = new URL(url).pathname;
  const match = /^\/a\/([a-zA-Z0-9_-]+)\/s\/([a-zA-Z0-9_-]+)\/?$/.exec(path);
  return match ? { id: `${match[1]}:${match[2]}`, url: new URL(path, DEEPSEEK_HOME).href } : null;
}
function normalizeChatRows(rows) {
  const result = /* @__PURE__ */ new Map();
  for (const row of Array.isArray(rows) ? rows.slice(0, 500) : []) {
    const session = chatSession(row?.url);
    if (!session || typeof row.title !== "string") continue;
    const title = row.title.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
    if (title) result.set(session.id, { ...session, title });
  }
  return [...result.values()];
}
function createWorkChatController(layout) {
  let state = { opened: false, request: null, pendingUrl: null, rows: [], url: DEEPSEEK_HOME, title: "DeepSeek", status: "idle", error: "", revision: 0 };
  const listeners = /* @__PURE__ */ new Set();
  const set = (patch) => {
    if (Object.entries(patch).every(([key, value]) => state[key] === value)) return;
    state = { ...state, ...patch };
    for (const listener of listeners) listener();
  };
  return {
    getSnapshot: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    open(url) {
      const destination = chatDestination(url ?? state.url);
      if (!destination) throw new Error("\u53EA\u80FD\u6253\u5F00 DeepSeek \u5B98\u65B9\u804A\u5929\u9875\u9762\u3002");
      if (!state.opened || url !== void 0) set({ opened: true, request: { url: destination, revision: state.revision + 1 }, pendingUrl: destination, revision: state.revision + 1 });
      layout.selectPanel(CHAT_PANEL);
    },
    work() {
      layout.selectPanel(null);
    },
    report(patch) {
      set(patch);
    },
    observe(snapshot) {
      const url = chatDestination(snapshot?.url);
      if (!url) return;
      if (/^\/(sign_in|sign_up|forgot_password|mobile_verification)(\/|$)/.test(new URL(url).pathname)) {
        set({ url, pendingUrl: null, rows: [], title: "DeepSeek", status: "sign-in", error: "" });
        return;
      }
      const incoming = !snapshot.rows?.length && !snapshot.navigationReady ? state.rows : normalizeChatRows(snapshot.rows);
      const rows = JSON.stringify(incoming) === JSON.stringify(state.rows) ? state.rows : incoming;
      const current = chatSession(url);
      const title = rows.find((row) => row.id === current?.id)?.title || String(snapshot.title || "DeepSeek").slice(0, 160);
      const pendingUrl = state.pendingUrl && new URL(state.pendingUrl).pathname.replace(/\/$/, "") !== new URL(url).pathname.replace(/\/$/, "") ? state.pendingUrl : null;
      set({ url, pendingUrl, title, rows, status: "ready", error: "" });
    }
  };
}

// src/deepseek-page.mjs
function findConversationShareControl() {
  if (!/^\/a\/[a-zA-Z0-9_-]+\/s\/[a-zA-Z0-9_-]+\/?$/.test(location.pathname)) return null;
  const excluded = '[role="dialog"],[aria-modal="true"],dialog,[role="menu"],[data-dhp-site-sidebar],aside,nav,article,[role="article"],[data-message-id],[data-testid*="message"],.ds-modal-wrapper,.ds-modal';
  const candidates = [.../* @__PURE__ */ new Set([
    ...document.querySelectorAll('button,[role="button"]'),
    // DeepSeek's icon controls may be clickable .ds-icon-button divs with no button role.
    ...document.querySelectorAll(".ds-icon-button")
  ])];
  const pattern = /\bshare\b|分享/i;
  const labelOf = (element) => [...["aria-label", "title", "data-tooltip-content", "data-testid"].map((name) => element.getAttribute(name) || ""), element.textContent || ""].join(" ").trim();
  const shareIcons = [{ "viewBox": "0 0 16 16", "path": "M7.95889 1.52285C7.95888 0.826234 8.76055 0.467983 9.27669 0.875208L9.37524 0.967191L15.1317 7.18358C15.5582 7.64419 15.5582 8.35614 15.1317 8.81676L9.37524 15.0331C8.87034 15.578 7.95888 15.2205 7.95889 14.4775V10.8207C7.10614 10.8432 6.31361 10.9316 5.45468 11.2515C4.39484 11.6463 3.18248 12.413 1.64676 13.9425C1.4533 14.135 1.18329 14.1696 0.969086 14.0908C0.74748 14.0091 0.547307 13.7879 0.54859 13.4844L0.55516 13.1315C0.618924 11.3494 1.11153 9.29838 2.27656 7.63787C3.45289 5.96147 5.29554 4.71635 7.95889 4.54797V1.52285ZM9.20911 5.13366C9.20899 5.50567 8.9031 5.77687 8.56523 5.77755C5.99383 5.78282 4.33736 6.8762 3.29964 8.35496C2.54519 9.43014 2.10739 10.7283 1.9152 11.9939C3.04749 11.0323 4.0569 10.4385 5.01917 10.0801C6.29638 9.60449 7.4406 9.56343 8.56429 9.56295C8.9178 9.5628 9.20894 9.84909 9.20911 10.2068L9.20817 13.3737L14.1837 8.00017L9.20817 2.62571L9.20911 5.13366Z" }, { "viewBox": "0 0 20 20", "path": "M9.73047 1.98239C9.73046 1.21153 10.6128 0.810523 11.1895 1.25486L11.3008 1.35544L18.3906 8.83005C18.8698 9.33527 18.8696 10.1273 18.3906 10.6328L11.3008 18.1152C10.735 18.7123 9.73046 18.3118 9.73047 17.4892V12.9765C9.05058 12.9603 8.23982 12.9642 7.26075 13.206C5.95079 13.5297 4.32474 14.294 2.49512 16.1133C2.27349 16.3334 1.96525 16.3697 1.72364 16.2793C1.47489 16.1859 1.24879 15.9363 1.25 15.5937L1.25879 15.167C1.33996 13.0226 1.97201 10.7003 3.34278 8.85642C4.71905 7.00534 6.81702 5.67342 9.73047 5.48728V1.98239ZM11.1504 6.15427C11.1502 6.57441 10.8056 6.88304 10.4209 6.88376C7.60432 6.88909 5.7029 8.06242 4.48243 9.70407C3.57516 10.9245 3.03042 12.426 2.79981 13.9394C4.29988 12.7446 5.69229 12.1304 6.91993 11.8271C8.47348 11.4433 9.75076 11.5693 10.4229 11.5713C10.8512 11.5725 11.1504 11.926 11.1504 12.3017V16.209L17.2881 9.73142L11.1504 3.25974V6.15427Z" }];
  const knownShareIcon = (element) => {
    const svg = element.querySelector("svg");
    if (!svg) return false;
    const viewBox = (svg.getAttribute("viewBox") || "").trim().replace(/\s+/g, " ");
    const paths = [...svg.querySelectorAll("path")];
    if (paths.length !== 1) return false;
    const path = (paths[0].getAttribute("d") || "").replace(/\s+/g, "");
    return shareIcons.some((icon) => icon.viewBox === viewBox && icon.path.replace(/\s+/g, "") === path);
  };
  const hasShareIdentity = (element) => {
    const label = labelOf(element);
    return pattern.test(label) || !label && knownShareIcon(element);
  };
  for (const element of candidates) {
    if (Object.hasOwn(element.dataset, "dhpSiteShare") && (element.closest(excluded) || !hasShareIdentity(element))) delete element.dataset.dhpSiteShare;
  }
  const marked = candidates.find((element) => Object.hasOwn(element.dataset, "dhpSiteShare") && !element.closest(excluded) && hasShareIdentity(element));
  if (marked) return marked;
  const controls = candidates.filter((element) => {
    if (element.closest(excluded)) return false;
    const label = labelOf(element);
    const box = element.getBoundingClientRect();
    return pattern.test(label) && box.width > 0 && box.height > 0 && box.height <= 65 && box.top >= 0 && box.top < 100 && box.right >= innerWidth * 0.8;
  });
  if (controls.length) return controls[0];
  const unlabeled = candidates.filter((element) => {
    if (element.closest(excluded) || labelOf(element) || !knownShareIcon(element)) return false;
    const box = element.getBoundingClientRect();
    return box.width >= 20 && box.width <= 64 && box.height >= 20 && box.height <= 64 && box.top >= 0 && box.top < 85 && box.right >= innerWidth * 0.92;
  });
  return unlabeled.length === 1 ? unlabeled[0] : null;
}
function compactDeepSeekChrome(findShareControl = findConversationShareControl) {
  if (location.origin !== "https://chat.deepseek.com" || /^\/(sign_in|sign_up|forgot_password|mobile_verification)/.test(location.pathname)) return false;
  const currentPath = location.pathname.replace(/\/$/, "");
  const currentConversation = [...document.querySelectorAll("a[href]")].find((a) => {
    try {
      const url = new URL(a.href);
      return url.origin === location.origin && url.pathname.replace(/\/$/, "") === currentPath;
    } catch {
      return false;
    }
  });
  const currentTitle = (currentConversation?.getAttribute("title") || currentConversation?.textContent || "").replace(/\s+/g, " ").trim();
  const shareButton = findShareControl();
  for (let parent2 = shareButton?.parentElement, step = 0; parent2 && step < 8; step++, parent2 = parent2.parentElement) {
    const box = parent2.getBoundingClientRect();
    if (box.top >= 0 && box.top < 100 && box.height > 0 && box.height <= 100 && box.width >= innerWidth * 0.5) {
      parent2.dataset.dhpSessionHeader = "";
      break;
    }
  }
  if (!document.getElementById("dhp-deepseek-chrome")) {
    const style = document.createElement("style");
    style.id = "dhp-deepseek-chrome";
    style.textContent = "[data-dhp-site-chrome], [data-dhp-site-sidebar], [data-dhp-session-heading], [data-dhp-site-share]{display:none!important}";
    document.head.append(style);
  }
  const buttons = [...document.querySelectorAll("button,[role=button]")].filter((element) => {
    const box = element.getBoundingClientRect();
    return box.width > 0 && box.left < 260 && box.top >= 0 && box.top < 65 && box.height < 65;
  });
  for (const button of buttons) {
    let parent2 = button.parentElement;
    for (let step = 0; parent2 && step < 4; step++, parent2 = parent2.parentElement) {
      const box = parent2.getBoundingClientRect(), count = parent2.querySelectorAll("button,[role=button]").length;
      if (box.width >= 80 && box.width <= 320 && box.height > 0 && box.height <= 65 && count >= 2 && count <= 4 && !parent2.querySelector("input,textarea,[contenteditable=true]")) {
        parent2.dataset.dhpSiteChrome = "";
        break;
      }
    }
  }
  for (const svg of document.querySelectorAll("svg")) {
    const box = svg.getBoundingClientRect();
    if (box.left >= 0 && box.left < 45 && box.top >= 0 && box.top < 65 && box.width >= 24 && box.width <= 60 && box.height >= 20 && box.height <= 60) {
      const link = svg.closest("a");
      (link && link.getBoundingClientRect().width <= 90 ? link : svg).dataset.dhpSiteChrome = "";
    }
  }
  const anchor = [...document.querySelectorAll("a[href]")].find((a) => /^\/a\/[^/]+\/s\/[^/]+\/?$/.test(new URL(a.href).pathname));
  let parent = anchor?.parentElement;
  for (let step = 0; parent && step < 12; step++, parent = parent.parentElement) {
    const box = parent.getBoundingClientRect();
    if (box.left >= 0 && box.left < 45 && box.width >= 180 && box.width <= 360 && box.height >= innerHeight * 0.55) {
      parent.dataset.dhpSiteSidebar = "";
      break;
    }
  }
  if (currentTitle) {
    const exclusions = 'a,button,[role="button"],[role="dialog"],[aria-modal="true"],dialog,[role="menu"],[data-dhp-site-sidebar],aside,nav,article,[role="article"],[data-message-id],[data-testid*="message"],.ds-modal-wrapper,.ds-modal';
    const inHeader = (element) => {
      if (element.closest(exclusions)) return false;
      if (element.closest('header,[role="banner"],[data-dhp-session-header]')) return true;
      const box = element.getBoundingClientRect();
      return box.top >= 0 && box.top < 85 && box.height > 0 && box.height <= 55;
    };
    const markedHeading = [...document.querySelectorAll("[data-dhp-session-heading]")].find((element) => inHeader(element) && (element.dataset.dhpSessionHeading === currentPath || element.textContent.replace(/\s+/g, " ").trim() === currentTitle));
    const heading = markedHeading || [...document.querySelectorAll('h1,h2,h3,[role="heading"],div,span,p')].filter((element) => {
      if (!inHeader(element)) return false;
      if (element.textContent.replace(/\s+/g, " ").trim() !== currentTitle) return false;
      const box = element.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && box.height <= 65 && box.top >= 0 && box.top < 100;
    }).sort((a, b) => {
      const semantic = (element) => /^(H1|H2|H3)$/.test(element.tagName) || element.getAttribute("role") === "heading";
      if (semantic(a) !== semantic(b)) return semantic(a) ? -1 : 1;
      const aa = a.getBoundingClientRect(), bb = b.getBoundingClientRect();
      return aa.width * aa.height - bb.width * bb.height;
    })[0];
    if (heading) heading.dataset.dhpSessionHeading = currentPath;
  }
  if (shareButton) shareButton.dataset.dhpSiteShare = "";
  return true;
}
var COMPACT_CHROME_SCRIPT = `(${compactDeepSeekChrome.toString()})(${findConversationShareControl.toString()})`;
function shareConversationOnPage(findShareControl = findConversationShareControl) {
  if (location.origin !== "https://chat.deepseek.com") return { ok: false, error: "\u8BF7\u5148\u6253\u5F00 DeepSeek \u5B98\u65B9\u804A\u5929\u9875\u9762\u3002" };
  const button = findShareControl();
  if (!button || button.disabled || button.getAttribute("aria-disabled") === "true") return { ok: false, error: "\u6682\u65F6\u627E\u4E0D\u5230\u5B98\u7F51\u5206\u4EAB\u6309\u94AE\uFF0C\u8BF7\u786E\u8BA4\u4F1A\u8BDD\u9875\u9762\u5DF2\u52A0\u8F7D\u3002" };
  button.click();
  return { ok: true };
}
var SHARE_CONVERSATION_SCRIPT = `(${shareConversationOnPage.toString()})(${findConversationShareControl.toString()})`;
function conversationNavigationScript(value) {
  const session = chatSession(value);
  if (!session) return null;
  return `(() => { if (location.origin !== 'https://chat.deepseek.com') return false; const path=${JSON.stringify(new URL(session.url).pathname)}; const link=Array.from(document.querySelectorAll('a[href]')).find(a=>new URL(a.href).origin===location.origin && new URL(a.href).pathname.replace(/\\/$/,'')===path); if (!link) return false; link.click(); return true; })()`;
}
async function manageOnPage(request) {
  if (location.origin !== "https://chat.deepseek.com") return { ok: false, error: "\u8BF7\u5148\u6253\u5F00 DeepSeek \u5B98\u65B9\u804A\u5929\u9875\u9762\u3002" };
  const wait = async (find) => {
    const until = Date.now() + 6e3;
    do {
      const value = find();
      if (value) return value;
      await new Promise((resolve) => setTimeout(resolve, 60));
    } while (Date.now() < until);
    return null;
  };
  if (document.querySelector('[role="dialog"],.ds-modal-wrapper')) return { ok: false, error: "\u8BF7\u5148\u5B8C\u6210\u6216\u5173\u95ED\u7F51\u9875\u4E2D\u7684\u5BF9\u8BDD\u6846\u3002" };
  const anchor = [...document.querySelectorAll("a[href]")].find((a) => new URL(a.href).origin === location.origin && new URL(a.href).pathname.replace(/\/$/, "") === request.path);
  if (!anchor) return { ok: false, error: "\u8FD9\u6761\u4F1A\u8BDD\u5C1A\u672A\u5728\u7F51\u9875\u4E2D\u52A0\u8F7D\uFF0C\u8BF7\u5148\u6253\u5F00\u5B83\u540E\u91CD\u8BD5\u3002" };
  const menuButton = anchor.querySelector(".ds-icon-button,button,[role=button]");
  if (!menuButton) return { ok: false, error: "\u7F51\u9875\u7684\u4F1A\u8BDD\u83DC\u5355\u6682\u4E0D\u53EF\u7528\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u8BD5\u3002" };
  const previousInputs = new Set(document.querySelectorAll("input"));
  menuButton.click();
  const labels = request.action === "rename" ? /^(重命名|Rename)$/i : /^(删除|删除会话|Delete|Delete chat)$/i;
  const option = await wait(() => [...document.querySelectorAll('[role="menu"] .ds-dropdown-menu-option')].find((element) => labels.test((element.querySelector(".ds-dropdown-menu-option__label")?.textContent || "").trim())));
  if (!option) return { ok: false, error: "\u672A\u627E\u5230\u5B98\u7F51\u7684\u4F1A\u8BDD\u64CD\u4F5C\uFF0C\u8BF7\u5728\u7F51\u9875\u4E2D\u64CD\u4F5C\u540E\u91CD\u8BD5\u3002" };
  option.click();
  if (request.action === "delete") {
    const confirmation = await wait(() => document.querySelector('[role="dialog"],.ds-modal-wrapper,.ds-modal'));
    return confirmation ? { ok: true, confirmationRequired: true } : { ok: false, error: "\u5B98\u7F51\u672A\u663E\u793A\u5220\u9664\u786E\u8BA4\uFF0C\u8BF7\u5728\u7F51\u9875\u4E2D\u786E\u8BA4\u72B6\u6001\u3002" };
  }
  const field = await wait(() => [...document.querySelectorAll("input")].find((input) => !previousInputs.has(input) && input.maxLength === 1024));
  if (!field) return { ok: false, error: "\u672A\u627E\u5230\u5B98\u7F51\u7684\u91CD\u547D\u540D\u8F93\u5165\u6846\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u8BD5\u3002" };
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (!setter) return { ok: false, error: "\u7F51\u9875\u8F93\u5165\u6846\u6682\u4E0D\u53EF\u7528\u3002" };
  setter.call(field, request.title);
  field.dispatchEvent(new Event("input", { bubbles: true }));
  field.dispatchEvent(new Event("change", { bubbles: true }));
  field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
  const updated = await wait(() => [...document.querySelectorAll("a[href]")].find((a) => new URL(a.href).origin === location.origin && new URL(a.href).pathname.replace(/\/$/, "") === request.path && (a.getAttribute("title") || a.textContent || "").trim() === request.title));
  return updated ? { ok: true, renamed: true } : { ok: false, error: "\u5C1A\u672A\u786E\u8BA4\u91CD\u547D\u540D\u7ED3\u679C\uFF0C\u8BF7\u68C0\u67E5\u5B98\u7F51\u63D0\u793A\u3002" };
}
function managementScript(row, action, title) {
  const session = chatSession(row?.url);
  if (!session || !["rename", "delete"].includes(action)) throw new Error("\u4F1A\u8BDD\u64CD\u4F5C\u65E0\u6548\u3002");
  if (action === "rename" && (typeof title !== "string" || !title.trim() || title.trim().length > 160)) throw new Error("\u4F1A\u8BDD\u540D\u79F0\u9700\u8981 1\u2013160 \u4E2A\u5B57\u3002");
  return `(${manageOnPage.toString()})(${JSON.stringify({ path: new URL(session.url).pathname, action, ...action === "rename" ? { title: title.trim() } : {} })})`;
}

// src/deepseek-guest.mjs
var CHAT_NAVIGATION_SCRIPT = String.raw`(() => ({ url: location.origin + location.pathname, title: document.title, navigationReady: !!document.querySelector('[data-dhp-site-sidebar]'), rows: Array.from(document.querySelectorAll('a[href]'), a => ({url:a.href, title:a.getAttribute('title') || a.textContent || ''})).filter(a => /^https:\/\/chat\.deepseek\.com\/a\/[a-zA-Z0-9_-]+\/s\/[a-zA-Z0-9_-]+\/?(?:[?#].*)?$/.test(a.url)).slice(0,500) }))()`;
function createDeepSeekGuest({ bridge, host, report, observe, document: dom = globalThis.document }) {
  let element, lease, unsubscribe, ready = false, stopped = false, initializing, pending = DEEPSEEK_HOME, scanning = false, scanAgain = false, navigation = 0;
  const events = new AbortController();
  const fail = (error) => {
    if (!stopped) report({ status: "error", error: error?.message || "DeepSeek \u7F51\u9875\u6682\u65F6\u65E0\u6CD5\u52A0\u8F7D\uFF0C\u8BF7\u91CD\u8BD5\u3002" });
  };
  const scan = async () => {
    if (stopped || !ready || !element) return;
    if (scanning) {
      scanAgain = true;
      return;
    }
    scanning = true;
    const revision = navigation;
    try {
      const owned = element;
      if (!chatDestination(owned.getURL())) return;
      await owned.executeJavaScript(COMPACT_CHROME_SCRIPT).catch(() => {
      });
      const snapshot = await owned.executeJavaScript(CHAT_NAVIGATION_SCRIPT);
      if (!stopped && element === owned) {
        if (revision === navigation) observe(snapshot);
        else scanAgain = true;
      }
    } catch (error) {
      if (!stopped) report({ error: "\u7F51\u9875\u5DF2\u6253\u5F00\uFF0C\u4F1A\u8BDD\u5217\u8868\u6682\u672A\u540C\u6B65\u3002\u53EF\u5728\u7F51\u9875\u4E2D\u7EE7\u7EED\u4F7F\u7528\u3002" });
    } finally {
      scanning = false;
      if (scanAgain && !stopped) {
        scanAgain = false;
        void scan();
      }
    }
  };
  const loadPending = async () => {
    if (stopped || !ready || !pending) return;
    const url = pending, owned = element, revision = ++navigation;
    pending = null;
    try {
      if (owned.getURL() === url) {
        scan();
        return;
      }
      const script = chatDestination(owned.getURL()) && conversationNavigationScript(url);
      if (script) {
        const switched = await owned.executeJavaScript(script);
        if (stopped || element !== owned || revision !== navigation) return;
        if (switched === true) {
          scan();
          return;
        }
      }
      if (stopped || element !== owned || revision !== navigation) return;
      report({ status: "loading", error: "" });
      await owned.loadURL(url);
    } catch (error) {
      if (!stopped && element === owned && revision === navigation && error?.code !== "ERR_ABORTED") fail(error);
    }
  };
  const start = () => {
    if (initializing || element || stopped) return initializing;
    if (!bridge?.acquire || !bridge?.release) {
      fail(new Error("\u804A\u5929\u6A21\u5F0F\u9700\u8981 Harness \u684C\u9762\u7248\u7684\u5185\u5D4C\u6D4F\u89C8\u5668\u652F\u6301\u3002"));
      return Promise.resolve();
    }
    initializing = (async () => {
      const reservation = await bridge.acquire(CHAT_PARTITION_KEY);
      if (stopped) {
        await bridge.release(reservation.lease);
        return;
      }
      lease = reservation.lease;
      element = dom.createElement("webview");
      element.className = "dhp-deepseek-webview";
      element.dataset.sidebarBrowserFrame = "webview";
      element.setAttribute("aria-label", "DeepSeek \u5B98\u65B9\u804A\u5929\u7F51\u9875");
      element.setAttribute("name", lease);
      element.setAttribute("partition", reservation.partition);
      element.setAttribute("allowpopups", "");
      element.setAttribute("src", `about:blank#${lease}`);
      const on = (name, callback) => element.addEventListener(name, callback, { signal: events.signal });
      on("dom-ready", () => {
        ready = true;
        loadPending();
        scan();
      });
      for (const name of ["did-navigate", "did-navigate-in-page", "page-title-updated", "did-stop-loading"]) on(name, scan);
      on("did-start-loading", () => {
        if (!stopped) report({ status: "loading", error: "" });
      });
      on("did-fail-load", (event) => {
        if (event.isMainFrame && event.errorCode !== -3) fail(new Error(event.errorDescription || "DeepSeek \u7F51\u9875\u52A0\u8F7D\u5931\u8D25\u3002"));
      });
      on("render-process-gone", () => {
        ready = false;
        fail(new Error("\u7F51\u9875\u8FDB\u7A0B\u5DF2\u9000\u51FA\uFF0C\u8BF7\u5173\u95ED\u540E\u91CD\u65B0\u6253\u5F00\u804A\u5929\u6A21\u5F0F\u3002"));
      });
      unsubscribe = bridge.onOpenRequested?.(lease, (url) => {
        const destination = chatDestination(url);
        if (destination) {
          pending = destination;
          loadPending();
        }
      });
      host.append(element);
    })().catch(fail).finally(() => {
      initializing = null;
    });
    return initializing;
  };
  return {
    start,
    navigate(url) {
      const destination = chatDestination(url);
      if (!destination) throw new Error("DeepSeek \u7F51\u9875\u5730\u5740\u65E0\u6548\u3002");
      pending = destination;
      loadPending();
    },
    scan,
    async manage(row, action, title) {
      const script = managementScript(row, action, title);
      if (!ready || !element || !chatDestination(element.getURL())) throw new Error("\u8BF7\u7B49\u5F85 DeepSeek \u7F51\u9875\u52A0\u8F7D\u5B8C\u6210\u3002");
      const result = await element.executeJavaScript(script);
      if (!result?.ok) throw new Error(result?.error || "\u7F51\u9875\u64CD\u4F5C\u672A\u5B8C\u6210\uFF0C\u8BF7\u91CD\u8BD5\u3002");
      await scan();
      return result;
    },
    async share() {
      if (!ready || !element || !chatDestination(element.getURL())) throw new Error("\u8BF7\u7B49\u5F85 DeepSeek \u7F51\u9875\u52A0\u8F7D\u5B8C\u6210\u3002");
      const result = await element.executeJavaScript(SHARE_CONVERSATION_SCRIPT);
      if (!result?.ok) throw new Error(result?.error || "\u6682\u65F6\u627E\u4E0D\u5230\u5B98\u7F51\u5206\u4EAB\u6309\u94AE\uFF0C\u8BF7\u786E\u8BA4\u4F1A\u8BDD\u9875\u9762\u5DF2\u52A0\u8F7D\u3002");
      return result;
    },
    async reload() {
      if (ready) {
        report({ status: "loading", error: "" });
        try {
          element.reload();
        } catch (error) {
          fail(error);
        }
        return;
      }
      await initializing;
      if (stopped) return;
      unsubscribe?.();
      unsubscribe = null;
      element?.remove();
      element = null;
      if (lease) {
        const previous = lease;
        lease = null;
        await bridge.release(previous).catch(() => {
        });
      }
      report({ status: "loading", error: "" });
      pending = pending || DEEPSEEK_HOME;
      return start();
    },
    async dispose() {
      if (stopped) return;
      stopped = true;
      events.abort();
      unsubscribe?.();
      element?.remove();
      if (lease) {
        const owned = lease;
        lease = null;
        await bridge.release(owned).catch(() => {
        });
      }
      await initializing;
    }
  };
}

// src/i18n.mjs
var LANGUAGES = Object.freeze([
  { value: "zh-CN", label: "\u7B80\u4F53\u4E2D\u6587" },
  { value: "en", label: "English" }
]);
var ENGLISH_MESSAGES = Object.freeze({
  "\u8BF7\u5148\u6253\u5F00\u804A\u5929\u7F51\u9875\u540E\u91CD\u8BD5\u3002": "Open the chat website first, then try again.",
  "\u641C\u7D22\u804A\u5929\u6807\u9898": "Search chat titles",
  "\u7BA1\u7406\u4F1A\u8BDD\uFF1A{title}": "Manage conversation: {title}",
  "\u6CA1\u6709\u5339\u914D\u7684\u804A\u5929\u6807\u9898\u3002": "No matching chat titles.",
  "\u4F1A\u8BDD\u64CD\u4F5C": "Conversation actions",
  "\u91CD\u547D\u540D": "Rename",
  "\u91CD\u547D\u540D\u804A\u5929": "Rename chat",
  "\u4F1A\u8BDD\u540D\u79F0": "Conversation name",
  "\u6B63\u5728\u4FDD\u5B58\u2026": "Saving\u2026",
  "\u4FDD\u5B58": "Save",
  "\u8BF7\u7B49\u5F85 DeepSeek \u7F51\u9875\u52A0\u8F7D\u5B8C\u6210\u3002": "Wait for the DeepSeek website to finish loading.",
  "\u8BF7\u5148\u6253\u5F00 DeepSeek \u5B98\u65B9\u804A\u5929\u9875\u9762\u3002": "Open the official DeepSeek chat website first.",
  "\u8BF7\u5148\u5B8C\u6210\u6216\u5173\u95ED\u7F51\u9875\u4E2D\u7684\u5BF9\u8BDD\u6846\u3002": "Complete or close the dialog on the website first.",
  "\u8FD9\u6761\u4F1A\u8BDD\u5C1A\u672A\u5728\u7F51\u9875\u4E2D\u52A0\u8F7D\uFF0C\u8BF7\u5148\u6253\u5F00\u5B83\u540E\u91CD\u8BD5\u3002": "This conversation is not loaded on the website. Open it first, then try again.",
  "\u7F51\u9875\u7684\u4F1A\u8BDD\u83DC\u5355\u6682\u4E0D\u53EF\u7528\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u8BD5\u3002": "The website conversation menu is unavailable. Reload and retry.",
  "\u672A\u627E\u5230\u5B98\u7F51\u7684\u4F1A\u8BDD\u64CD\u4F5C\uFF0C\u8BF7\u5728\u7F51\u9875\u4E2D\u64CD\u4F5C\u540E\u91CD\u8BD5\u3002": "The official conversation action could not be found. Try it on the website.",
  "\u5B98\u7F51\u672A\u663E\u793A\u5220\u9664\u786E\u8BA4\uFF0C\u8BF7\u5728\u7F51\u9875\u4E2D\u786E\u8BA4\u72B6\u6001\u3002": "The website did not show a delete confirmation. Check the website.",
  "\u672A\u627E\u5230\u5B98\u7F51\u7684\u91CD\u547D\u540D\u8F93\u5165\u6846\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u8BD5\u3002": "The website rename field could not be found. Reload and retry.",
  "\u7F51\u9875\u8F93\u5165\u6846\u6682\u4E0D\u53EF\u7528\u3002": "The website input field is unavailable.",
  "\u5C1A\u672A\u786E\u8BA4\u91CD\u547D\u540D\u7ED3\u679C\uFF0C\u8BF7\u68C0\u67E5\u5B98\u7F51\u63D0\u793A\u3002": "The rename could not be confirmed. Check the website notice.",
  "\u7F51\u9875\u64CD\u4F5C\u672A\u5B8C\u6210\uFF0C\u8BF7\u91CD\u8BD5\u3002": "The website action did not complete. Please retry.",
  "\u4F1A\u8BDD\u6A21\u5F0F": "Conversation mode",
  "\u804A\u5929": "Chat",
  "\u5DE5\u4F5C": "Work",
  "\u7F51\u9875\u804A\u5929\u4F1A\u8BDD": "Web chat conversations",
  "\u540C\u6B65\u7F51\u9875\u4F1A\u8BDD": "Sync web conversations",
  "\u65B0\u804A\u5929": "New chat",
  "\u5728 DeepSeek \u5F00\u59CB\u804A\u5929": "Start a chat in DeepSeek",
  "\u767B\u5F55\u5B98\u7F51\u540E\uFF0C\u4F1A\u8BDD\u663E\u793A\u5728\u8FD9\u91CC\u3002": "Your conversations appear here after signing in on the official website.",
  "\u540C\u6B65\u7F51\u9875\u4FA7\u680F\u4E2D\u7684\u804A\u5929\u4F1A\u8BDD\u3002": "Syncing conversations from the website sidebar.",
  "\u4E0E\u5DE5\u4F5C\u533A\u5206\u5F00\uFF0C\u8FDE\u63A5 DeepSeek \u5B98\u65B9\u7F51\u9875\u3002": "Separate from workspaces, connected to the official DeepSeek website.",
  "DeepSeek \u804A\u5929\u6A21\u5F0F": "DeepSeek chat mode",
  "\u5237\u65B0\u7F51\u9875": "Reload website",
  "\u5206\u4EAB\u804A\u5929": "Share chat",
  "\u6682\u65F6\u627E\u4E0D\u5230\u5B98\u7F51\u5206\u4EAB\u6309\u94AE\uFF0C\u8BF7\u786E\u8BA4\u4F1A\u8BDD\u9875\u9762\u5DF2\u52A0\u8F7D\u3002": "The official share button is unavailable. Make sure a conversation is open.",
  "\u6B63\u5728\u6253\u5F00 DeepSeek \u5B98\u65B9\u7F51\u9875\u2026": "Opening the official DeepSeek website\u2026",
  "DeepSeek \u5B98\u65B9\u7F51\u9875": "Official DeepSeek website",
  "\u8BF7\u5728\u5B98\u7F51\u4F7F\u7528\u4E0E Harness \u76F8\u540C\u7684\u8D26\u53F7\u767B\u5F55\u3002": "Sign in on the official website with the same account you use in Harness.",
  "\u6682\u65F6\u65E0\u6CD5\u6253\u5F00\u804A\u5929\u7F51\u9875": "Unable to open the chat website",
  "\u91CD\u8BD5": "Retry",
  "\u8FD4\u56DE\u5DE5\u4F5C": "Back to Work",
  "\u804A\u5929\u6A21\u5F0F\u9700\u8981 Harness \u684C\u9762\u7248\u7684\u5185\u5D4C\u6D4F\u89C8\u5668\u652F\u6301\u3002": "Chat mode requires the embedded browser in Harness for desktop.",
  "\u7F51\u9875\u5DF2\u6253\u5F00\uFF0C\u4F1A\u8BDD\u5217\u8868\u6682\u672A\u540C\u6B65\u3002\u53EF\u5728\u7F51\u9875\u4E2D\u7EE7\u7EED\u4F7F\u7528\u3002": "The website is open, but its conversation list could not sync. You can continue on the website.",
  "DeepSeek \u7F51\u9875\u6682\u65F6\u65E0\u6CD5\u52A0\u8F7D\uFF0C\u8BF7\u91CD\u8BD5\u3002": "The DeepSeek website could not load. Please retry.",
  "DeepSeek \u7F51\u9875\u52A0\u8F7D\u5931\u8D25\u3002": "The DeepSeek website failed to load.",
  "\u7F51\u9875\u8FDB\u7A0B\u5DF2\u9000\u51FA\uFF0C\u8BF7\u5173\u95ED\u540E\u91CD\u65B0\u6253\u5F00\u804A\u5929\u6A21\u5F0F\u3002": "The website process closed. Reopen chat mode to continue.",
  "\u62D6\u52A8\u79FB\u52A8": "Drag to move",
  "\u81EA\u5B9A\u4E49\u5916\u89C2": "Customize",
  "Mini \u4E0E\u865A\u62DF\u5BA0\u7269": "Mini & pets",
  "\u6309\u4E0B": "Press",
  "\u5373\u53EF\u5524\u51FA\u4F19\u4F34\u5E76\u5F00\u59CB\u804A\u5929": "to show your companion and start chatting",
  "\u9690\u85CF Mini": "Hide Mini",
  "\u663E\u793A Mini": "Show Mini",
  "\u52A8\u4F5C\u9884\u89C8": "Preview animations",
  "\u6211\u7684\u865A\u62DF\u5BA0\u7269": "My pets",
  "\u5237\u65B0\u5BA0\u7269\u5E93": "Refresh pet library",
  "\u521B\u5EFA\u865A\u62DF\u5BA0\u7269": "Create a pet",
  "\u65E0": "None",
  "\u8F7B\u91CF\u6A21\u5F0F\uFF0C\u4FDD\u7559\u804A\u5929\u4E0E\u52A8\u6001": "Compact mode with chat and activity",
  "\u7BA1\u7406\u5F53\u524D\u4F19\u4F34": "Manage current pet",
  "\u8BBE\u7F6E \u203A codex-mini-pet \u4E2D\u7BA1\u7406\u5F62\u8C61": "Manage characters in Settings \u203A codex-mini-pet",
  "\u539F\u521B\u84DD\u767D\u9CB8\u9C7C\u5A18 Q \u7248\u684C\u9762\u4F19\u4F34\uFF1A\u9CB8\u9C7C\u5E3D\u3001\u6DF1\u84DD\u77ED\u53D1\u4E0E\u767D\u8272\u5218\u6D77\uFF0C\u652F\u6301\u4E5D\u7C7B\u52A8\u4F5C\u548C\u5341\u516D\u65B9\u5411\u6CE8\u89C6\u3002": "An original blue-and-white whale companion with a whale hat, dark-blue hair and white bangs. Nine animations and sixteen gaze directions.",
  "\u7528\u6237\u9009\u5B9A\u7684\u667A\u57DF\u98CE\u683C Q \u7248\u684C\u9762\u4F19\u4F34\uFF0C\u590D\u7528\u5DF2\u6279\u51C6\u7684\u767D\u53D1\u9ED1\u8863\u5BA0\u7269\u56FE\u96C6\u3002": "A Zhiyu-style companion with white hair and a black outfit, using the approved character sprite sheet.",
  "\u57FA\u4E8E\u7528\u6237\u63D0\u4F9B\u8BBE\u5B9A\u56FE\u7684\u84DD\u53D1\u9CB8\u9C7C\u5973\u4EC6\u98CE Q \u7248\u684C\u9762\u4F19\u4F34\uFF0C\u652F\u6301\u4E5D\u7C7B\u52A8\u4F5C\u548C\u5341\u516D\u65B9\u5411\u6CE8\u89C6\u3002": "A blue-haired, whale-and-maid-inspired chibi companion based on the user-provided character sheet, with nine animations and sixteen gaze directions.",
  "\u8BED\u8A00": "Language",
  "\u9009\u62E9\u754C\u9762\u8BED\u8A00\uFF0C\u7ACB\u5373\u751F\u6548\u3002": "Choose the interface language. Changes apply immediately.",
  "\u5F62\u8C61\u6682\u672A\u52A0\u8F7D": "Character not loaded",
  "\u51C6\u5907\u5F62\u8C61\u4E2D\u2026": "Loading character\u2026",
  "\u6587\u4EF6\u8BFB\u53D6\u5931\u8D25": "Could not read the file",
  "\u5BFC\u51FA\u6CA1\u6709\u8FD4\u56DE\u6587\u4EF6": "The export did not return a file",
  "\u8BF7\u4ECE\u66F4\u591A \u2192 \u8BBE\u7F6E\u6253\u5F00\u5BA0\u7269\u4F19\u4F34\u3002": "Open Pets from More \u2192 Settings.",
  "\u5DF2\u8F6C\u5165\u4E3B\u4F1A\u8BDD\u8349\u7A3F\uFF0C\u7531\u4F60\u53D1\u9001": "Added to the Harness draft. Send it when ready.",
  "\u6587\u4EF6\u8D85\u8FC7 24 MB\uFF0C\u8BF7\u538B\u7F29\u540E\u5BFC\u5165\u3002": "The file exceeds 24 MB. Compress it before importing.",
  "\u5DF2\u52A0\u5165\u5BA0\u7269\u5E93": "Added to your pet library",
  "\u5BFC\u5165\u7684\u81EA\u5B9A\u4E49\u4F19\u4F34": "Imported custom pet",
  "\u6587\u4EF6\u8D85\u8FC7 24 MB\uFF0C\u8BF7\u538B\u7F29\u540E\u6821\u9A8C\u3002": "The file exceeds 24 MB. Compress it before validating.",
  "\u7ED3\u6784\u6821\u9A8C\u901A\u8FC7\uFF0C\u53EF\u5BFC\u5165\u3002": "Structure validated. Ready to import.",
  "\u6821\u9A8C\u672A\u901A\u8FC7\uFF1A{details}": "Validation failed: {details}",
  "\u6587\u4EF6\u8D85\u8FC7 24 MB\u3002": "The file exceeds 24 MB.",
  "\u56FE\u96C6\u5DF2\u66FF\u6362\uFF0C\u4F19\u4F34 ID \u4E0E\u663E\u793A\u504F\u597D\u5DF2\u4FDD\u7559": "Sprite sheet replaced. Pet ID and preferences kept.",
  "\u5173\u95ED\u5B8C\u6210\u63D0\u9192": "Dismiss completion notice",
  "\u4EFB\u52A1\u5B8C\u6210\u5566": "Task complete",
  "\u67E5\u770B\u7ED3\u679C \u203A": "View result \u203A",
  "\u67E5\u770B\u7ED3\u679C  \u203A": "View result  \u203A",
  "\u5411\u6211\u6253\u62DB\u547C": "Say hello",
  "\u8DF3\u4E00\u4E0B": "Jump",
  "\u663E\u793A\u5BA0\u7269\u5F62\u8C61": "Show character",
  "\u7CBE\u7B80\u6A21\u5F0F": "Compact mode",
  "\u6536\u8D77\u4F19\u4F34": "Hide pet",
  "\u5524\u51FA\u4F19\u4F34": "Show pet",
  "\u8BBE\u7F6E \u203A \u5BA0\u7269\u4F19\u4F34 \u4E2D\u7BA1\u7406\u5F62\u8C61": "Manage characters in Settings \u203A Pets",
  "\u5BA0\u7269\u4F19\u4F34": "Pets",
  "\u9009\u62E9\u5F62\u8C61\uFF0C\u8BBE\u7F6E\u684C\u9762\u663E\u793A\u4E0E\u4E92\u52A8\u3002": "Choose a character and customize its appearance and behavior.",
  "\u5237\u65B0": "Refresh",
  "\u5BA0\u7269\u4F19\u4F34\u9009\u9879": "Pet options",
  "\u8FDE\u63A5\u4F19\u4F34\u5E93\u2026": "Loading pet library\u2026",
  "\u521D\u59CB\u4F19\u4F34": "Built-in pet",
  "\u81EA\u5B9A\u4E49\u4F19\u4F34": "Custom pet",
  "\u7ECF\u5178\u52A8\u4F5C": "Classic animations",
  "16 \u5411\u76EE\u5149": "16 gaze directions",
  "\u5185\u7F6E": "Built-in",
  "\u81EA\u5B9A\u4E49": "Custom",
  "\u4F19\u4F34\u540D\u79F0": "Pet name",
  "\u63CF\u8FF0": "Description",
  "\u5BFC\u51FA ZIP": "Export ZIP",
  "\u4F19\u4F34\u4FE1\u606F\u5DF2\u66F4\u65B0": "Pet details updated",
  "\u4FDD\u5B58\u4FE1\u606F": "Save details",
  "\u66FF\u6362\u56FE\u96C6": "Replace sprite sheet",
  "\u5DF2\u79FB\u51FA\u5BA0\u7269\u5E93": "Removed from your pet library",
  "\u786E\u8BA4\u5220\u9664\u6B64\u4F19\u4F34": "Confirm deletion",
  "\u5220\u9664": "Delete",
  "\u53D6\u6D88": "Cancel",
  "\u521B\u5EFA\u65B0\u4F19\u4F34\u2026": "Create a pet\u2026",
  "\u5347\u7EA7\u4E3A v2\u2026": "Upgrade to v2\u2026",
  "\u7CBE\u7B80\u6A21\u5F0F \xB7 \u53EA\u663E\u793A\u64CD\u4F5C\u680F": "Compact mode \xB7 toolbar only",
  "\u62D6\u52A8\u65F6\u5DE6\u53F3\u8DD1\u52A8 \xB7 \u70B9\u51FB\u6253\u62DB\u547C \xB7 \u5728\u64CD\u4F5C\u680F\u804A\u5929\u6216\u67E5\u770B\u52A8\u6001": "Drag to move \xB7 Click to say hello \xB7 Chat and check activity from the toolbar",
  "\u76EE\u5149\u65B9\u5411 \xB7 0\xB0 \u671D\u4E0A\uFF0C\u987A\u65F6\u9488": "Gaze direction \xB7 0\xB0 is up, clockwise",
  "\u5DE5\u4F5C\u3001\u7B49\u5F85\u548C\u786E\u8BA4\u72B6\u6001\u4F1A\u8DDF\u968F\u5F53\u524D\u5BF9\u8BDD\u81EA\u52A8\u5207\u6362\u3002\u9884\u89C8\u4EC5\u5728\u6B64\u9762\u677F\u64AD\u653E\u3002": "Working, waiting and review animations follow the current chat. Previews play only in this panel.",
  "\u684C\u9762\u7F6E\u9876": "Keep on desktop",
  "Harness \u5728\u540E\u53F0\u6216\u6700\u5C0F\u5316\u65F6\uFF0C\u4F19\u4F34\u4ECD\u663E\u793A\u5728\u684C\u9762\u4E0A\u3002": "Keep your pet on the desktop when Harness is in the background or minimized.",
  "\u72EC\u7ACB\u684C\u9762\u7A97\u53E3\u9002\u7528\u4E8E Windows \u684C\u9762\u7248 Harness\u3002": "The separate desktop window is available in Harness for Windows.",
  "\u684C\u9762\u7A97\u53E3\u6682\u4E0D\u53EF\u7528\uFF0C\u5DF2\u56DE\u5230\u5E94\u7528\u5185\u663E\u793A\u3002\u8BF7\u91CD\u542F Harness \u540E\u91CD\u8BD5\u3002": "The desktop window is unavailable. Your pet is shown in the app. Restart Harness to try again.",
  "\u4F19\u4F34\u5927\u5C0F": "Pet size",
  "\u663E\u793A\u4F19\u4F34": "Show pet",
  "\u6536\u8D77\u540E\u53EF\u5728\u6B64\u5904\u6216\u7528 /pet show \u5524\u56DE\u3002": "Show your pet again here or with /pet show.",
  "\u4FDD\u7559\u804A\u5929\u4E0E\u52A8\u6001\u64CD\u4F5C\uFF0C\u6682\u65F6\u6536\u8D77\u5F62\u8C61\u3002": "Keep Chat and Activity while hiding the character.",
  "\u663E\u793A\u65B9\u5F0F": "Visibility",
  "\u59CB\u7EC8\u663E\u793A": "Always visible",
  "\u6309\u9700\u663E\u793A \xB7 \u70B9\u51FB\u7A7A\u767D\u6536\u8D77": "On demand \xB7 click outside to hide",
  "\u76EE\u5149\u8DDF\u968F\u6307\u9488": "Follow pointer",
  "\u95F2\u6687\u65F6\u671D\u4F60\u7684\u9F20\u6807\u65B9\u5411\u671B\u4E00\u671B\u3002": "Look toward your pointer when idle.",
  "\u51CF\u5C11\u52A8\u6001\u6548\u679C": "Reduce motion",
  "\u7CFB\u7EDF\u5DF2\u542F\u7528\u51CF\u5C11\u52A8\u6001\u6548\u679C\u3002": "Reduce motion is enabled in your system settings.",
  "\u4FDD\u7559\u9759\u6001\u59FF\u6001\uFF0C\u51CF\u5C11\u5FAA\u73AF\u52A8\u4F5C\u3002": "Use still poses and reduce looping animations.",
  "\u91CD\u7F6E\u4F4D\u7F6E": "Reset position",
  "\u91CD\u7F6E\u5927\u5C0F": "Reset size",
  "\u504F\u597D\u4FDD\u5B58\u5728\u672C\u673A\u3002\u684C\u9762\u6A21\u5F0F\u4E0B\uFF0CCtrl+Alt+Shift+P \u53EF\u5728\u5176\u4ED6\u5E94\u7528\u4E2D\u5524\u51FA\u5FEB\u901F\u804A\u5929\uFF1B\u82E5\u70ED\u952E\u88AB\u5360\u7528\uFF0C\u53EF\u70B9\u51FB\u4F19\u4F34\u64CD\u4F5C\u680F\u3002\u5E94\u7528\u5185\u5FEB\u6377\u952E\u53EF\u5728 Harness \u8BBE\u7F6E\u4E2D\u8C03\u6574\u3002": "Preferences are saved locally. In desktop mode, Ctrl+Alt+Shift+P opens Chat from other apps. Use the toolbar if the shortcut is taken. In-app shortcuts can be changed in Harness settings.",
  "\u8BA9\u65B0\u4F19\u4F34\u52A0\u5165": "Add a new pet",
  "\u5BFC\u5165\u5BA0\u7269 ZIP \u5305\uFF0C\u6216\u900F\u660E PNG / WebP \u52A8\u4F5C\u56FE\u3002": "Import a pet ZIP, or a transparent PNG / WebP sprite sheet.",
  "v2\uFF1A1536 \xD7 2288 \xB7 9 \u7EC4\u52A8\u4F5C + 16 \u4E2A\u76EE\u5149\u65B9\u5411": "v2: 1536 \xD7 2288 \xB7 9 animations + 16 gaze directions",
  "\u9009\u62E9\u6587\u4EF6": "Choose file",
  "\u4E3A\u65B0\u4F19\u4F34\u53D6\u4E2A\u540D\u5B57": "Name your new pet",
  "\u5BFC\u5165\u4F19\u4F34": "Import pet",
  "\u5148\u68C0\u67E5\u52A8\u4F5C\u56FE": "Validate sprite sheet",
  "ZIP \u5305\u4FDD\u7559\u540D\u79F0\u4E0E\u63CF\u8FF0\uFF1B\u5355\u5F20\u56FE\u7247\u81EA\u52A8\u8BC6\u522B v1 / v2\u3002\u8BF7\u4F7F\u7528\u4F60\u6709\u6743\u4F7F\u7528\u7684\u5F62\u8C61\uFF0C\u5BFC\u5165\u524D\u4F1A\u68C0\u67E5\u6587\u4EF6\u7ED3\u6784\u3002": "ZIP imports keep names and descriptions. Images are detected as v1 or v2. Use artwork you have permission to use. File structure is checked before import.",
  "\u5FEB\u901F\u804A\u5929": "Quick chat",
  "\u804A\u4E00\u804A": "Chat",
  "\u4F19\u4F34\u5FEB\u901F\u804A\u5929": "Pet quick chat",
  "\u4EFB\u52A1\u52A8\u6001": "Task activity",
  "\u4EFB\u52A1\u52A8\u6001 {count} \u6761": "Task activity: {count}",
  "\u5DE5\u4F5C\u533A": "Workspace",
  "\u5FEB\u901F\u804A\u5929\u5DE5\u4F5C\u533A": "Quick chat workspace",
  "\u8BF7\u9009\u62E9\u5DE5\u4F5C\u533A": "Select a workspace",
  "\u6B63\u5728\u8BFB\u53D6\u5DE5\u4F5C\u533A\u2026": "Loading workspaces\u2026",
  "\u4F1A\u8BDD": "Chat",
  "\u53D1\u9001\u5230": "Send to",
  "+ \u65B0\u4F1A\u8BDD": "+ New chat",
  "\u5FEB\u901F\u804A\u5929\u5185\u5BB9": "Quick chat message",
  "\u6B64\u523B\uFF0C\u4F60\u60F3\u4E00\u8D77\u505A\u70B9\u4EC0\u4E48\uFF1F": "What would you like to work on?",
  "\u8FD9\u6761\u60F3\u6CD5\u5305\u542B\u4E0A\u4E0B\u6587\uFF0C\u8BF7\u8F6C\u5230\u4E3B\u4F1A\u8BDD\u7EE7\u7EED\u7F16\u8F91\u3002": "This message needs context. Continue editing in Harness.",
  "Enter \u53D1\u9001 \xB7 Shift+Enter \u6362\u884C": "Enter to send \xB7 Shift+Enter for a new line",
  "\u5728\u4E3B\u4F1A\u8BDD\u7F16\u8F91": "Edit in Harness",
  "\u5904\u7406\u4E2D\u2026": "Working\u2026",
  "\u53D1\u9001 \u2197": "Send \u2197",
  "\u6587\u4EF6\u3001@ \u4E0A\u4E0B\u6587\u3001\u6280\u80FD\u548C\u8BED\u97F3\u8F93\u5165\u53EF\u5728\u4E3B\u4F1A\u8BDD\u4E2D\u6DFB\u52A0\u3002\u8349\u7A3F\u8F6C\u5165\u540E\u7531\u4F60\u53D1\u9001\u3002": "Add files, @ context, skills or voice input in Harness. Review and send the transferred draft there.",
  "\u63D0\u9192\u5DF2\u6536\u8D77": "Notices hidden",
  "\u9700\u8981\u65F6\u53EF\u4EE5\u6062\u590D\u67E5\u770B\u3002": "Restore notices whenever you need them.",
  "\u6682\u65F6\u6CA1\u6709\u9700\u8981\u5173\u6CE8\u7684\u4EFB\u52A1\u3002": "No tasks need your attention right now.",
  "\u524D\u5F80\u5904\u7406": "Review in Harness",
  "\u6253\u5F00": "Open",
  "\u56DE\u590D": "Reply",
  "\u505C\u6B62": "Stop",
  "\u6536\u8D77": "Dismiss",
  "\u9759\u97F3": "Mute",
  "\u5173\u95ED\u4F19\u4F34\u64CD\u4F5C": "Close pet panel",
  "\u6709\u4E2A\u60F3\u6CD5\uFF1F\u968F\u65F6\u544A\u8BC9\u6211\u3002": "Have an idea? Tell me anytime.",
  "{count} \u9879\u8FDB\u5C55\uFF0C\u966A\u4F60\u4E00\u8D77\u7559\u610F\u3002": "Keeping an eye on {count} tasks with you.",
  "\u6062\u590D\u63D0\u9192": "Restore notices",
  "\uFF08\u5DF2\u9690\u85CF {count} \u6761\uFF09": " ({count} hidden)",
  "\u4F19\u4F34": "Library",
  "\u5916\u89C2\u4E0E\u884C\u4E3A": "Appearance & behavior",
  "\u52A8\u4F5C": "Animations",
  "\u5BFC\u5165": "Import",
  "\u5BA0\u7269\u4F19\u4F34\u8BBE\u7F6E": "Pet settings",
  "\u968F\u65F6\u51C6\u5907\u597D": "Ready when you are",
  "DeepSeek Harness \xB7 \u5BA0\u7269\u4F19\u4F34": "DeepSeek Harness \xB7 Pets",
  "\u52A8\u6001": "Activity",
  "\u5173\u95ED\u804A\u5929": "Close chat",
  "\u65B0\u4F1A\u8BDD \xB7 \u5DE5\u4F5C\u533A": "New chat \xB7 Workspace",
  "\u53D1\u9001": "Send",
  "\u5FEB\u901F\u804A\u5929\u4F1A\u8BDD": "Quick chat target",
  "\u5173\u95ED\u52A8\u6001": "Close activity",
  "\u67E5\u770B\u5B8C\u6210\u7684\u4EFB\u52A1": "View completed task",
  "\u6211\u5728\uFF0C\u968F\u65F6\u966A\u4F60\u4E00\u8D77\u3002": "I\u2019m here, ready to help.",
  "\u8BF7\u9009\u62E9": "Select\u2026",
  "\u663E\u793A / \u6536\u8D77\u5F62\u8C61": "Show / hide character",
  "\u6539\u4E3A\u5E94\u7528\u5185\u663E\u793A": "Show in Harness",
  "\u9690\u85CF\u4F19\u4F34": "Hide pet",
  "\u8BF7\u5148\u5728 Harness \u4E2D\u6DFB\u52A0\u5DE5\u4F5C\u533A": "Add a workspace in Harness first",
  "\u9009\u62E9\u65B0\u4F1A\u8BDD\u7684\u5DE5\u4F5C\u533A": "Choose a workspace for the new chat",
  "\u672A\u547D\u540D\u4F1A\u8BDD": "Untitled chat",
  "\u9009\u62E9\u672A\u5F52\u6863\u4F1A\u8BDD\uFF0C\u6216\u5F00\u59CB\u65B0\u4F1A\u8BDD": "Choose an unarchived chat, or start a new one",
  "\u8BF7\u5148\u9009\u62E9\u5DE5\u4F5C\u533A\u3002": "Select a workspace first.",
  "\u6B63\u5728\u6253\u5F00\u4E3B\u4F1A\u8BDD\u2026": "Opening Harness\u2026",
  "\u6B63\u5728\u53D1\u9001\u2026": "Sending\u2026",
  "Harness \u6682\u672A\u54CD\u5E94\uFF0C\u8BF7\u6253\u5F00\u4E3B\u7A97\u53E3\u68C0\u67E5\u3002": "Harness has not responded. Open its main window to check.",
  "\u4EFB\u52A1\u5DF2\u5B8C\u6210": "Task complete",
  "\u5DF2\u53D1\u9001\u5230 Harness": "Sent to Harness",
  "\u53D1\u9001\u5931\u8D25\uFF0C\u8BF7\u5728\u4E3B\u4F1A\u8BDD\u4E2D\u91CD\u8BD5\u3002": "Sending failed. Try again in Harness.",
  "\u5B89\u5FC3\u505A\u4F60\u7684\u4E8B\uFF0C\u65B0\u8FDB\u5C55\u4F1A\u51FA\u73B0\u5728\u8FD9\u91CC\u3002": "Focus on your work. New activity will appear here.",
  "{count} \u9879\u8FDB\u5C55 \xB7 \u70B9\u51FB\u56DE\u5230\u5BF9\u5E94\u4F1A\u8BDD": "{count} tasks \xB7 Click to open a chat",
  "\u90FD\u5B89\u6392\u597D\u4E86": "All caught up",
  "\u6682\u65F6\u6CA1\u6709\u9700\u8981\u5173\u6CE8\u7684\u4EFB\u52A1": "No tasks need your attention right now",
  "\u5F85\u673A": "Idle",
  "\u5411\u53F3\u8DD1": "Run right",
  "\u5411\u5DE6\u8DD1": "Run left",
  "\u6253\u62DB\u547C": "Wave",
  "\u8DF3\u8DC3": "Jump",
  "\u9047\u5230\u95EE\u9898": "Error",
  "\u7B49\u5F85": "Waiting",
  "\u5DE5\u4F5C\u4E2D": "Working",
  "\u68C0\u67E5": "Review",
  "\u9700\u8981\u4F60\u7684\u56DE\u5E94": "Needs your response",
  "\u9047\u5230\u4E86\u4E00\u70B9\u95EE\u9898": "Something went wrong",
  "\u5DF2\u5B8C\u6210\uFF0C\u5F85\u67E5\u770B": "Complete, ready to view",
  "\u6B63\u5728\u5DE5\u4F5C": "Working",
  "\u7B49\u5F85\u4F60\u7684\u786E\u8BA4": "Waiting for your approval",
  "\u4F60\u7684\u5DE5\u4F5C\u4F19\u4F34": "Your work companion",
  "\u8BF7\u5148\u8F93\u5165\u8981\u53D1\u9001\u7684\u5185\u5BB9\u3002": "Enter a message first.",
  "\u8BF7\u9009\u62E9\u4E00\u4E2A\u4F1A\u8BDD\u3002": "Choose a chat.",
  "\u8FD9\u4E2A\u4F1A\u8BDD\u5DF2\u5F52\u6863\u6216\u4E0D\u518D\u53EF\u7528\uFF0C\u8BF7\u91CD\u65B0\u9009\u62E9\u3002": "This chat was archived or is no longer available. Choose another.",
  "\u8BF7\u5148\u9009\u62E9\u5DE5\u4F5C\u533A\uFF1B\u65B0\u4F1A\u8BDD\u5C06\u5728\u4F60\u9009\u62E9\u7684\u76EE\u5F55\u4E2D\u521B\u5EFA\u3002": "Choose a workspace first. The new chat will be created in that directory.",
  "\u5F53\u524D\u73AF\u5883\u672A\u63D0\u4F9B Harness \u4F1A\u8BDD\u64CD\u4F5C\uFF0C\u8BF7\u5728\u5DF2\u5B89\u88C5\u63D2\u4EF6\u7684\u5BBF\u4E3B\u4E2D\u4F7F\u7528\u3002": "Harness chat actions are unavailable in this environment. Use the installed plugin in Harness.",
  "\u5F53\u524D\u73AF\u5883\u4E0D\u652F\u6301\u521B\u5EFA\u539F\u751F\u4F1A\u8BDD\u3002": "This environment does not support creating Harness chats.",
  "\u5F53\u524D\u73AF\u5883\u672A\u63D0\u4F9B\u539F\u751F\u4F1A\u8BDD\u5BFC\u822A\u3002": "Harness chat navigation is unavailable in this environment.",
  "\u542B @\u3001$ \u6216\u547D\u4EE4\u7684\u5185\u5BB9\u8BF7\u4F7F\u7528\u201C\u5728\u4E3B\u4F1A\u8BDD\u7F16\u8F91\u201D\uFF0C\u901A\u8FC7\u539F\u751F\u8F93\u5165\u680F\u9009\u62E9\u4E0A\u4E0B\u6587\u540E\u53D1\u9001\u3002": "Use \u201CEdit in Harness\u201D for @ context, skills or commands, then send from its composer.",
  "\u5BBF\u4E3B\u672A\u63A5\u53D7\u8FD9\u6761\u6D88\u606F\u3002": "Harness did not accept this message.",
  "\u5BBF\u4E3B\u672A\u80FD\u505C\u6B62\u8FD9\u4E2A\u4F1A\u8BDD\u3002": "Harness could not stop this chat.",
  "\u8349\u7A3F\u5185\u5BB9\u5FC5\u987B\u662F\u6587\u5B57\u3002": "The draft must be text.",
  "\u5F53\u524D\u73AF\u5883\u672A\u63D0\u4F9B\u539F\u751F\u8F93\u5165\u680F\u3002": "The Harness composer is unavailable in this environment.",
  "\u539F\u751F\u8F93\u5165\u680F\u6B63\u5728\u5904\u7406\u5185\u5BB9\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\uFF1B\u539F\u6709\u8349\u7A3F\u5DF2\u4FDD\u7559\u3002": "The Harness composer is busy. Try again shortly. Your draft has been kept.",
  "\u4E3B\u4F1A\u8BDD\u5C1A\u672A\u6253\u5F00\uFF0C\u8349\u7A3F\u5DF2\u4FDD\u7559\uFF0C\u8BF7\u5728 Harness \u4E2D\u67E5\u770B\u3002": "The chat has not opened yet. Your draft has been kept. Check Harness.",
  "{name}\uFF0C\u70B9\u51FB\u6253\u62DB\u547C\uFF0C\u62D6\u52A8\u79FB\u52A8\uFF0C\u65B9\u5411\u952E\u8C03\u6574\u4F4D\u7F6E\uFF0C\u53F3\u952E\u6253\u5F00\u83DC\u5355": "{name}. Click to say hello, drag to move, use arrow keys to adjust, or right-click for the menu."
});
var chineseByEnglish = new Map(Object.entries(ENGLISH_MESSAGES).map(([zh, en]) => [en, zh]));
function translate(language, source, values = {}) {
  if (typeof source !== "string") return source;
  const text = language === "en" ? Object.hasOwn(ENGLISH_MESSAGES, source) ? ENGLISH_MESSAGES[source] : source : chineseByEnglish.get(source) ?? source;
  return text.replace(/\{(\w+)\}/g, (match, key) => Object.hasOwn(values, key) ? String(values[key]) : match);
}
function createTranslator(language = "zh-CN") {
  return (source, values) => translate(language, source, values);
}

// src/work-chat.jsx
var import_jsx_runtime = require("react/jsx-runtime");
var workChatCss = `
.dhp-wc{font:inherit;color:var(--dsw-alias-label-primary,#202123)}.dhp-wc *{box-sizing:border-box}.dhp-wc button{font:inherit;color:inherit;cursor:pointer}.dhp-wc button:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#5178ef);outline-offset:3px}.dhp-wc button:disabled{cursor:default;opacity:.5}.dhp-wc-modes{display:flex;align-items:center;gap:3px;padding:4px;border-radius:99px;background:var(--dsw-alias-interactive-bg-hover,#f3f3f4);width:252px;max-width:100%}.dhp-wc-modes button{border:0;background:transparent;flex:1;border-radius:99px;padding:10px 20px;font-size:14px;line-height:20px;white-space:nowrap;transition:background .16s,box-shadow .16s}.dhp-wc-modes button[aria-selected=true]{background:var(--dsw-alias-bg-base,#fff);box-shadow:0 1px 5px #00000012;font-weight:600}.dhp-wc-panel{height:100%;min-height:0;flex:1;display:flex;flex-direction:column;background:var(--dsw-alias-bg-base,#fff)}.dhp-wc-panel-header{min-height:84px;flex:none;padding:16px 22px;display:flex;align-items:center;justify-content:center;position:relative;gap:16px;border-bottom:.5px solid var(--dsw-alias-border-l2,#eee)}.dhp-wc-panel-header .dhp-wc-domain{position:absolute;left:20px;font-size:11px;color:var(--dsw-alias-label-tertiary,#81858c)}.dhp-wc-tools{position:absolute;right:18px;display:flex;gap:5px}.dhp-wc-icon{border:0;background:transparent;border-radius:9px;width:30px;height:30px;display:grid;place-items:center;font-size:18px!important}.dhp-wc-icon:hover{background:var(--dsw-alias-interactive-bg-hover,#eee)}.dhp-wc-viewport{min-height:0;flex:1;position:relative}.dhp-wc-browser{position:fixed;z-index:1;pointer-events:auto;display:flex;flex-direction:column;background:var(--dsw-alias-bg-base,#fff);overflow:hidden}.dhp-wc-browser[hidden]{visibility:hidden;pointer-events:none}.dhp-wc-webhost{flex:1;min-height:0;display:flex}.dhp-deepseek-webview{display:flex;width:100%;height:100%;flex:1;min-height:0;border:0}.dhp-wc-notice{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 18px;background:var(--dsw-alias-interactive-bg-hover,#f6f6f7);font-size:12px;line-height:1.6;flex:none;color:var(--dsw-alias-label-secondary,#666)}.dhp-wc-failure{position:absolute;inset:0;display:grid;align-content:center;justify-items:center;gap:12px;padding:32px;text-align:center;background:var(--dsw-alias-bg-base,#fff);z-index:2}.dhp-wc-failure h2{font-size:20px;font-weight:500;margin:0}.dhp-wc-failure p{max-width:420px;color:var(--dsw-alias-label-secondary,#666);font-size:13px;line-height:1.7;margin:0}.dhp-wc-action{border:1px solid var(--dsw-alias-border-l3,#ddd);background:transparent;border-radius:10px;padding:8px 16px}.dhp-wc-history{display:flex;flex-direction:column;flex:0 0 44%;min-height:90px;max-height:44%;overflow:hidden;padding:4px 6px 0 0;margin-top:4px;border-top:.5px solid var(--dsw-alias-border-l2,#e9e9ea)}.dhp-wc-history[data-expanded=false]{min-height:42px;flex:0 0 42px}.dhp-wc-history-body{min-height:0;overflow:auto;overscroll-behavior:contain;scrollbar-gutter:stable;padding-bottom:14px}.dhp-wc-history-body[hidden]{display:none}.dhp-wc-history-toggle{display:flex;align-items:center;gap:5px;flex:1;align-self:stretch;text-align:left;border:0;background:transparent;border-radius:7px;padding:5px 0;color:inherit!important;font-size:inherit!important}.dhp-wc-history-toggle:hover{color:var(--dsw-alias-label-primary,#202123)!important}.dhp-wc-history-toggle svg{transition:transform .15s}.dhp-wc-history[data-expanded=false] .dhp-wc-history-toggle svg{transform:rotate(-90deg)}.dhp-wc-history-head{flex:none;position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;padding:0 6px 6px 8px;color:var(--dsw-alias-label-tertiary,#81858c);font-size:13px}.dhp-wc-history-head h2{font:inherit;font-weight:500;margin:0}.dhp-wc-history-head>div{display:flex;gap:2px}.dhp-wc-chat-row{display:flex;align-items:center;gap:9px;min-height:33px;width:100%;border:0;background:transparent;border-radius:9px;padding:7px 10px;text-align:left;font-size:13px!important}.dhp-wc-chat-row:hover,.dhp-wc-chat-row[aria-current=page]{background:var(--dsw-alias-interactive-bg-hover,#eee)}.dhp-wc-chat-row span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dhp-wc-history-empty{padding:4px 10px 8px;font-size:12px;color:var(--dsw-alias-label-tertiary,#81858c);line-height:1.6;margin:0}
[data-dhp-chat-sidebar]{min-height:0!important;overflow-y:auto!important;overflow-x:hidden!important;overscroll-behavior:contain}[data-dhp-chat-natural]{flex:0 0 auto!important;min-height:auto!important;max-height:none!important}[data-dhp-chat-list]{overflow-y:visible!important;overflow-x:visible!important;max-height:none!important;scrollbar-gutter:auto!important}
.dhp-wc-chat-item{position:relative;display:flex;align-items:center;border-radius:9px}.dhp-wc-chat-item:hover,.dhp-wc-chat-item[data-current=true]{background:var(--dsw-alias-interactive-bg-hover,#eee)}.dhp-wc-chat-item .dhp-wc-chat-row{min-width:0;flex:1;padding-right:30px;background:transparent}.dhp-wc-chat-row svg{flex:none}.dhp-wc-row-more{position:absolute;right:4px;width:26px;height:26px;display:grid;place-items:center;border:0;background:transparent;border-radius:7px;font-size:18px!important;opacity:0}.dhp-wc-chat-item:hover .dhp-wc-row-more,.dhp-wc-row-more:focus-visible,.dhp-wc-chat-item[data-current=true] .dhp-wc-row-more{opacity:1}.dhp-wc-row-more:hover{background:var(--dsw-alias-interactive-bg-hover,#e6e6e7)}.dhp-wc-session-menu{position:fixed;z-index:1400;background:var(--dsw-alias-bg-base,#fff);border:1px solid var(--dsw-alias-border-l3,#ddd);border-radius:12px;padding:5px;box-shadow:0 10px 40px #0002;min-width:150px}.dhp-wc-session-menu button{display:block;width:100%;padding:9px 12px;border:0;background:transparent;border-radius:8px;text-align:left;font-size:13px}.dhp-wc-session-menu button:hover{background:var(--dsw-alias-interactive-bg-hover,#eee)}.dhp-wc-danger{color:var(--dsw-alias-state-error-primary,#ca515b)!important}.dhp-wc-dialog-mask{position:fixed;inset:0;z-index:1400;background:#0005;display:grid;place-items:center;padding:20px}.dhp-wc-rename{background:var(--dsw-alias-bg-base,#fff);border:1px solid var(--dsw-alias-border-l3,#ddd);border-radius:18px;padding:24px;width:380px;max-width:100%;box-shadow:0 18px 70px #0002}.dhp-wc-rename h2{font-size:18px;margin:0 0 18px;font-weight:500}.dhp-wc-rename input,.dhp-wc-search{font:inherit;background:transparent;border:1px solid var(--dsw-alias-border-l3,#ddd);border-radius:10px;padding:10px 12px;width:100%;color:inherit;outline:none}.dhp-wc-rename input:focus,.dhp-wc-search:focus{border-color:var(--dsw-alias-state-business-primary,#5178ef)}.dhp-wc-rename>div{display:flex;justify-content:flex-end;gap:8px;margin-top:20px}.dhp-wc-rename>p{font-size:12px;color:var(--dsw-alias-state-error-primary,#ca515b);line-height:1.6}.dhp-wc-search{font-size:12px;padding:7px 9px;margin:0 6px 8px;width:calc(100% - 12px)}
.dhp-wc-loading{display:flex;justify-content:center;align-items:center;gap:8px;height:100%;font-size:13px;color:var(--dsw-alias-label-secondary,#666)}.dhp-wc-loading:before{content:'';width:14px;height:14px;border:2px solid #8097d444;border-top-color:#6585ee;border-radius:50%;animation:dhp-wc-spin .8s linear infinite}@keyframes dhp-wc-spin{to{transform:rotate(360deg)}}[data-sidebar-collapsed=true] .dhp-wc-history{display:none}@media(prefers-reduced-motion:reduce){.dhp-wc *{animation:none!important;transition:none!important}}@media(max-width:850px){.dhp-wc-panel-header .dhp-wc-domain{display:none}.dhp-wc-panel-header{justify-content:flex-start;padding-left:14px}.dhp-wc-modes{width:220px}}`;
var workChatHeaderCss = `.dhp-wc-mode-switch{position:fixed;z-index:2;pointer-events:auto;transform:translateX(-50%);width:${MODE_SWITCH_LAYOUT.width}px}.dhp-wc-mode-switch .dhp-wc-modes{width:100%;height:${MODE_SWITCH_LAYOUT.height}px}.dhp-wc-modes button{height:100%;min-height:0;margin:0}.dhp-wc-panel-header{height:${MODE_SWITCH_LAYOUT.headerHeight}px;min-height:${MODE_SWITCH_LAYOUT.headerHeight}px}.dhp-wc-session-title{position:absolute;left:20px;max-width:calc(100% - 150px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;font-weight:500;line-height:20px;color:var(--dsw-alias-label-primary,#202123)}@media(max-width:850px){.dhp-wc-mode-switch{width:${MODE_SWITCH_LAYOUT.compactWidth}px}.dhp-wc-panel-header{justify-content:center}}`;
function useSource(source) {
  const bound = (0, import_react.useMemo)(() => bindExternalSource(source), [source]);
  return (0, import_react.useSyncExternalStore)(bound.subscribe, bound.getSnapshot);
}
function ModeSwitch({ mode, controller, t }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dhp-wc-modes", role: "tablist", "aria-label": t("\u4F1A\u8BDD\u6A21\u5F0F"), onKeyDown: (event) => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    if (mode === "chat") controller.work();
    else controller.open();
  }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { role: "tab", "aria-selected": mode === "chat", onClick: () => controller.open(), children: t("\u804A\u5929") }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { role: "tab", "aria-selected": mode === "work", onClick: () => controller.work(), children: t("\u5DE5\u4F5C") })
  ] });
}
function ChatBubbleIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { width: "15", height: "15", viewBox: "0 0 20 20", fill: "none", stroke: "currentColor", strokeWidth: "1.4", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M4 3.5h12a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9L4 17v-2.5H3a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z" }) });
}
function ShareIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { width: "15", height: "15", viewBox: "0 0 20 20", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M11 3h6v6M17 3l-8 8" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M15 11v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4" })
  ] });
}
function ChatHistory({ controller, active, t }) {
  const state = useSource(controller);
  const selected = chatSession(state.url)?.id;
  const [expanded, setExpanded] = (0, import_react.useState)(true), [searching, setSearching] = (0, import_react.useState)(false), [query, setQuery] = (0, import_react.useState)(""), [menu, setMenu] = (0, import_react.useState)(null), [rename, setRename] = (0, import_react.useState)(null), [draft, setDraft] = (0, import_react.useState)(""), [busy, setBusy] = (0, import_react.useState)(false), [error, setError] = (0, import_react.useState)("");
  const menuRef = (0, import_react.useRef)(null), inputRef = (0, import_react.useRef)(null);
  const rows = state.rows.filter((row) => row.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  (0, import_react.useEffect)(() => {
    if (!menu) return;
    const close = (event) => {
      if (!menuRef.current?.contains(event.target) && !menu.trigger?.contains(event.target)) setMenu(null);
    };
    const key = (event) => {
      if (event.key === "Escape") {
        setMenu(null);
        menu.trigger?.focus();
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", key);
    };
  }, [menu]);
  (0, import_react.useEffect)(() => {
    if (!active) setMenu(null);
  }, [active]);
  (0, import_react.useEffect)(() => {
    if (rename) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [rename]);
  const manage = async (row, action, title) => {
    setError("");
    if (!controller.manageRow) throw new Error(t("\u8BF7\u5148\u6253\u5F00\u804A\u5929\u7F51\u9875\u540E\u91CD\u8BD5\u3002"));
    return controller.manageRow(row, action, title);
  };
  const save = async (event) => {
    event.preventDefault();
    if (busy || !draft.trim()) return;
    setBusy(true);
    try {
      await manage(rename, "rename", draft);
      setRename(null);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "dhp-wc dhp-wc-history", "data-expanded": expanded, "aria-label": t("\u7F51\u9875\u804A\u5929\u4F1A\u8BDD"), children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { className: "dhp-wc-history-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { className: "dhp-wc-history-toggle", "aria-expanded": expanded, "aria-label": t("\u804A\u5929"), onClick: () => {
        setExpanded((value) => !value);
        setMenu(null);
      }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { width: "12", height: "12", viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m4 6 4 4 4-4" }) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: t("\u804A\u5929") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "dhp-wc-icon", title: t("\u641C\u7D22\u804A\u5929\u6807\u9898"), "aria-label": t("\u641C\u7D22\u804A\u5929\u6807\u9898"), "aria-expanded": searching, onClick: () => {
          setExpanded(true);
          setSearching((value) => !value);
          setQuery("");
        }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { width: "15", height: "15", viewBox: "0 0 20 20", fill: "none", stroke: "currentColor", strokeWidth: "1.4", "aria-hidden": "true", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "8.5", cy: "8.5", r: "5.5" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m13 13 4 4" })
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "dhp-wc-icon", title: t("\u540C\u6B65\u7F51\u9875\u4F1A\u8BDD"), "aria-label": t("\u540C\u6B65\u7F51\u9875\u4F1A\u8BDD"), onClick: () => controller.scan ? controller.scan() : controller.open(DEEPSEEK_HOME), children: "\u21BB" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "dhp-wc-icon", title: t("\u65B0\u804A\u5929"), "aria-label": t("\u65B0\u804A\u5929"), onClick: () => controller.open(DEEPSEEK_HOME), children: "\uFF0B" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dhp-wc-history-body", hidden: !expanded, children: [
      searching && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { className: "dhp-wc-search", "aria-label": t("\u641C\u7D22\u804A\u5929\u6807\u9898"), placeholder: t("\u641C\u7D22\u804A\u5929\u6807\u9898"), value: query, onChange: (event) => setQuery(event.target.value), autoFocus: true }),
      error && !rename && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dhp-wc-history-empty", role: "alert", children: t(error) }),
      rows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dhp-wc-chat-item", "data-current": active && selected === row.id, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { className: "dhp-wc-chat-row", "aria-current": active && selected === row.id ? "page" : void 0, onClick: () => controller.open(row.url), title: row.title, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChatBubbleIcon, {}),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: row.title })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "dhp-wc-row-more", "aria-label": t("\u7BA1\u7406\u4F1A\u8BDD\uFF1A{title}", { title: row.title }), "aria-haspopup": "menu", "aria-expanded": menu?.row.id === row.id, onClick: (event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const trigger = event.currentTarget;
          setMenu((current) => current?.row.id === row.id ? null : { row, x: rect.left, y: rect.bottom, trigger });
        }, children: "\u2026" })
      ] }, row.id)),
      searching && query && !rows.length && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dhp-wc-history-empty", children: t("\u6CA1\u6709\u5339\u914D\u7684\u804A\u5929\u6807\u9898\u3002") }),
      !state.rows.length && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { className: "dhp-wc-chat-row", onClick: () => controller.open(DEEPSEEK_HOME), children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { "aria-hidden": "true", children: "\uFF0B" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("\u5728 DeepSeek \u5F00\u59CB\u804A\u5929") })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dhp-wc-history-empty", children: state.status === "sign-in" ? t("\u767B\u5F55\u5B98\u7F51\u540E\uFF0C\u4F1A\u8BDD\u663E\u793A\u5728\u8FD9\u91CC\u3002") : state.opened ? t("\u540C\u6B65\u7F51\u9875\u4FA7\u680F\u4E2D\u7684\u804A\u5929\u4F1A\u8BDD\u3002") : t("\u4E0E\u5DE5\u4F5C\u533A\u5206\u5F00\uFF0C\u8FDE\u63A5 DeepSeek \u5B98\u65B9\u7F51\u9875\u3002") })
      ] })
    ] }),
    menu && (0, import_react_dom.createPortal)(/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dhp-wc dhp-wc-session-menu", role: "menu", "aria-label": t("\u4F1A\u8BDD\u64CD\u4F5C"), ref: menuRef, style: { left: Math.max(8, Math.min(menu.x, window.innerWidth - 180)), top: Math.min(menu.y + 4, window.innerHeight - 110) }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { role: "menuitem", onClick: () => {
        setRename(menu.row);
        setDraft(menu.row.title);
        setError("");
        setMenu(null);
      }, children: t("\u91CD\u547D\u540D") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { role: "menuitem", className: "dhp-wc-danger", onClick: async () => {
        const row = menu.row;
        setMenu(null);
        try {
          await manage(row, "delete");
        } catch (reason) {
          setError(reason.message);
        }
      }, children: t("\u5220\u9664") })
    ] }), document.body),
    rename && (0, import_react_dom.createPortal)(/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dhp-wc dhp-wc-dialog-mask", onKeyDown: (event) => {
      if (event.key === "Escape" && !busy) setRename(null);
    }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", { className: "dhp-wc-rename", role: "dialog", "aria-modal": "true", "aria-label": t("\u91CD\u547D\u540D\u804A\u5929"), onSubmit: save, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: t("\u91CD\u547D\u540D\u804A\u5929") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { ref: inputRef, "aria-label": t("\u4F1A\u8BDD\u540D\u79F0"), value: draft, onChange: (event) => setDraft(event.target.value), maxLength: 160, disabled: busy }),
      error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { role: "alert", children: t(error) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "dhp-wc-action", disabled: busy, onClick: () => setRename(null), children: t("\u53D6\u6D88") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "dhp-wc-action", disabled: busy || !draft.trim(), children: busy ? t("\u6B63\u5728\u4FDD\u5B58\u2026") : t("\u4FDD\u5B58") })
      ] })
    ] }) }), document.body)
  ] });
}
function ChatPanel({ controller, language, onViewport }) {
  const state = useSource(controller);
  (0, import_react.useEffect)(() => {
    if (!state.opened) controller.open();
  }, [state.opened, controller]);
  const t = createTranslator(language);
  const activeSession = chatSession(state.url);
  const sessionTitle2 = activeSession ? state.rows.find((row) => row.id === activeSession.id)?.title || state.title : "";
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "dhp-wc dhp-wc-panel", "aria-label": t("DeepSeek \u804A\u5929\u6A21\u5F0F"), children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { className: "dhp-wc-panel-header", children: [
      sessionTitle2 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dhp-wc-session-title", title: sessionTitle2, children: sessionTitle2 }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dhp-wc-tools", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "dhp-wc-icon", "aria-label": t("\u5206\u4EAB\u804A\u5929"), title: t("\u5206\u4EAB\u804A\u5929"), disabled: !activeSession || state.status !== "ready", onClick: () => controller.share?.().catch((error) => controller.report({ error: error.message })), children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShareIcon, {}) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "dhp-wc-icon", "aria-label": t("\u65B0\u804A\u5929"), title: t("\u65B0\u804A\u5929"), onClick: () => controller.open(DEEPSEEK_HOME), children: "\uFF0B" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "dhp-wc-icon", "aria-label": t("\u5237\u65B0\u7F51\u9875"), title: t("\u5237\u65B0\u7F51\u9875"), onClick: () => controller.reload?.(), children: "\u21BB" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dhp-wc-viewport", ref: onViewport, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dhp-wc-loading", "aria-hidden": "true", children: state.status === "loading" ? t("\u6B63\u5728\u6253\u5F00 DeepSeek \u5B98\u65B9\u7F51\u9875\u2026") : "" }) })
  ] });
}
function WorkChatExtension({ ctx, controller, viewport, useLanguage, activePanel }) {
  const state = useSource(controller);
  const panelInfo = useSource(activePanel);
  const sessions = useSource(ctx.sessions.list);
  const [language, setLanguage] = (0, import_react.useState)("zh-CN");
  const t = createTranslator(language);
  const [sidebar, setSidebar] = (0, import_react.useState)(null), [modeRect, setModeRect] = (0, import_react.useState)(null);
  const host = (0, import_react.useRef)(null), guest = (0, import_react.useRef)(null), browserFrame = (0, import_react.useRef)(null);
  const active = panelInfo.activePanelId === CHAT_PANEL;
  const switchMode = newSessionMode({ activePanelId: panelInfo.activePanelId, sessions, chat: state });
  const switchPosition = modeSwitchPosition(modeRect);
  (0, import_react.useEffect)(() => {
    const languageChanged = (event) => {
      if (["zh-CN", "en"].includes(event.detail)) {
        setLanguage(event.detail);
        useLanguage(event.detail);
      }
    };
    const initial = document.querySelector("[data-dsh-hide-pet]")?.lang;
    if (initial) {
      setLanguage(initial);
      useLanguage(initial);
    }
    window.addEventListener("dhp-language", languageChanged);
    return () => window.removeEventListener("dhp-language", languageChanged);
  }, [useLanguage]);
  (0, import_react.useEffect)(() => {
    let target = null, targetObserver = null;
    const originals = /* @__PURE__ */ new Map();
    const mark = (element, attribute) => {
      if (!originals.has(element)) originals.set(element, /* @__PURE__ */ new Map());
      const attrs = originals.get(element);
      if (!attrs.has(attribute)) attrs.set(attribute, element.hasAttribute(attribute) ? element.getAttribute(attribute) : null);
      element.setAttribute(attribute, "");
    };
    const restore = () => {
      targetObserver?.disconnect();
      targetObserver = null;
      for (const [element, attrs] of originals) for (const [attribute, value] of attrs) {
        if (value === null) element.removeAttribute(attribute);
        else element.setAttribute(attribute, value);
      }
      originals.clear();
    };
    const adapt = () => {
      const next = document.querySelector('[data-slot="sidebar.workspaces"]');
      if (next !== target) {
        restore();
        target = next;
        if (target) targetObserver = new MutationObserver(adapt), targetObserver.observe(target, { childList: true, subtree: true });
        setSidebar((current) => current === target ? current : target);
      }
      if (!target) return;
      mark(target, "data-dhp-chat-sidebar");
      for (const element of target.querySelectorAll("*")) {
        if (element.closest(".dhp-wc-history")) continue;
        const style = getComputedStyle(element);
        const scrollList = element.hasAttribute("data-dhp-chat-list") || (style.overflowY === "auto" || style.overflowY === "scroll") && Number.parseFloat(style.flexGrow) > 0;
        if (!scrollList) continue;
        mark(element, "data-dhp-chat-list");
        for (let parent = element.parentElement; parent && parent !== target; parent = parent.parentElement) {
          if (Number.parseFloat(getComputedStyle(parent).flexGrow) > 0 || parent.hasAttribute("data-dhp-chat-natural")) mark(parent, "data-dhp-chat-natural");
        }
      }
    };
    const observer = new MutationObserver(adapt);
    observer.observe(document.body, { childList: true, subtree: true });
    adapt();
    return () => {
      observer.disconnect();
      restore();
      target = null;
    };
  }, []);
  (0, import_react.useLayoutEffect)(() => {
    let frame;
    const observed = /* @__PURE__ */ new Set();
    const measure = () => {
      const chat = viewport.current?.isConnected ? viewport.current.getBoundingClientRect() : null;
      const root = document.querySelector('[data-slot="main.conversation"]')?.firstElementChild;
      const work = root?.getBoundingClientRect();
      const chatPanel = viewport.current?.closest(".dhp-wc-panel");
      const node = browserFrame.current;
      if (node) {
        if (chat && chat.width > 0 && chat.height > 0) Object.assign(node.style, { left: `${chat.x}px`, top: `${chat.y}px`, width: `${chat.width}px`, height: `${chat.height}px` });
        node.hidden = !active || !chat || chat.width <= 0 || chat.height <= 0;
      }
      const bounds = active ? chatPanel?.getBoundingClientRect() : work;
      const next = bounds && bounds.width > 0 && bounds.height > 0 ? { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height } : null;
      setModeRect((previous) => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
      for (const element of [viewport.current, chatPanel, root]) if (element && !observed.has(element)) {
        observed.add(element);
        observer.observe(element);
      }
    };
    const observer = new ResizeObserver(measure);
    let until = 0;
    const follow = () => {
      measure();
      if (performance.now() < until) frame = requestAnimationFrame(follow);
    };
    const changed = () => {
      cancelAnimationFrame(frame);
      until = performance.now() + 400;
      follow();
    };
    viewport.onChange = changed;
    const mutations = new MutationObserver(changed);
    const layout = document.querySelector("[data-shell-overlay]")?.parentElement;
    mutations.observe(layout || document.body, { attributes: true, attributeFilter: ["data-sidebar-collapsed", "data-animating", "style"] });
    changed();
    window.addEventListener("resize", changed);
    document.addEventListener("transitionrun", changed);
    return () => {
      viewport.onChange = null;
      cancelAnimationFrame(frame);
      observer.disconnect();
      mutations.disconnect();
      window.removeEventListener("resize", changed);
      document.removeEventListener("transitionrun", changed);
    };
  }, [viewport, active, state.opened, switchMode]);
  (0, import_react.useEffect)(() => {
    if (!state.opened || !host.current) return;
    const browser = createDeepSeekGuest({ bridge: window.dshDesktop?.browser, host: host.current, report: controller.report, observe: controller.observe });
    guest.current = browser;
    controller.scan = () => browser.scan();
    controller.reload = () => browser.reload();
    controller.share = () => browser.share();
    controller.manageRow = async (row, action, title) => {
      ctx.layout.selectPanel(CHAT_PANEL);
      return browser.manage(row, action, title);
    };
    browser.start();
    return () => {
      guest.current = null;
      delete controller.scan;
      delete controller.reload;
      delete controller.share;
      delete controller.manageRow;
      browser.dispose();
    };
  }, [state.opened, controller]);
  (0, import_react.useEffect)(() => {
    if (state.request) guest.current?.navigate(state.request.url);
  }, [state.request]);
  (0, import_react.useEffect)(() => {
    if (!active) return;
    const timer = setInterval(() => guest.current?.scan(), 3e3);
    return () => clearInterval(timer);
  }, [active]);
  (0, import_react.useEffect)(() => {
    if (!active) return;
    const intercept = (event) => {
      const button = event.target.closest?.('[data-slot="sidebar"] button');
      if (!button) return;
      const label = button.getAttribute("aria-label") || button.textContent || "";
      if (!/^(新建会话|新会话|New session|New Session)$/.test(label.trim())) return;
      event.preventDefault();
      event.stopPropagation();
      controller.open(DEEPSEEK_HOME);
    };
    document.addEventListener("click", intercept, true);
    return () => document.removeEventListener("click", intercept, true);
  }, [active, controller]);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("style", { children: workChatCss + workChatHeaderCss }),
    sidebar && (0, import_react_dom.createPortal)(/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChatHistory, { controller, active, t }), sidebar),
    switchMode && switchPosition && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dhp-wc dhp-wc-mode-switch", style: switchPosition, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ModeSwitch, { mode: switchMode, controller, t }) }),
    state.opened && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "dhp-wc dhp-wc-browser", ref: browserFrame, "aria-label": t("DeepSeek \u5B98\u65B9\u7F51\u9875"), children: [
      state.status === "sign-in" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dhp-wc-notice", children: t("\u8BF7\u5728\u5B98\u7F51\u4F7F\u7528\u4E0E Harness \u76F8\u540C\u7684\u8D26\u53F7\u767B\u5F55\u3002") }),
      state.error && state.status !== "error" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dhp-wc-notice", children: t(state.error) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dhp-wc-webhost", ref: host }),
      state.status === "error" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dhp-wc-failure", role: "alert", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: t("\u6682\u65F6\u65E0\u6CD5\u6253\u5F00\u804A\u5929\u7F51\u9875") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: t(state.error) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "dhp-wc-action", onClick: () => controller.reload?.(), children: t("\u91CD\u8BD5") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "dhp-wc-action", onClick: () => controller.work(), children: t("\u8FD4\u56DE\u5DE5\u4F5C") })
      ] })
    ] })
  ] });
}
function applyWorkChat(ctx) {
  if (!ctx.layout?.panelInfo || !ctx.sessions?.list) return;
  const controller = createWorkChatController(ctx.layout);
  const viewport = { current: null, onChange: null };
  const onViewport = (element) => {
    viewport.current = element;
    viewport.onChange?.();
  };
  let language = "zh-CN";
  const languageListeners = /* @__PURE__ */ new Set();
  const languageStore = { getSnapshot: () => language, subscribe: (listener) => {
    languageListeners.add(listener);
    return () => languageListeners.delete(listener);
  } };
  const setLanguage = (value) => {
    if (value !== language) {
      language = value;
      for (const listener of languageListeners) listener();
    }
  };
  ctx.slots.inject("main", () => ctx.slots.register({ name: "main", key: CHAT_PANEL }, () => {
    const currentLanguage = useSource(languageStore);
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChatPanel, { controller, language: currentLanguage, onViewport });
  }));
  ctx.slots.inject("shell.overlay", () => ctx.slots.register({ name: "shell.overlay", id: "dsh-deepseek-chat", order: 40 }, () => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WorkChatExtension, { ctx, controller, viewport, useLanguage: setLanguage, activePanel: ctx.layout.panelInfo })));
}

// src/pet-dock.jsx
var import_react2 = __toESM(require("react"), 1);

// src/companion-behavior.mjs
function createCompletionTracker() {
  let previous = /* @__PURE__ */ new Map(), serial = 0;
  const observedRunning = /* @__PURE__ */ new Set();
  return (rows) => {
    const next = new Map(rows.map((row) => [row.id, row]));
    const notices = [];
    for (const row of rows) {
      const before = previous.get(row.id);
      if (row.running) {
        observedRunning.add(row.id);
        continue;
      }
      if (row.error || row.turnOutcome && /error|cancel|abort|interrupt/.test(row.turnOutcome)) {
        observedRunning.delete(row.id);
        continue;
      }
      if (!before || !observedRunning.has(row.id) || row.pendingInteraction) continue;
      const ended = row.turnEnded && row.activityVersion !== before.activityVersion;
      if (!before.running && !ended && !(row.state === "ready" && before.state !== "ready")) continue;
      if (row.activityVersion && !row.turnEnded && row.state !== "ready") continue;
      notices.push({ id: `${row.id}:${++serial}`, sessionId: row.id, title: row.title, expiresAt: Date.now() + 3e4 });
      observedRunning.delete(row.id);
    }
    for (const id of observedRunning) if (!next.has(id)) observedRunning.delete(id);
    previous = next;
    return notices;
  };
}
function sidePanelPosition(pet, viewport, width = 350, height = 470, gap = 12) {
  const rightSpace = viewport.width - pet.x - pet.width;
  const leftSpace = pet.x;
  const preferRight = pet.x + pet.width / 2 < viewport.width / 2;
  const right = preferRight ? rightSpace >= width + gap || rightSpace >= leftSpace : !(leftSpace >= width + gap || leftSpace >= rightSpace);
  const available = Math.max(120, (right ? rightSpace : leftSpace) - gap - 8);
  const panelWidth = Math.min(width, available);
  return { side: right ? "right" : "left", x: right ? pet.x + pet.width + gap : pet.x - panelWidth - gap, y: Math.max(8, Math.min(pet.y - 24, viewport.height - height - 8)), width: panelWidth, maxHeight: Math.max(120, viewport.height - 16) };
}
function inwardBubblePosition(pet, viewport, width = 250, height = 120) {
  const right = pet.x + pet.width / 2 < viewport.width / 2;
  return { side: right ? "right" : "left", x: Math.max(8, Math.min(right ? pet.x + pet.width - 12 : pet.x - width + 12, viewport.width - width - 8)), y: Math.max(8, Math.min(pet.y - height + 24, viewport.height - height - 8)) };
}

// src/pet-dock.jsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var dockCss = `
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
.dhp-dock .dhp-drag-grip{cursor:grab;touch-action:none;user-select:none;flex:none;padding:0 8px;min-width:24px}.dhp-dock .dhp-drag-grip:active{cursor:grabbing}.dhp-dock{transition:opacity .18s ease,transform .18s ease}.dhp-dock[data-shown=false]{opacity:0;transform:translateY(6px);pointer-events:none}.dhp-dock[data-reduced=true]{transition:none;transform:none}@media(prefers-reduced-motion:reduce){.dhp-dock,.dhp-completion{transition:none;animation:none;transform:none}}
.dhp-choice{position:relative;margin:5px 0 10px}.dhp-choice-trigger{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;border:1px solid var(--hp-border);background:var(--hp-soft);border-radius:10px;color:var(--hp-text);padding:10px 12px;text-align:left;font:inherit;font-size:12px}.dhp-choice-trigger span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dhp-choice-trigger:hover,.dhp-choice-trigger[aria-expanded=true]{border-color:#719cd8}
.dhp-choice-list{position:absolute;z-index:5;left:0;right:0;top:calc(100% + 5px);max-height:220px;overflow:auto;padding:5px;background:var(--hp-bg);border:1px solid var(--hp-border);border-radius:12px;box-shadow:0 12px 30px #172b5426}.dhp-choice-option{position:relative;width:100%;display:block;background:transparent;border:0;border-radius:8px;padding:9px 28px 9px 10px;color:var(--hp-text);text-align:left;font:inherit;font-size:12px}.dhp-choice-option:hover,.dhp-choice-option[aria-selected=true]{background:var(--hp-soft)}.dhp-choice-option span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dhp-choice-option small{display:block;font-size:10px;color:var(--hp-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:3px}.dhp-choice-option[aria-selected=true]:after{content:'\u2713';position:absolute;right:10px;top:10px;color:#719cd8}
.dhp-completion{position:absolute;width:250px;pointer-events:auto;background:var(--hp-bg);border:1px solid var(--hp-border);border-radius:15px;padding:14px;box-shadow:0 10px 30px #15255022;animation:dhp-tray-in .18s ease-out}.dhp-completion:after{content:'';position:absolute;bottom:-7px;width:12px;height:12px;background:var(--hp-bg);border-right:1px solid var(--hp-border);border-bottom:1px solid var(--hp-border);transform:rotate(45deg)}.dhp-completion[data-side=right]:after{left:18px}.dhp-completion[data-side=left]:after{right:18px}.dhp-completion>button:first-child{float:right;border:0;background:transparent;color:var(--hp-muted);padding:0 3px}.dhp-completion strong{font-size:13px}.dhp-completion-open{display:grid;gap:7px;text-align:left;background:transparent;border:0;color:var(--hp-text);padding:8px 0 0;width:100%;font:inherit}.dhp-completion-open span{max-height:40px;overflow:hidden;font-size:12px}.dhp-completion-open small{font-size:10px;color:var(--hp-muted)}.dhp-completion[data-reduced=true]{animation:none}
`;
function Choice({ label, value, options, onChange, disabled, t }) {
  const [open, setOpen] = (0, import_react2.useState)(false);
  const host = (0, import_react2.useRef)(null), trigger = (0, import_react2.useRef)(null), list = (0, import_react2.useRef)(null);
  const selected = options.find((item) => item.value === value);
  (0, import_react2.useEffect)(() => {
    if (!open) return;
    const outside = (event) => {
      if (!host.current?.contains(event.target)) setOpen(false);
    };
    window.addEventListener("pointerdown", outside);
    const items = list.current?.querySelectorAll("[role=option]");
    items?.[Math.max(0, options.findIndex((item) => item.value === value))]?.focus();
    return () => window.removeEventListener("pointerdown", outside);
  }, [open]);
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dhp-choice", ref: host, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("button", { ref: trigger, className: "dhp-choice-trigger", type: "button", "aria-label": label, "aria-haspopup": "listbox", "aria-expanded": open && !disabled, disabled, onClick: () => setOpen(!open), onKeyDown: (event) => {
      if (["ArrowDown", "ArrowUp"].includes(event.key)) {
        event.preventDefault();
        setOpen(true);
      }
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: selected?.label || t("\u8BF7\u9009\u62E9") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { "aria-hidden": "true", children: "\u2304" })
    ] }),
    open && !disabled && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { ref: list, className: "dhp-choice-list", role: "listbox", "aria-label": label, onKeyDown: (event) => {
      const items = [...list.current.querySelectorAll("[role=option]")], index = items.indexOf(document.activeElement);
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        items[event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
      }
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
        trigger.current?.focus();
      }
      if (event.key === "Tab") setOpen(false);
    }, children: options.map((item) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("button", { role: "option", "aria-selected": item.value === value, className: "dhp-choice-option", title: item.detail || item.label, onClick: () => {
      onChange(item.value);
      setOpen(false);
      trigger.current?.focus();
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: item.label }),
      item.detail && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("small", { children: item.detail })
    ] }, item.value)) })
  ] });
}
function DockIcon({ activity = false }) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { viewBox: "0 0 20 20", "aria-hidden": "true", children: activity ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_jsx_runtime2.Fragment, { children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M3 5h2m3 0h9M3 10h2m3 0h9M3 15h2m3 0h9" }) }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M5 3.5h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9L4 17v-3a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2Z" }) });
}
function PetDock({ ctx, rows, position, petBounds, mini, dragHandlers, focusRequest, onPreferences, reducedMotion = false, language = "zh-CN" }) {
  const t = createTranslator(language);
  const actions = import_react2.default.useMemo(() => createHarnessActions(ctx), [ctx]);
  const [page, setPage] = (0, import_react2.useState)(null);
  const [text, setText] = (0, import_react2.useState)("");
  const [target, setTarget] = (0, import_react2.useState)("new");
  const [workspaceId, setWorkspaceId] = (0, import_react2.useState)("");
  const [error, setError] = (0, import_react2.useState)("");
  const [busy, setBusy] = (0, import_react2.useState)(false);
  const [near, setNear] = (0, import_react2.useState)(false);
  const [dismissed, setDismissed] = (0, import_react2.useState)(/* @__PURE__ */ new Map());
  const [muted, setMuted] = (0, import_react2.useState)(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem("dsh-hide-pet:muted") || "[]"));
    } catch {
      return /* @__PURE__ */ new Set();
    }
  });
  const input = (0, import_react2.useRef)(null), root = (0, import_react2.useRef)(null), previous = (0, import_react2.useRef)(/* @__PURE__ */ new Map());
  const context = actions.getContext();
  const keyFor = (row) => `${row.state}:${row.activityVersion}:${JSON.stringify(row.pendingInteraction)}:${JSON.stringify(row.error)}`;
  const visible = rows.filter((row) => !muted.has(row.id) && dismissed.get(row.id) !== keyFor(row));
  const hidden = rows.length - visible.length;
  const dockLeft = Math.max(8, Math.min(position.x, window.innerWidth - (mini ? language === "en" ? 280 : 250 : 220)));
  const dockTop = Math.max(8, Math.min(position.y, window.innerHeight - 48));
  const body = petBounds || { x: dockLeft, y: dockTop, width: 192, height: 40 };
  const placement = sidePanelPosition(body, { width: window.innerWidth, height: window.innerHeight });
  const selectedWorkspace = workspaceId || context.currentWorkspaceId || "";
  const availableSessions = context.sessions.filter((item) => item.workspaceId === selectedWorkspace);
  const shown = mini || near || Boolean(page);
  (0, import_react2.useEffect)(() => {
    let hiding;
    const observe = (event) => {
      const inside = event.clientX >= Math.min(body.x, dockLeft) - 42 && event.clientX <= Math.max(body.x + body.width, dockLeft + 220) + 42 && event.clientY >= body.y - 42 && event.clientY <= dockTop + 82;
      if (inside) {
        clearTimeout(hiding);
        hiding = null;
        setNear(true);
      } else if (!hiding) hiding = setTimeout(() => {
        hiding = null;
        setNear(false);
      }, 550);
    };
    window.addEventListener("pointermove", observe);
    return () => {
      window.removeEventListener("pointermove", observe);
      clearTimeout(hiding);
    };
  }, [body.x, body.y, body.width, dockLeft, dockTop]);
  (0, import_react2.useEffect)(() => {
    if (target !== "new" && !availableSessions.some((item) => item.sessionId === target)) setTarget("new");
  }, [target, selectedWorkspace, context.sessions.map((item) => item.sessionId + item.workspaceId).join("|")]);
  (0, import_react2.useEffect)(() => {
    if (workspaceId && !context.workspaces.some((item) => item.workspaceId === workspaceId)) setWorkspaceId("");
  }, [workspaceId, context.workspaces.map((item) => item.workspaceId).join("|")]);
  (0, import_react2.useEffect)(() => {
    const next = new Map(rows.map((row) => [row.id, keyFor(row)]));
    const reset = [...dismissed.keys()].filter((id) => previous.current.get(id) !== next.get(id));
    setDismissed((current) => {
      const copy = new Map(current);
      let changed = false;
      for (const id of reset) {
        copy.delete(id);
        changed = true;
      }
      return changed ? copy : current;
    });
    previous.current = next;
  }, [rows]);
  (0, import_react2.useEffect)(() => {
    if (focusRequest) setPage("chat");
  }, [focusRequest]);
  (0, import_react2.useEffect)(() => {
    if (page === "chat") input.current?.focus();
    if (!page) return;
    const outside = (event) => {
      if (!root.current?.contains(event.target) && !event.target.closest?.(".dhp-pet")) setPage(null);
    };
    const escape = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setPage(null);
      }
    };
    window.addEventListener("pointerdown", outside);
    root.current?.addEventListener("keydown", escape);
    const element = root.current;
    return () => {
      window.removeEventListener("pointerdown", outside);
      element?.removeEventListener("keydown", escape);
    };
  }, [page]);
  const run = async (operation) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await operation();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const chatArgs = () => ({ text, ...target === "new" ? { workspaceId: workspaceId || context.currentWorkspaceId || void 0 } : { sessionId: target } });
  const submit = () => run(async () => {
    const result = await actions.sendMessage(chatArgs());
    setText("");
    setTarget(result.sessionId);
    setPage(null);
  });
  const composer = () => run(async () => {
    await actions.openMainComposer(chatArgs());
    setText("");
    setPage(null);
  });
  const reply = (id) => {
    const session = context.sessions.find((item) => item.sessionId === id);
    if (session?.workspaceId) setWorkspaceId(session.workspaceId);
    setTarget(id);
    setPage("chat");
    setError("");
  };
  const mute = (id) => setMuted((current) => {
    const next = new Set(current);
    next.add(id);
    try {
      localStorage.setItem("dsh-hide-pet:muted", JSON.stringify([...next]));
    } catch {
    }
    return next;
  });
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dhp-dock", "data-reduced": reducedMotion, "data-shown": shown, onFocusCapture: () => setNear(true), ref: root, style: { left: dockLeft, top: dockTop }, children: [
    mini && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "dhp-drag-grip", "aria-label": t("\u62D6\u52A8\u79FB\u52A8"), title: t("\u62D6\u52A8\u79FB\u52A8"), ...dragHandlers, children: "\u283F" }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("button", { "aria-label": t("\u5FEB\u901F\u804A\u5929"), "aria-expanded": page === "chat", onClick: () => {
      setPage((current) => current === "chat" ? null : "chat");
      setError("");
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(DockIcon, {}),
      t("\u804A\u4E00\u804A")
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("button", { "aria-label": t("\u4EFB\u52A1\u52A8\u6001 {count} \u6761", { count: visible.length }), "aria-expanded": page === "activity", onClick: () => {
      setPage((current) => current === "activity" ? null : "activity");
      setError("");
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(DockIcon, { activity: true }),
      t("\u52A8\u6001"),
      visible.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dhp-count", children: visible.length })
    ] }),
    mini && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { "aria-label": t("\u663E\u793A\u5BA0\u7269\u5F62\u8C61"), onClick: () => onPreferences({ mode: "pet" }), children: "\u2726" }),
    page && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("section", { className: "dhp-tray", style: { left: placement.x - dockLeft, top: placement.y - dockTop, right: "auto", bottom: "auto", width: placement.width, maxHeight: placement.maxHeight }, "aria-label": page === "chat" ? t("\u4F19\u4F34\u5FEB\u901F\u804A\u5929") : t("\u4EFB\u52A1\u52A8\u6001"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dhp-tray-head", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h3", { children: page === "chat" ? t("\u804A\u4E00\u804A") : t("\u4EFB\u52A1\u52A8\u6001") }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { children: page === "chat" ? t("\u6709\u4E2A\u60F3\u6CD5\uFF1F\u968F\u65F6\u544A\u8BC9\u6211\u3002") : visible.length ? t("{count} \u9879\u8FDB\u5C55\uFF0C\u966A\u4F60\u4E00\u8D77\u7559\u610F\u3002", { count: visible.length }) : t("\u5B89\u5FC3\u505A\u4F60\u7684\u4E8B\uFF0C\u65B0\u8FDB\u5C55\u4F1A\u51FA\u73B0\u5728\u8FD9\u91CC\u3002") })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { "aria-label": t("\u5173\u95ED\u4F19\u4F34\u64CD\u4F5C"), onClick: () => setPage(null), children: "\xD7" })
      ] }),
      error && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dhp-message", "data-error": "true", role: "alert", children: t(error) }),
      page === "chat" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("label", { children: t("\u5DE5\u4F5C\u533A") }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Choice, { t, label: t("\u5FEB\u901F\u804A\u5929\u5DE5\u4F5C\u533A"), value: selectedWorkspace, disabled: busy, onChange: (value) => {
          setWorkspaceId(value);
          setTarget("new");
        }, options: [{ value: "", label: context.workspacesReady ? t("\u8BF7\u9009\u62E9\u5DE5\u4F5C\u533A") : t("\u6B63\u5728\u8BFB\u53D6\u5DE5\u4F5C\u533A\u2026") }, ...context.workspaces.map((item) => ({ value: item.workspaceId, label: item.title, detail: item.path }))] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("label", { children: t("\u4F1A\u8BDD") }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Choice, { t, label: t("\u53D1\u9001\u5230"), value: target, disabled: busy || !selectedWorkspace, onChange: setTarget, options: [{ value: "new", label: t("+ \u65B0\u4F1A\u8BDD") }, ...availableSessions.map((item) => ({ value: item.sessionId, label: item.title }))] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("textarea", { ref: input, "aria-label": t("\u5FEB\u901F\u804A\u5929\u5185\u5BB9"), placeholder: t("\u6B64\u523B\uFF0C\u4F60\u60F3\u4E00\u8D77\u505A\u70B9\u4EC0\u4E48\uFF1F"), value: text, disabled: busy, onChange: (event) => setText(event.target.value), onKeyDown: (event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            if (text.trim() && !requiresNativeComposer(text)) submit();
          }
        } }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "dhp-shortcut", children: requiresNativeComposer(text) ? t("\u8FD9\u6761\u60F3\u6CD5\u5305\u542B\u4E0A\u4E0B\u6587\uFF0C\u8BF7\u8F6C\u5230\u4E3B\u4F1A\u8BDD\u7EE7\u7EED\u7F16\u8F91\u3002") : t("Enter \u53D1\u9001 \xB7 Shift+Enter \u6362\u884C") }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dhp-actions dhp-compose-actions", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "dhp-button", disabled: busy || !context.capabilities.composer, onClick: composer, children: t("\u5728\u4E3B\u4F1A\u8BDD\u7F16\u8F91") }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "dhp-button primary", disabled: busy || !text.trim() || requiresNativeComposer(text) || !context.capabilities.sendMessage, onClick: submit, children: busy ? t("\u5904\u7406\u4E2D\u2026") : t("\u53D1\u9001 \u2197") })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "dhp-muted-note", children: t("\u6587\u4EF6\u3001@ \u4E0A\u4E0B\u6587\u3001\u6280\u80FD\u548C\u8BED\u97F3\u8F93\u5165\u53EF\u5728\u4E3B\u4F1A\u8BDD\u4E2D\u6DFB\u52A0\u3002\u8349\u7A3F\u8F6C\u5165\u540E\u7531\u4F60\u53D1\u9001\u3002") })
      ] }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
        !visible.length && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dhp-dock-empty", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { "aria-hidden": "true", children: "\u2713" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { children: hidden ? t("\u63D0\u9192\u5DF2\u6536\u8D77") : t("\u90FD\u5B89\u6392\u597D\u4E86") }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "dhp-muted-note", children: hidden ? t("\u9700\u8981\u65F6\u53EF\u4EE5\u6062\u590D\u67E5\u770B\u3002") : t("\u6682\u65F6\u6CA1\u6709\u9700\u8981\u5173\u6CE8\u7684\u4EFB\u52A1\u3002") })
        ] }),
        visible.map((row) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("article", { className: "dhp-activity", "data-state": row.state, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { children: row.title }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { children: t(row.label) }),
          row.state === "blocked" && row.error && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { children: String(row.error.message || row.error).slice(0, 240) }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dhp-actions", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "dhp-button primary", disabled: busy, onClick: () => run(async () => {
              await actions.openSession(row.id);
              setPage(null);
            }), children: row.pendingInteraction ? t("\u524D\u5F80\u5904\u7406") : t("\u6253\u5F00") }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "dhp-button", onClick: () => reply(row.id), children: t("\u56DE\u590D") }),
            row.running && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "dhp-button", disabled: busy, onClick: () => run(() => actions.stopSession(row.id)), children: t("\u505C\u6B62") }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "dhp-button", onClick: () => setDismissed((current) => new Map(current).set(row.id, keyFor(row))), children: t("\u6536\u8D77") }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "dhp-button", onClick: () => mute(row.id), children: t("\u9759\u97F3") })
          ] })
        ] }, row.id)),
        (hidden > 0 || muted.size > 0 || dismissed.size > 0) && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("button", { className: "dhp-button", onClick: () => {
          setDismissed(/* @__PURE__ */ new Map());
          setMuted(/* @__PURE__ */ new Set());
          try {
            localStorage.removeItem("dsh-hide-pet:muted");
          } catch {
          }
        }, children: [
          t("\u6062\u590D\u63D0\u9192"),
          hidden ? t("\uFF08\u5DF2\u9690\u85CF {count} \u6761\uFF09", { count: hidden }) : ""
        ] })
      ] })
    ] })
  ] });
}

// src/shortcuts.mjs
function registerPetShortcut(shortcuts, run, warn = console.warn) {
  if (!shortcuts?.register) return () => {
  };
  const command = {
    id: "dsh-hide-pet.quick-chat",
    label: () => "\u5BA0\u7269\uFF1A\u5FEB\u901F\u804A\u5929",
    aliases: ["pet", "\u4F19\u4F34"],
    defaults: Object.fromEntries(["desktop:windows", "desktop:linux", "desktop:macos", "web:windows", "web:macos"].map((platform) => [platform, { code: "KeyP", modifiers: ["primary", "alt", "shift"] }])),
    regions: ["page", "editable"],
    modals: [],
    resolve: () => ({ status: "handled", run })
  };
  try {
    return shortcuts.register(command);
  } catch (error) {
    warn("\u5BA0\u7269\u5FEB\u6377\u952E\u672A\u4F7F\u7528\u9ED8\u8BA4\u6309\u952E\uFF0C\u5C06\u5C1D\u8BD5\u4FDD\u7559\u4E3A\u53EF\u81EA\u5B9A\u4E49\u547D\u4EE4\u3002", error);
    try {
      return shortcuts.register({ ...command, defaults: {} });
    } catch (fallbackError) {
      warn("\u5BA0\u7269\u5FEB\u6377\u952E\u4E0D\u53EF\u7528\uFF1B\u4ECD\u53EF\u4F7F\u7528\u8BBE\u7F6E\u9875\u548C\u5BA0\u7269\u64CD\u4F5C\u680F\u3002", fallbackError);
      return () => {
      };
    }
  }
}

// src/native-ui.jsx
var import_react3 = __toESM(require("react"), 1);
var import_jsx_runtime3 = require("react/jsx-runtime");
var kit = {};
function setNativeUi(value) {
  kit = value || {};
}
function UiButton({ className = "", variant, ...props }) {
  const selected = variant || (className.split(" ").includes("primary") ? "primary" : "outline");
  if (kit.Button) return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(kit.Button, { ...props, size: "sm", variant: selected, "data-dhp-variant": selected, className: `dhp-native-button${className.includes("danger") ? " dhp-action-danger" : ""} ${className.split(" ").filter((name) => !["dhp-button", "primary", "danger"].includes(name)).join(" ")}` });
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { ...props, className: className || `dhp-button ${selected}` });
}
function UiInput(props) {
  return kit.Input ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(kit.Input, { ...props }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("input", { ...props });
}
function UiSwitch(props) {
  if (kit.Switch) return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(kit.Switch, { ...props });
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("input", { type: "checkbox", "aria-label": props.label, checked: props.checked, disabled: props.disabled, onChange: (event) => props.onChange(event.target.checked) });
}
function UiTabs({ value, onChange, language = "zh-CN" }) {
  const t = createTranslator(language);
  const items = [{ value: "library", label: t("\u4F19\u4F34") }, { value: "settings", label: t("\u5916\u89C2\u4E0E\u884C\u4E3A") }, { value: "motion", label: t("\u52A8\u4F5C") }, { value: "import", label: t("\u5BFC\u5165") }];
  if (kit.SegmentedTabs) return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(kit.SegmentedTabs, { items, value, onChange, label: t("\u5BA0\u7269\u4F19\u4F34\u8BBE\u7F6E") });
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { role: "tablist", "aria-label": t("\u5BA0\u7269\u4F19\u4F34\u8BBE\u7F6E"), children: items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { role: "tab", "aria-selected": value === item.value, onClick: () => onChange(item.value), children: item.label }, item.value)) });
}
var settingsCss = `
.dhp-language-note{font-size:12px;line-height:1.5;font-weight:400;letter-spacing:normal;color:var(--dsw-alias-label-secondary,var(--hp-muted))}
.dhp-root .dhp-native-button{color:var(--dsw-alias-label-primary,var(--hp-text))}.dhp-root .dhp-native-button[data-dhp-variant=primary]{color:var(--dsw-alias-label-primary-foreground,#fff)}
.dhp-root.dhp-settings{position:relative;inset:auto;pointer-events:auto;width:100%;min-width:0;height:auto;font:inherit;color:var(--dsw-alias-label-primary);background:transparent}
.dhp-settings .dhp-panel{position:static;width:100%;max-width:760px;max-height:none;overflow:visible;border:0;border-radius:0;box-shadow:none;animation:none;background:transparent}
.dhp-settings .dhp-head{padding:0 0 20px;align-items:center;gap:16px}.dhp-settings .dhp-head h2{font-size:16px;font-weight:500;line-height:24px;letter-spacing:0;margin:0}.dhp-settings .dhp-head p{font-size:12px;line-height:18px;margin:5px 0 0;color:var(--dsw-alias-label-secondary)}
.dhp-settings .dhp-tabs{display:block;margin:0 0 20px;padding:0;background:none;border-radius:0}.dhp-settings .dhp-tabs>div{width:100%}.dhp-settings .dhp-tabs button{font-size:13px;line-height:20px;flex:initial;box-shadow:none}
.dhp-settings .dhp-body{padding:0 0 20px}.dhp-settings .dhp-grid{grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px}.dhp-settings .dhp-card{border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-lg,12px);padding:8px 12px 12px;background:transparent;box-shadow:none}.dhp-settings .dhp-card:hover{background:var(--dsw-alias-interactive-bg-hover)}.dhp-settings .dhp-card[aria-pressed=true]{border-color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover);box-shadow:none}.dhp-settings .dhp-art-stage{height:106px;background:none}.dhp-settings .dhp-card-name{font-size:13px;font-weight:500;margin:3px 0}.dhp-settings .dhp-card-note{font-size:11px;line-height:16px}.dhp-settings .dhp-check{width:17px;height:17px;background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);font-size:10px;right:8px;top:8px}.dhp-settings .dhp-selected{margin-top:20px;padding-top:16px;border-color:var(--dsw-alias-border-l2)}.dhp-settings .dhp-detail-title{font-size:14px;font-weight:500}.dhp-settings .dhp-detail-note{font-size:12px;line-height:18px;margin:4px 0 14px}.dhp-settings .dhp-actions{gap:8px}.dhp-settings .dhp-footer{font-size:11px;line-height:18px;color:var(--dsw-alias-label-tertiary);margin-top:16px}.dhp-settings .dhp-status{font-size:11px;margin-top:12px}.dhp-settings .dhp-tag{background:var(--dsw-alias-interactive-bg-hover);font-size:10px}.dhp-settings .dhp-field{font-size:13px;gap:8px;margin:16px 0}.dhp-settings .dhp-field input[type=text]{font:inherit}.dhp-setting-row{display:flex;justify-content:space-between;align-items:center;gap:24px;padding:16px 0;border-bottom:.5px solid var(--dsw-alias-border-l2);font-size:14px;line-height:20px}.dhp-setting-row p{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);margin:4px 0 0}.dhp-setting-row [role=switch]{flex-shrink:0}.dhp-action-danger{color:var(--dsw-alias-state-error-primary)!important}.dhp-settings .dhp-upload{padding:20px 16px;background:transparent;border:.5px dashed var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-lg,12px)}.dhp-settings .dhp-preview{background:none}.dhp-settings .dhp-animation-grid button,.dhp-settings .dhp-direction-grid button{font-size:12px;border-radius:var(--dsw-radius-sm,8px);border:.5px solid var(--dsw-alias-border-l3);background:transparent}.dhp-settings .dhp-animation-grid button[aria-pressed=true],.dhp-settings .dhp-direction-grid button[aria-pressed=true]{color:var(--dsw-alias-label-primary);border-color:currentColor;background:var(--dsw-alias-interactive-bg-hover)}

.dhp-root .dhp-head{gap:16px;align-items:center}.dhp-root .dhp-head kbd{font:inherit;font-size:11px;border-radius:6px;padding:3px 6px;background:var(--hp-soft);white-space:nowrap}.dhp-root .dhp-head h2{letter-spacing:0}.dhp-home-hero{position:relative;min-height:320px;border:1px solid var(--dsw-alias-border-l3,var(--hp-border));border-radius:20px;display:flex;align-items:center;justify-content:center;padding:24px 20px 64px}.dhp-home-character{display:flex;flex-direction:column;align-items:center;gap:8px}.dhp-home-toolbar{display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--dsw-alias-background-primary,var(--hp-bg));border:1px solid var(--dsw-alias-border-l3,var(--hp-border));box-shadow:0 5px 22px #00000012;border-radius:99px}.dhp-home-toolbar button{border:0;background:transparent;box-shadow:none;border-radius:99px}.dhp-home-toolbar>span{color:var(--hp-muted)}.dhp-root .dhp-home-customize{position:absolute;right:18px;bottom:18px}.dhp-library-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:32px 0 16px}.dhp-library-head h3{font-size:15px;font-weight:600;margin:0}.dhp-root .dhp-home-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.dhp-root .dhp-home-grid .dhp-card{text-align:center;border-radius:18px;padding:18px 14px 20px;transition:border-color .18s,background .18s}.dhp-root .dhp-home-grid .dhp-card[aria-pressed=true]{border-color:var(--dsw-alias-label-primary,var(--hp-text));box-shadow:inset 0 0 0 1px var(--dsw-alias-border-l3,var(--hp-border));background:var(--dsw-alias-interactive-bg-hover,var(--hp-soft))}.dhp-root .dhp-home-grid .dhp-art-stage{height:142px;background:none}.dhp-root .dhp-home-grid .dhp-card-name{margin:10px 0 6px;font-size:14px}.dhp-root .dhp-home-grid .dhp-card-note{font-size:12px;line-height:1.6;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.dhp-mini-illustration{display:flex;align-items:center;gap:12px;border-radius:99px;background:var(--dsw-alias-background-primary,var(--hp-bg));border:1px solid var(--dsw-alias-border-l3,var(--hp-border));box-shadow:0 5px 22px #00000012;padding:10px 16px;font-size:19px}.dhp-mini-illustration i{height:20px;border-left:1px solid var(--hp-border)}.dhp-management summary{cursor:pointer;font-size:13px;color:var(--dsw-alias-label-secondary,var(--hp-muted));padding:4px 0}.dhp-management-body{padding-top:16px}.dhp-settings .dhp-head h2{font-size:25px;line-height:1.3;font-weight:600}.dhp-settings .dhp-head p{margin-top:10px;line-height:1.8}.dhp-settings .dhp-panel{container-type:inline-size}.dhp-settings .dhp-tabs{margin-bottom:22px}@container(max-width:460px){.dhp-root .dhp-home-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.dhp-root .dhp-head{align-items:flex-start;flex-wrap:wrap}.dhp-home-hero{min-height:300px}}@media(max-width:480px){.dhp-root .dhp-home-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.dhp-library-head{flex-wrap:wrap}.dhp-root .dhp-home-grid .dhp-art-stage{height:116px}}
`;

// src/client-entry.jsx
var import_jsx_runtime4 = require("react/jsx-runtime");
var nativeKit = false ? null : require("@deepseek-ai/dsh-client-ui-primitives");
var inject = ["slots", "uiSession", "sessions", "uiWorkspace", "workspaces", "conversation", "remote", "shortcuts", "layout"];
var EMPTY_SESSIONS = Object.freeze({ byId: {} });
var EMPTY_STATUS = /* @__PURE__ */ new Map();
var emptySource = (value) => ({ getSnapshot: () => value, subscribe: () => () => {
} });
var EMPTY_SESSION_SOURCE = emptySource(EMPTY_SESSIONS);
var EMPTY_STATUS_SOURCE = emptySource(EMPTY_STATUS);
var EMPTY_ACTIVE_SOURCE = emptySource(null);
var EMPTY_WORKSPACE_SOURCE = emptySource(null);
var API_ROOT = () => new URL("dsh-hide-pet/api/", document.baseURI);
var css = `
.dhp-root{--hp-bg:var(--dsw-alias-bg-base,#fff);--hp-text:var(--dsw-alias-label-primary,#18213a);--hp-soft:var(--dsw-alias-interactive-bg-hover,#f1f5fb);--hp-border:var(--dsw-alias-border-l3,#dbe4f0);--hp-muted:var(--dsw-alias-label-secondary,#6c7890);font-family:Inter,"Segoe UI","Microsoft YaHei",sans-serif;color:var(--hp-text);position:absolute;inset:0;pointer-events:none;font-size:13px;line-height:1.5}
.dhp-root *{box-sizing:border-box}.dhp-root button:not(.dhp-native-button),.dhp-root input,.dhp-root select{font:inherit}.dhp-root button{cursor:pointer}.dhp-root button:focus-visible,.dhp-root input:focus-visible,.dhp-root select:focus-visible{outline:3px solid #718dff;outline-offset:3px}.dhp-root button:disabled{cursor:wait;opacity:.5}.dhp-root button{color:inherit}.dhp-launcher{position:absolute;right:20px;bottom:20px;display:flex;align-items:center;gap:9px;padding:10px 15px;border:1px solid var(--hp-border);border-radius:99px;background:var(--hp-bg);box-shadow:0 5px 24px #101e3d16;pointer-events:auto;font-weight:600}.dhp-launcher span:first-child{color:#597aff;font-size:18px}.dhp-pet{position:absolute;touch-action:none;user-select:none;pointer-events:auto;cursor:grab;outline:none;filter:drop-shadow(0 8px 9px #263f7422)}.dhp-pet[data-dragging=true]{cursor:grabbing}.dhp-sprite{background-repeat:no-repeat;flex:none;image-rendering:auto;pointer-events:none}.dhp-load-art{display:grid;place-items:center;color:var(--hp-muted);font-size:11px;text-align:center;padding:12px}.dhp-pet-bubble{position:absolute;bottom:calc(100% - 10px);left:50%;transform:translateX(-50%);border:1px solid var(--hp-border);border-radius:12px;background:var(--hp-bg);padding:7px 11px;white-space:nowrap;font-size:11px;box-shadow:0 3px 12px #13294c11;pointer-events:none;opacity:0;transition:opacity .2s}.dhp-pet:hover .dhp-pet-bubble,.dhp-pet:focus-visible .dhp-pet-bubble{opacity:1}.dhp-panel{position:absolute;right:20px;bottom:76px;width:430px;max-width:calc(100vw - 24px);max-height:calc(100vh - 110px);overflow:auto;pointer-events:auto;background:var(--hp-bg);border:1px solid var(--hp-border);border-radius:22px;box-shadow:0 20px 70px #15255030;animation:dhp-in .16s ease-out}.dhp-head{display:flex;align-items:flex-start;justify-content:space-between;padding:22px 24px 16px}.dhp-eyebrow{font-size:10px;letter-spacing:.16em;color:#6680d9;font-weight:700}.dhp-head h2{font-size:23px;margin:3px 0 2px;letter-spacing:-.04em}.dhp-head p{color:var(--hp-muted);font-size:12px;margin:0}.dhp-icon-button{border:0;background:transparent;border-radius:10px;width:30px;height:30px;font-size:22px;display:grid;place-items:center;color:var(--hp-muted)!important}.dhp-icon-button:hover{background:var(--hp-soft)}.dhp-tabs{display:flex;gap:6px;margin:0 24px 16px;padding:4px;border-radius:12px;background:var(--hp-soft)}.dhp-tabs button{flex:1;border:0;background:transparent;border-radius:9px;padding:7px;font-size:12px;color:var(--hp-muted)}.dhp-tabs button[aria-selected=true]{background:var(--hp-bg);box-shadow:0 1px 5px #17274d12;color:var(--hp-text);font-weight:600}.dhp-body{padding:0 24px 24px}.dhp-status{display:flex;align-items:center;gap:7px;color:var(--hp-muted);font-size:11px;margin:0 0 15px}.dhp-dot{height:6px;width:6px;border-radius:50%;background:#6bbba2}.dhp-dot[data-working=true]{background:#6587ff;box-shadow:0 0 0 4px #6587ff15}.dhp-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.dhp-card{position:relative;min-width:0;border:1px solid var(--hp-border);background:var(--hp-bg);border-radius:16px;padding:9px 10px 14px;text-align:left;overflow:hidden}.dhp-card[aria-pressed=true]{border-color:#6684ef;box-shadow:0 0 0 2px #6684ef18;background:linear-gradient(145deg,#7194ff0b,transparent)}.dhp-art-stage{height:144px;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at 50% 65%,#7598f116,transparent 65%);border-radius:10px}.dhp-card-name{display:block;font-size:14px;font-weight:650;margin:6px 0 2px}.dhp-card-note{display:block;color:var(--hp-muted);font-size:10px;line-height:1.5}.dhp-check{position:absolute;right:10px;top:9px;display:grid;place-items:center;width:20px;height:20px;border-radius:50%;background:#6482ef;color:#fff;font-size:12px}.dhp-selected{margin-top:18px;padding-top:17px;border-top:1px solid var(--hp-border)}.dhp-detail-title{display:flex;align-items:center;justify-content:space-between;gap:8px;font-weight:650;margin-bottom:4px}.dhp-detail-note{font-size:11px;line-height:1.6;color:var(--hp-muted);margin:0 0 13px}.dhp-actions{display:flex;gap:7px;flex-wrap:wrap}.dhp-button{border:1px solid var(--hp-border);border-radius:9px;background:var(--hp-bg);padding:7px 11px;font-size:11px!important;transition:background .15s}.dhp-button:hover{background:var(--hp-soft)}.dhp-button.primary{background:#5879ed;border-color:#5879ed;color:#fff}.dhp-button.danger{color:#cb5e6b}.dhp-tag{font-size:9px;font-weight:500;padding:2px 6px;border-radius:5px;background:var(--hp-soft);color:var(--hp-muted)}.dhp-field{display:grid;gap:6px;font-size:12px;margin-bottom:15px}.dhp-field input[type=text],.dhp-field select{border:1px solid var(--hp-border);border-radius:9px;color:var(--hp-text);background:var(--hp-bg);padding:9px 10px;width:100%}.dhp-field input[type=range]{width:100%;accent-color:#6382ee}.dhp-field-head{display:flex;justify-content:space-between}.dhp-field-head small{color:var(--hp-muted)}.dhp-toggle{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:12px 0;border-top:1px solid var(--hp-border)}.dhp-toggle p{font-size:10px;color:var(--hp-muted);margin:2px 0 0}.dhp-toggle input{accent-color:#6382ee;margin-top:4px}.dhp-upload{border:1px dashed #8196cf;border-radius:15px;padding:24px 18px;text-align:center;background:#8196cf07;margin-bottom:17px}.dhp-upload strong{font-size:13px;display:block}.dhp-upload p{font-size:11px;line-height:1.8;color:var(--hp-muted);margin:8px 0 14px}.dhp-file{font-size:11px;overflow-wrap:anywhere;color:var(--hp-muted);margin-top:10px}.dhp-preview{display:grid;place-items:center;min-height:160px;background:radial-gradient(ellipse,#7598f118,transparent 70%);margin:-8px 0 10px}.dhp-animation-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.dhp-animation-grid button,.dhp-direction-grid button{font-size:10px;border:1px solid var(--hp-border);padding:7px 3px;border-radius:8px;background:var(--hp-bg)}.dhp-animation-grid button[aria-pressed=true],.dhp-direction-grid button[aria-pressed=true]{border-color:#6684ef;background:#6684ef12;color:#6684ef}.dhp-label{font-size:11px;font-weight:600;margin:17px 0 8px}.dhp-direction-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.dhp-message{font-size:11px;padding:10px 12px;border:1px solid #91adff55;background:#91adff0d;border-radius:10px;margin-bottom:12px;overflow-wrap:anywhere}.dhp-message[data-error=true]{color:#c35a6c;border-color:#d8879655;background:#d887960b}.dhp-empty{font-size:12px;color:var(--hp-muted);padding:25px;text-align:center}.dhp-menu{position:absolute;min-width:170px;padding:6px;border:1px solid var(--hp-border);border-radius:13px;background:var(--hp-bg);box-shadow:0 9px 35px #172b5426;pointer-events:auto;z-index:10}.dhp-menu button{display:block;border:0;background:transparent;width:100%;text-align:left;font-size:12px;padding:8px 11px;border-radius:8px}.dhp-menu button:hover{background:var(--hp-soft)}.dhp-menu small{display:block;font-size:10px;color:var(--hp-muted);padding:6px 11px;border-bottom:1px solid var(--hp-border);margin-bottom:3px}.dhp-footer{color:var(--hp-muted);font-size:10px;margin:14px 0 0;line-height:1.8}.dhp-spinner{display:inline-block;width:12px;height:12px;border:2px solid #7a91da44;border-top-color:#6684ef;border-radius:50%;animation:dhp-spin 1s linear infinite;margin-right:5px;vertical-align:middle}@keyframes dhp-spin{to{transform:rotate(360deg)}}@keyframes dhp-in{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}@media(prefers-reduced-motion:reduce){.dhp-root *{animation:none!important;transition:none!important}}@media(max-width:480px){.dhp-panel{right:12px;bottom:70px;border-radius:18px}.dhp-head{padding:18px 18px 13px}.dhp-body{padding:0 18px 18px}.dhp-tabs{margin:0 18px 14px}.dhp-launcher{right:12px;bottom:14px}}
`;
function useSource2(source, fallback) {
  const actual = (0, import_react4.useMemo)(() => bindExternalSource(source || fallback), [source, fallback]);
  return (0, import_react4.useSyncExternalStore)(actual.subscribe, actual.getSnapshot, actual.getSnapshot);
}
function Sprite({ pet, animation = "idle", gaze = null, scale = 0.6, reducedMotion = false, loop = false, language = "zh-CN" }) {
  const t = createTranslator(language);
  const [time, setTime] = (0, import_react4.useState)(0);
  const [failed, setFailed] = (0, import_react4.useState)(false);
  const start = (0, import_react4.useRef)(Date.now());
  const version = Number(pet?.spriteVersion) === 1 ? 1 : 2;
  const src = pet?.spritesheetUrl ? resolveAssetUrl(pet.spritesheetUrl, document.baseURI) : "";
  (0, import_react4.useEffect)(() => {
    setFailed(false);
    if (!src) return;
    const image = new Image();
    image.onerror = () => setFailed(true);
    image.src = src;
    return () => {
      image.onerror = null;
    };
  }, [src]);
  (0, import_react4.useEffect)(() => {
    start.current = Date.now();
    setTime(0);
    if (reducedMotion || gaze !== null) return;
    const timer = setInterval(() => setTime(Date.now() - start.current), 80);
    return () => clearInterval(timer);
  }, [animation, gaze, reducedMotion, src]);
  const width = CELL.width * scale;
  const height = CELL.height * scale;
  if (!src || failed) return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dhp-load-art", style: { width, height }, children: failed ? t("\u5F62\u8C61\u6682\u672A\u52A0\u8F7D") : t("\u51C6\u5907\u5F62\u8C61\u4E2D\u2026") });
  const frame = frameFor(animation, time, { reducedMotion, gaze, version, loop });
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dhp-sprite", "aria-hidden": "true", style: { width, height, backgroundImage: `url(${JSON.stringify(src)})`, backgroundSize: `${width * 8}px ${height * frame.rows}px`, backgroundPosition: `${-width * frame.column}px ${-height * frame.row}px` } });
}
async function apiRequest(endpoint, body, signal) {
  const response = await fetch(new URL(endpoint, API_ROOT()), {
    method: body ? "POST" : "GET",
    credentials: "same-origin",
    cache: "no-store",
    signal,
    headers: body ? { "Content-Type": "application/json" } : {},
    ...body ? { body: JSON.stringify(body) } : {}
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error(`\u5BA0\u7269\u670D\u52A1\u54CD\u5E94\u5F02\u5E38\uFF08${response.status}\uFF09`);
  }
  if (!response.ok || result?.error) throw new Error(typeof result?.error === "string" ? result.error : result?.error?.message || `\u64CD\u4F5C\u5931\u8D25\uFF08${response.status}\uFF09`);
  return result;
}
function fileBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("\u6587\u4EF6\u8BFB\u53D6\u5931\u8D25"));
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.readAsDataURL(file);
  });
}
function downloadArchive(result) {
  if (!result.archiveBase64) throw new Error("\u5BFC\u51FA\u6CA1\u6709\u8FD4\u56DE\u6587\u4EF6");
  const bytes = Uint8Array.from(atob(result.archiveBase64), (char) => char.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/zip" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = result.filename || "pet.zip";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1e3);
}
function PetApp({ ctx, settingsOnly = false, closeSettings }) {
  const [state, setState] = (0, import_react4.useState)({ pets: [], preferences: {} });
  const language = state.preferences?.language || "zh-CN";
  const t = (0, import_react4.useMemo)(() => createTranslator(language), [language]);
  (0, import_react4.useEffect)(() => {
    window.dispatchEvent(new CustomEvent("dhp-language", { detail: language }));
  }, [language]);
  const [ready, setReady] = (0, import_react4.useState)(false);
  const open = settingsOnly;
  const [tab, setTab] = (0, import_react4.useState)("library");
  const [busy, setBusy] = (0, import_react4.useState)(false);
  const [message, setMessage] = (0, import_react4.useState)(null);
  const [menu, setMenu] = (0, import_react4.useState)(null);
  const [position, setPosition] = (0, import_react4.useState)(null);
  const [dragging, setDragging] = (0, import_react4.useState)(false);
  const [dragAnimation, setDragAnimation] = (0, import_react4.useState)("running-right");
  const [hover, setHover] = (0, import_react4.useState)(false);
  const [interaction, setInteraction] = (0, import_react4.useState)(null);
  const [gaze, setGaze] = (0, import_react4.useState)(null);
  const [preview, setPreview] = (0, import_react4.useState)("idle");
  const [previewGaze, setPreviewGaze] = (0, import_react4.useState)(null);
  const [upload, setUpload] = (0, import_react4.useState)(null);
  const [uploadName, setUploadName] = (0, import_react4.useState)("");
  const [rename, setRename] = (0, import_react4.useState)("");
  const [description, setDescription] = (0, import_react4.useState)("");
  const [errors, setErrors] = (0, import_react4.useState)(/* @__PURE__ */ new Map());
  const [chatFocus, setChatFocus] = (0, import_react4.useState)(0);
  const [confirmDelete, setConfirmDelete] = (0, import_react4.useState)(false);
  const [osReduced, setOsReduced] = (0, import_react4.useState)(false);
  const [completions, setCompletions] = (0, import_react4.useState)([]);
  const [completionBubble, setCompletionBubble] = (0, import_react4.useState)(null);
  const completionTracker = (0, import_react4.useRef)(createCompletionTracker());
  const mounted = (0, import_react4.useRef)(true);
  const stateRef = (0, import_react4.useRef)(state);
  const requestRef = (0, import_react4.useRef)(null);
  const drag = (0, import_react4.useRef)(null);
  const moveRaf = (0, import_react4.useRef)(null);
  const timer = (0, import_react4.useRef)(null);
  const panel = (0, import_react4.useRef)(null);
  const fileInput = (0, import_react4.useRef)(null);
  const replacementInput = (0, import_react4.useRef)(null);
  const keyboardOrigin = (0, import_react4.useRef)(null);
  const desktopFacts = (0, import_react4.useRef)({});
  const native = (0, import_react4.useMemo)(() => createHarnessActions(ctx), [ctx]);
  const sessions = useSource2(ctx.sessions?.list, EMPTY_SESSION_SOURCE);
  const statuses = useSource2(ctx.uiSession?.sessionStatus, EMPTY_STATUS_SOURCE);
  useSource2(ctx.workspaces?.list, EMPTY_WORKSPACE_SOURCE);
  const ids = [.../* @__PURE__ */ new Set([...Object.keys(sessions.byId || {}), ...statuses.keys()])].sort().join("\0");
  const sessionSources = (0, import_react4.useMemo)(() => combineSessionSources(ids.split("\0").filter(Boolean).flatMap((id) => {
    const source = ctx.sessions?.binding?.(id)?.session;
    return source ? [{ id, source: sessionActivitySource(source) }] : [];
  })), [ctx, ids, sessions]);
  const snapshots = useSource2(sessionSources, EMPTY_ACTIVE_SOURCE);
  const facts = (0, import_react4.useMemo)(() => {
    const result = new Map(snapshots);
    for (const [id, message2] of errors) if (!statuses.get(id)?.running) result.set(id, { ...result.get(id), lastAgentError: message2 });
    return result;
  }, [snapshots, errors, statuses]);
  const rows = (0, import_react4.useMemo)(() => activityRows(sessions, statuses, facts), [sessions, statuses, facts]);
  const presentation = taskPresentation(sessions, statuses, null, facts);
  const prefs = state.preferences || {};
  const desktopSurface = Boolean(state.desktop?.active && prefs.surface !== "app");
  desktopFacts.current = { presentation: { animation: presentation.animation, label: presentation.label }, rows: rows.map(({ id, title, state: state2, label }) => ({ id, title, state: state2, label })), completions, osReduced, context: native.getContext() };
  const pet = state.pets.find((item) => item.id === prefs.selectedPetId) || state.pets[0];
  const scale = Number.isFinite(prefs.scale) ? prefs.scale : 0.72;
  const size = prefs.mode === "mini" ? { width: language === "en" ? 280 : 250, height: 48 } : { width: CELL.width * scale, height: CELL.height * scale };
  const reduced = Boolean(prefs.reducedMotion || osReduced);
  const visible = prefs.visible !== false;
  const mini = prefs.mode === "mini";
  const currentPosition = clampPosition(position || prefs.position, { width: window.innerWidth, height: window.innerHeight }, size);
  const completionPosition = inwardBubblePosition({ ...currentPosition, ...size }, { width: window.innerWidth, height: window.innerHeight });
  (0, import_react4.useEffect)(() => {
    if (settingsOnly) return;
    const notices = completionTracker.current(activityRows(sessions, statuses, facts, { includeIdle: true }));
    if (notices.length) {
      setCompletions((previous) => [...previous.filter((item) => item.expiresAt > Date.now()), ...notices].slice(-10));
      setCompletionBubble(notices.at(-1));
    }
  }, [settingsOnly, sessions, statuses, facts]);
  (0, import_react4.useEffect)(() => {
    if (!completionBubble) return;
    const timeout = setTimeout(() => setCompletionBubble(null), 8e3);
    return () => clearTimeout(timeout);
  }, [completionBubble]);
  const acceptState = (result) => {
    const next = result?.state || result;
    if (Array.isArray(next?.pets) && next.preferences) {
      stateRef.current = next;
      setState(next);
      if (!drag.current && !keyboardOrigin.current) setPosition(next.preferences.position || null);
    }
  };
  (0, import_react4.useEffect)(() => {
    mounted.current = true;
    let stopped = false;
    let polling;
    const controller = new AbortController();
    const refresh = async () => {
      clearTimeout(polling);
      try {
        const next = await apiRequest("state", void 0, controller.signal);
        if (!stopped) {
          acceptState(next);
          setReady(true);
        }
      } catch (error) {
        if (!stopped && error.name !== "AbortError") setMessage({ error: true, text: error.message });
      } finally {
        if (!stopped) polling = setTimeout(refresh, 4e3);
      }
    };
    refresh();
    window.addEventListener("dhp-state-change", refresh);
    const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onReduced = () => setOsReduced(reducedQuery.matches);
    onReduced();
    reducedQuery.addEventListener("change", onReduced);
    return () => {
      stopped = true;
      mounted.current = false;
      controller.abort();
      requestRef.current?.abort();
      clearTimeout(polling);
      window.removeEventListener("dhp-state-change", refresh);
      clearTimeout(timer.current);
      if (moveRaf.current) cancelAnimationFrame(moveRaf.current);
      reducedQuery.removeEventListener("change", onReduced);
    };
  }, []);
  (0, import_react4.useEffect)(() => {
    setRename(pet?.name || "");
    setDescription(pet?.description || "");
    setConfirmDelete(false);
  }, [pet?.id, pet?.name]);
  (0, import_react4.useEffect)(() => native.subscribeErrors(({ id, message: message2 }) => setErrors((previous) => new Map(previous).set(id, message2))), [native]);
  (0, import_react4.useEffect)(() => {
    if (settingsOnly) return;
    const focus = () => {
      if (stateRef.current.desktop?.active && stateRef.current.preferences.surface !== "app") apiRequest("desktop/command", { name: "toggle-chat" }).catch(() => {
      });
      else setChatFocus((value) => value + 1);
    };
    window.addEventListener("dhp-focus-chat", focus);
    return () => window.removeEventListener("dhp-focus-chat", focus);
  }, [settingsOnly]);
  (0, import_react4.useEffect)(() => {
    if (settingsOnly || location.protocol !== "dsh-app:" || !state.desktop?.supported) return;
    let stopped = false, polling, replies = [];
    const controller = new AbortController();
    const sync = async () => {
      try {
        const color = getComputedStyle(document.querySelector(".dhp-root") || document.body).color;
        const rgb = color.match(/[\d.]+/g)?.map(Number) || [30, 30, 30];
        const result = await apiRequest("desktop/sync", { facts: { ...desktopFacts.current, theme: { dark: rgb[0] + rgb[1] + rgb[2] > 400 } }, replies }, controller.signal);
        replies = [];
        for (const event of result.events || []) {
          try {
            if (event.type === "send-chat") await native.sendMessage({ text: event.text, workspaceId: event.workspaceId, sessionId: event.sessionId });
            else if (event.type === "edit-chat") await native.openMainComposer({ text: event.text, workspaceId: event.workspaceId, sessionId: event.sessionId });
            else if (event.type === "open-session") native.openSession(event.sessionId);
            else if (event.type === "open-settings") {
              const entry = ctx.slots.entries("sidebar.settings").find((item) => item.options?.store?.create);
              const actions = entry?.options?.store?.create()?.actions;
              if (!actions?.openSection) throw new Error(t("\u8BF7\u4ECE\u66F4\u591A \u2192 \u8BBE\u7F6E\u6253\u5F00\u5BA0\u7269\u4F19\u4F34\u3002"));
              actions.openSection("dsh-codex-mini-pet");
            }
            replies.push({ id: event.id, kind: event.type, ok: true, ...event.type === "edit-chat" ? { message: t("\u5DF2\u8F6C\u5165\u4E3B\u4F1A\u8BDD\u8349\u7A3F\uFF0C\u7531\u4F60\u53D1\u9001") } : {} });
          } catch (error) {
            replies.push({ id: event.id, kind: event.type, ok: false, error: error.message });
          }
        }
      } catch {
      } finally {
        if (!stopped) polling = setTimeout(sync, 750);
      }
    };
    sync();
    return () => {
      stopped = true;
      controller.abort();
      clearTimeout(polling);
    };
  }, [settingsOnly, state.desktop?.supported, native, ctx]);
  (0, import_react4.useEffect)(() => {
    setErrors((previous) => {
      const next = new Map(previous);
      for (const [id] of next) if (statuses.get(id)?.running || !sessions.byId?.[id]) next.delete(id);
      return next.size === previous.size ? previous : next;
    });
  }, [statuses, sessions]);
  (0, import_react4.useEffect)(() => {
    if (!menu) return;
    const close = (event) => {
      if (event.key === "Escape") setMenu(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open, menu]);
  (0, import_react4.useEffect)(() => {
    if (!menu) return;
    const dismiss = (event) => {
      if (!event.target.closest(".dhp-menu")) setMenu(null);
    };
    window.addEventListener("pointerdown", dismiss);
    return () => window.removeEventListener("pointerdown", dismiss);
  }, [menu]);
  (0, import_react4.useEffect)(() => {
    const resize = () => {
      const current = stateRef.current.preferences;
      const bounds = current.mode === "mini" ? { width: current.language === "en" ? 280 : 250, height: 48 } : { width: CELL.width * (current.scale || 0.72), height: CELL.height * (current.scale || 0.72) };
      setPosition((previous) => clampPosition(previous || current.position, { width: window.innerWidth, height: window.innerHeight }, bounds));
    };
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  (0, import_react4.useEffect)(() => {
    if (prefs.followPointer === false || reduced || !visible || Number(pet?.spriteVersion) === 1) {
      setGaze(null);
      return;
    }
    let latest;
    const look = (event) => {
      latest = { x: event.clientX, y: event.clientY };
      if (moveRaf.current) return;
      moveRaf.current = requestAnimationFrame(() => {
        moveRaf.current = null;
        if (drag.current) return;
        setGaze(gazeForPoint(latest, { x: currentPosition.x + size.width / 2, y: currentPosition.y + size.height * 0.4 }));
      });
    };
    const leave = () => setGaze(null);
    window.addEventListener("pointermove", look, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);
    return () => {
      window.removeEventListener("pointermove", look);
      document.documentElement.removeEventListener("pointerleave", leave);
      if (moveRaf.current) {
        cancelAnimationFrame(moveRaf.current);
        moveRaf.current = null;
      }
    };
  }, [prefs.followPointer, reduced, visible, pet?.spriteVersion, currentPosition.x, currentPosition.y, size.width, size.height]);
  const perform = async (action, values = {}, success) => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      const result = await apiRequest("action", { action, ...values }, controller.signal);
      if (!mounted.current) return;
      acceptState(result);
      if (!["export", "validate"].includes(action) && !Array.isArray((result?.state || result)?.pets)) {
        const refreshed = await apiRequest("state", void 0, controller.signal);
        if (!mounted.current) return;
        acceptState(refreshed);
      }
      if (success) setMessage({ text: success });
      if (!["export", "validate"].includes(action)) window.dispatchEvent(new Event("dhp-state-change"));
      return result;
    } catch (error) {
      if (mounted.current && error.name !== "AbortError") setMessage({ error: true, text: error.message });
    } finally {
      if (mounted.current) setBusy(false);
      if (requestRef.current === controller) requestRef.current = null;
    }
  };
  const preferences = (patch) => perform("preferences", { patch });
  (0, import_react4.useEffect)(() => {
    if (settingsOnly || desktopSurface || !visible || prefs.visibilityBehavior !== "on-demand") return;
    const outside = (event) => {
      if (!event.target.closest('.dhp-pet,.dhp-dock,.dhp-menu,[role="dialog"]')) preferences({ visible: false });
    };
    window.addEventListener("pointerdown", outside);
    return () => window.removeEventListener("pointerdown", outside);
  }, [settingsOnly, desktopSurface, visible, prefs.visibilityBehavior, busy]);
  const play = (stateName) => {
    clearTimeout(timer.current);
    setGaze(null);
    setInteraction(stateName);
    timer.current = setTimeout(() => setInteraction(null), stateName === "jumping" ? 2520 : 2100);
  };
  const onDown = (event) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, start: currentPosition, moved: false };
    setMenu(null);
  };
  const onMove = (event) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    const dx = event.clientX - current.x, dy = event.clientY - current.y;
    if (Math.hypot(dx, dy) > 4) {
      current.moved = true;
      setDragging(true);
      setDragAnimation(dx < 0 ? "running-left" : "running-right");
    }
    if (current.moved) setPosition(clampPosition({ x: current.start.x + dx, y: current.start.y + dy }, { width: window.innerWidth, height: window.innerHeight }, size));
  };
  const onUp = (event) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (current.moved) preferences({ position: clampPosition({ x: current.start.x + event.clientX - current.x, y: current.start.y + event.clientY - current.y }, { width: window.innerWidth, height: window.innerHeight }, size) });
    else if (!mini) play("waving");
  };
  const importPet = async () => {
    if (!upload) return;
    try {
      if (upload.size > 24 * 1024 * 1024) throw new Error(t("\u6587\u4EF6\u8D85\u8FC7 24 MB\uFF0C\u8BF7\u538B\u7F29\u540E\u5BFC\u5165\u3002"));
      const base64 = await fileBase64(upload);
      let result;
      if (/\.zip$/i.test(upload.name)) result = await perform("import", { archiveBase64: base64 }, t("\u5DF2\u52A0\u5165\u5BA0\u7269\u5E93"));
      else result = await perform("import", { manifest: { name: uploadName.trim() || upload.name.replace(/\.[^.]+$/, ""), description: t("\u5BFC\u5165\u7684\u81EA\u5B9A\u4E49\u4F19\u4F34") }, spritesheetBase64: base64 }, t("\u5DF2\u52A0\u5165\u5BA0\u7269\u5E93"));
      if (result) {
        setUpload(null);
        setUploadName("");
        setTab("library");
      }
    } catch (error) {
      setMessage({ error: true, text: error.message });
    }
  };
  const validatePet = async () => {
    if (!upload || /\.zip$/i.test(upload.name)) return;
    try {
      if (upload.size > 24 * 1024 * 1024) throw new Error(t("\u6587\u4EF6\u8D85\u8FC7 24 MB\uFF0C\u8BF7\u538B\u7F29\u540E\u6821\u9A8C\u3002"));
      const report = await perform("validate", { spritesheetBase64: await fileBase64(upload) });
      if (report) setMessage({ error: report.valid === false || report.ok === false, text: report.valid === false || report.ok === false ? t("\u6821\u9A8C\u672A\u901A\u8FC7\uFF1A{details}", { details: JSON.stringify(report.errors || report.issues || report) }) : t("\u7ED3\u6784\u6821\u9A8C\u901A\u8FC7\uFF0C\u53EF\u5BFC\u5165\u3002") });
    } catch (error) {
      setMessage({ error: true, text: error.message });
    }
  };
  const exportPet = async () => {
    const result = await perform("export", { id: pet.id });
    if (result) try {
      downloadArchive(result);
    } catch (error) {
      setMessage({ error: true, text: error.message });
    }
  };
  const replacePet = async (file) => {
    if (!file || !pet || pet.builtin) return;
    try {
      if (file.size > 24 * 1024 * 1024) throw new Error(t("\u6587\u4EF6\u8D85\u8FC7 24 MB\u3002"));
      await perform("replace", { id: pet.id, spritesheetBase64: await fileBase64(file) }, t("\u56FE\u96C6\u5DF2\u66FF\u6362\uFF0C\u4F19\u4F34 ID \u4E0E\u663E\u793A\u504F\u597D\u5DF2\u4FDD\u7559"));
    } catch (error) {
      setMessage({ error: true, text: error.message });
    }
  };
  const nativePrompt = async (text) => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await native.openMainComposer({ text, workspaceId: native.getContext().currentWorkspaceId });
      closeSettings?.();
    } catch (error) {
      setMessage({ error: true, text: error.message });
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const createPet = () => nativePrompt(native.createPetPrompt());
  const actualAnimation = dragging ? dragAnimation : interaction || (hover && presentation.animation === "idle" ? "jumping" : presentation.animation);
  const actualGaze = !dragging && !interaction && !hover && presentation.animation === "idle" ? gaze : null;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: `dhp-root${settingsOnly ? " dhp-settings" : ""}`, "data-dsh-hide-pet": "true", lang: language, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("style", { children: css + dockCss + `.dhp-settings{position:relative;inset:auto;pointer-events:auto;width:100%;height:100%;min-width:0}.dhp-settings .dhp-panel{position:static;width:100%;max-width:none;max-height:none;overflow:visible;border:0;border-radius:0;box-shadow:none;animation:none}.dhp-settings .dhp-head{padding:0 0 18px}.dhp-settings .dhp-tabs{margin:0 0 18px}.dhp-settings .dhp-body{padding:0 0 24px}.dhp-settings .dhp-head h2{font-size:20px}.dhp-settings .dhp-art-stage{height:125px}` }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("style", { children: settingsCss }),
    !settingsOnly && !desktopSurface && visible && !mini && pet && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
      "div",
      {
        className: "dhp-pet",
        role: "button",
        tabIndex: 0,
        "aria-label": t("{name}\uFF0C\u70B9\u51FB\u6253\u62DB\u547C\uFF0C\u62D6\u52A8\u79FB\u52A8\uFF0C\u65B9\u5411\u952E\u8C03\u6574\u4F4D\u7F6E\uFF0C\u53F3\u952E\u6253\u5F00\u83DC\u5355", { name: pet.name }),
        "data-dragging": dragging,
        style: { left: currentPosition.x, top: currentPosition.y },
        onPointerDown: onDown,
        onPointerMove: onMove,
        onPointerUp: onUp,
        onPointerCancel: () => {
          drag.current = null;
          setDragging(false);
        },
        onPointerEnter: () => setHover(true),
        onPointerLeave: () => setHover(false),
        onDoubleClick: () => play("waving"),
        onContextMenu: (event) => {
          event.preventDefault();
          setMenu({ x: Math.min(event.clientX, window.innerWidth - 185), y: Math.min(event.clientY, window.innerHeight - 210) });
        },
        onBlur: () => {
          if (keyboardOrigin.current) {
            keyboardOrigin.current = null;
            preferences({ position: currentPosition });
          }
        },
        onKeyDown: (event) => {
          if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
            event.preventDefault();
            keyboardOrigin.current ||= currentPosition;
            const step = event.shiftKey ? 20 : 5;
            setPosition(clampPosition({ x: currentPosition.x + (event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0), y: currentPosition.y + (event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0) }, { width: window.innerWidth, height: window.innerHeight }, size));
          }
          if (event.key === "Escape" && keyboardOrigin.current) {
            event.preventDefault();
            setPosition(keyboardOrigin.current);
            keyboardOrigin.current = null;
          }
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (keyboardOrigin.current) {
              keyboardOrigin.current = null;
              preferences({ position: currentPosition });
            } else play("waving");
          }
          if (event.key === "ContextMenu") setMenu({ x: currentPosition.x, y: Math.max(8, currentPosition.y - 170) });
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dhp-pet-bubble", children: [
            t(presentation.label),
            " \xB7 ",
            pet.name
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Sprite, { language, pet, animation: actualAnimation, gaze: actualGaze, scale, reducedMotion: reduced })
        ]
      }
    ),
    !settingsOnly && !desktopSurface && visible && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(PetDock, { language, ctx, rows, mini, dragHandlers: { onPointerDown: onDown, onPointerMove: onMove, onPointerUp: onUp, onPointerCancel: () => {
      drag.current = null;
      setDragging(false);
    }, onKeyDown: (event) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault();
      const step = event.shiftKey ? 20 : 5;
      const next = clampPosition({ x: currentPosition.x + (event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0), y: currentPosition.y + (event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0) }, { width: window.innerWidth, height: window.innerHeight }, size);
      setPosition(next);
      preferences({ position: next });
    } }, reducedMotion: reduced, focusRequest: chatFocus, petBounds: { ...currentPosition, ...size }, position: { x: currentPosition.x, y: currentPosition.y + (mini ? 0 : size.height) }, onPreferences: preferences }),
    !settingsOnly && !desktopSurface && visible && completionBubble && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("aside", { className: "dhp-completion", "data-side": completionPosition.side, "data-reduced": reduced, role: "status", style: { left: completionPosition.x, top: completionPosition.y }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { "aria-label": t("\u5173\u95ED\u5B8C\u6210\u63D0\u9192"), onClick: () => setCompletionBubble(null), children: "\xD7" }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("strong", { children: t("\u4EFB\u52A1\u5B8C\u6210\u5566") }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("button", { className: "dhp-completion-open", onClick: () => {
        native.openSession(completionBubble.sessionId);
        setCompletionBubble(null);
      }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: completionBubble.title }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("small", { children: t("\u67E5\u770B\u7ED3\u679C \u203A") })
      ] })
    ] }),
    menu && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dhp-menu", role: "menu", style: { left: Math.max(8, menu.x), top: Math.max(8, menu.y) }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("small", { children: [
        pet?.name,
        " \xB7 ",
        t(presentation.label)
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { role: "menuitem", onClick: () => {
        play("waving");
        setMenu(null);
      }, children: t("\u5411\u6211\u6253\u62DB\u547C") }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { role: "menuitem", onClick: () => {
        play("jumping");
        setMenu(null);
      }, children: t("\u8DF3\u4E00\u4E0B") }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { role: "menuitem", onClick: () => {
        preferences({ mode: mini ? "pet" : "mini" });
        setMenu(null);
      }, children: mini ? t("\u663E\u793A\u5BA0\u7269\u5F62\u8C61") : t("\u7CBE\u7B80\u6A21\u5F0F") }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { role: "menuitem", onClick: () => {
        preferences({ visible: false });
        setMenu(null);
      }, children: t("\u6536\u8D77\u4F19\u4F34") }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("small", { children: t("\u8BBE\u7F6E \u203A codex-mini-pet \u4E2D\u7BA1\u7406\u5F62\u8C61") })
    ] }),
    open && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("section", { className: "dhp-panel", "aria-label": t("\u5BA0\u7269\u4F19\u4F34"), ref: panel, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("header", { className: "dhp-head", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("h2", { children: t("Mini \u4E0E\u865A\u62DF\u5BA0\u7269") }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("p", { children: [
            t("\u6309\u4E0B"),
            " ",
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("kbd", { children: "Ctrl+Alt+Shift+P" }),
            " ",
            t("\u5373\u53EF\u5524\u51FA\u4F19\u4F34\u5E76\u5F00\u59CB\u804A\u5929")
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(UiButton, { className: "dhp-button", disabled: busy, onClick: () => preferences({ visible: !visible }), children: visible ? t("\u9690\u85CF Mini") : t("\u663E\u793A Mini") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dhp-tabs", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(UiTabs, { value: tab, onChange: setTab, language }) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dhp-body", id: "dhp-tab-content", role: "tabpanel", "aria-label": t("\u5BA0\u7269\u4F19\u4F34\u9009\u9879"), children: [
        message && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dhp-message", "data-error": message.error || false, role: message.error ? "alert" : "status", children: t(message.text) }),
        !ready && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dhp-empty", children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dhp-spinner" }),
          t("\u8FDE\u63A5\u4F19\u4F34\u5E93\u2026")
        ] }),
        ready && tab === "library" && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dhp-home-hero", children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dhp-home-character", children: [
              !mini && pet && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Sprite, { language, pet, scale: 0.95, reducedMotion: reduced }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dhp-home-toolbar", children: [
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(UiButton, { className: "dhp-button", disabled: busy, onClick: async () => {
                  if (!visible) await preferences({ visible: true });
                  window.dispatchEvent(new Event("dhp-focus-chat"));
                }, children: t("\u804A\u4E00\u804A") }),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { "aria-hidden": "true", children: "\xB7" }),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(UiButton, { className: "dhp-button", onClick: () => setTab("motion"), children: t("\u52A8\u4F5C\u9884\u89C8") })
              ] })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(UiButton, { className: "dhp-button dhp-home-customize", onClick: () => setTab("settings"), children: t("\u81EA\u5B9A\u4E49\u5916\u89C2") })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dhp-library-head", children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("h3", { children: t("\u6211\u7684\u865A\u62DF\u5BA0\u7269") }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dhp-actions", children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(UiButton, { className: "dhp-button", "aria-label": t("\u5237\u65B0\u5BA0\u7269\u5E93"), disabled: busy, onClick: () => apiRequest("state").then(acceptState).catch((error) => setMessage({ error: true, text: error.message })), children: "\u21BB" }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(UiButton, { className: "dhp-button", disabled: busy || !native.getContext().capabilities.composer || !native.getContext().currentWorkspaceId, onClick: createPet, children: t("\u521B\u5EFA\u865A\u62DF\u5BA0\u7269") })
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dhp-grid dhp-home-grid", children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("button", { className: "dhp-card", "aria-pressed": mini, disabled: busy, onClick: () => preferences({ mode: "mini", visible: true }), children: [
              mini && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dhp-check", children: "\u2713" }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dhp-art-stage", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "dhp-mini-illustration", "aria-hidden": "true", children: [
                "\u270E ",
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("i", {}),
                " \u25A4 ",
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("i", {}),
                " \u2304"
              ] }) }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dhp-card-name", children: t("\u65E0") }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dhp-card-note", children: t("\u8F7B\u91CF\u6A21\u5F0F\uFF0C\u4FDD\u7559\u804A\u5929\u4E0E\u52A8\u6001") })
            ] }),
            state.pets.map((item) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("button", { className: "dhp-card", "aria-pressed": !mini && item.id === pet?.id, disabled: busy, onClick: () => perform("select", { id: item.id }), children: [
              !mini && item.id === pet?.id && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dhp-check", children: "\u2713" }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dhp-art-stage", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Sprite, { language, pet: item, scale: 0.48, reducedMotion: reduced }) }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dhp-card-name", children: item.name }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dhp-card-note", children: item.builtin ? t(item.description) : item.description || t("\u81EA\u5B9A\u4E49\u4F19\u4F34") })
            ] }, item.id))
          ] }),
          pet && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("details", { className: "dhp-selected dhp-management", children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("summary", { children: t("\u7BA1\u7406\u5F53\u524D\u4F19\u4F34") }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dhp-management-body", children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dhp-detail-title", children: [
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: pet.name }),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dhp-tag", children: pet.builtin ? t("\u5185\u7F6E") : t("\u81EA\u5B9A\u4E49") })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: "dhp-detail-note", children: pet.builtin ? t(pet.description) : pet.description }),
              !pet.builtin && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("label", { className: "dhp-field", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: t("\u4F19\u4F34\u540D\u79F0") }),
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(UiInput, { type: "text", value: rename, maxLength: 64, onChange: (event) => setRename(event.target.value) })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("label", { className: "dhp-field", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: t("\u63CF\u8FF0") }),
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(UiInput, { type: "text", value: description, maxLength: 500, onChange: (event) => setDescription(event.target.value) })
                ] })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dhp-actions", children: [
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(UiButton, { className: "dhp-button primary", disabled: busy, onClick: () => preferences({ visible: !visible }), children: visible ? t("\u6536\u8D77\u4F19\u4F34") : t("\u5524\u51FA\u4F19\u4F34") }),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(UiButton, { className: "dhp-button", disabled: busy, onClick: exportPet, children: t("\u5BFC\u51FA ZIP") }),
                !pet.builtin && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(UiButton, { className: "dhp-button", disabled: busy || !rename.trim() || rename === pet.name && description === pet.description, onClick: () => perform("update", { id: pet.id, patch: { name: rename.trim(), description } }, t("\u4F19\u4F34\u4FE1\u606F\u5DF2\u66F4\u65B0")), children: t("\u4FDD\u5B58\u4FE1\u606F") }),
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(UiButton, { className: "dhp-button", disabled: busy, onClick: () => replacementInput.current?.click(), children: t("\u66FF\u6362\u56FE\u96C6") }),
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("input", { ref: replacementInput, type: "file", accept: ".png,.webp", hidden: true, onChange: (event) => {
                    replacePet(event.target.files?.[0]);
                    event.target.value = "";
                  } }),
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(UiButton, { className: "dhp-button danger", disabled: busy, onClick: () => confirmDelete ? perform("delete", { id: pet.id }, t("\u5DF2\u79FB\u51FA\u5BA0\u7269\u5E93")) : setConfirmDelete(true), children: confirmDelete ? t("\u786E\u8BA4\u5220\u9664\u6B64\u4F19\u4F34") : t("\u5220\u9664") }),
                  confirmDelete && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(UiButton, { className: "dhp-button", onClick: () => setConfirmDelete(false), children: t("\u53D6\u6D88") })
                ] })
              ] })
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dhp-actions", style: { marginTop: 16 }, children: pet && !pet.builtin && Number(pet.spriteVersion) === 1 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(UiButton, { className: "dhp-button", disabled: busy || !native.getContext().currentWorkspaceId, onClick: () => nativePrompt(`\u8BF7\u4F7F\u7528 dsh-codex-mini-pet \u6280\u80FD\u5C06\u73B0\u6709\u81EA\u5B9A\u4E49\u5BA0\u7269 ${pet.id}\uFF08${pet.name}\uFF09\u5347\u7EA7\u4E3A v2\u3002\u5148\u5BFC\u51FA\u5907\u4EFD\uFF0C\u4FDD\u7559\u89D2\u8272\u3001\u4E5D\u7C7B\u52A8\u4F5C\u548C\u539F ID\uFF0C\u589E\u52A0\u5341\u516D\u65B9\u5411\u6CE8\u89C6\uFF0C\u6821\u9A8C\u53CA\u52A8\u753B\u9884\u89C8\u901A\u8FC7\u540E\u7528 pet_replace \u66FF\u6362\u56FE\u96C6\uFF1B\u4E0D\u8981\u7528\u91CD\u65B0\u5BFC\u5165\u6765\u4EE3\u66FF\u66F4\u65B0\u3002`), children: t("\u5347\u7EA7\u4E3A v2\u2026") }) }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: "dhp-footer", children: t("\u62D6\u52A8\u65F6\u5DE6\u53F3\u8DD1\u52A8 \xB7 \u70B9\u51FB\u6253\u62DB\u547C \xB7 \u5728\u64CD\u4F5C\u680F\u804A\u5929\u6216\u67E5\u770B\u52A8\u6001") })
        ] }),
        ready && tab === "motion" && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dhp-preview", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Sprite, { language, pet, animation: preview, gaze: previewGaze, scale: 0.75, reducedMotion: reduced, loop: true }) }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dhp-animation-grid", children: ANIMATIONS.map((item) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { "aria-pressed": previewGaze === null && preview === item.id, onClick: () => {
            setPreview(item.id);
            setPreviewGaze(null);
          }, children: t(item.label) }, item.id)) }),
          Number(pet?.spriteVersion) !== 1 && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dhp-label", children: t("\u76EE\u5149\u65B9\u5411 \xB7 0\xB0 \u671D\u4E0A\uFF0C\u987A\u65F6\u9488") }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dhp-direction-grid", children: Array.from({ length: 16 }, (_, index) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("button", { "aria-pressed": previewGaze === index, onClick: () => {
              setPreview("idle");
              setPreviewGaze(index);
            }, children: [
              index * 22.5,
              "\xB0"
            ] }, index)) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: "dhp-footer", children: t("\u5DE5\u4F5C\u3001\u7B49\u5F85\u548C\u786E\u8BA4\u72B6\u6001\u4F1A\u8DDF\u968F\u5F53\u524D\u5BF9\u8BDD\u81EA\u52A8\u5207\u6362\u3002\u9884\u89C8\u4EC5\u5728\u6B64\u9762\u677F\u64AD\u653E\u3002") })
        ] }),
        ready && tab === "settings" && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("label", { className: "dhp-field", children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: t("\u8BED\u8A00") }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("select", { "aria-label": t("\u8BED\u8A00"), value: language, disabled: busy, onChange: (event) => preferences({ language: event.target.value }), children: LANGUAGES.map((item) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("option", { value: item.value, children: item.label }, item.value)) }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dhp-language-note", children: t("\u9009\u62E9\u754C\u9762\u8BED\u8A00\uFF0C\u7ACB\u5373\u751F\u6548\u3002") })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dhp-setting-row", children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
              t("\u684C\u9762\u7F6E\u9876"),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { children: state.desktop?.supported ? t("Harness \u5728\u540E\u53F0\u6216\u6700\u5C0F\u5316\u65F6\uFF0C\u4F19\u4F34\u4ECD\u663E\u793A\u5728\u684C\u9762\u4E0A\u3002") : t("\u72EC\u7ACB\u684C\u9762\u7A97\u53E3\u9002\u7528\u4E8E Windows \u684C\u9762\u7248 Harness\u3002") })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(UiSwitch, { label: t("\u684C\u9762\u7F6E\u9876"), checked: prefs.surface !== "app" && Boolean(state.desktop?.supported), disabled: busy || !state.desktop?.supported, onChange: (next) => preferences({ surface: next ? "desktop" : "app" }) })
          ] }),
          state.desktop?.error && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: "dhp-footer", children: t("\u684C\u9762\u7A97\u53E3\u6682\u4E0D\u53EF\u7528\uFF0C\u5DF2\u56DE\u5230\u5E94\u7528\u5185\u663E\u793A\u3002\u8BF7\u91CD\u542F Harness \u540E\u91CD\u8BD5\u3002") }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("label", { className: "dhp-field", children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "dhp-field-head", children: [
              t("\u4F19\u4F34\u5927\u5C0F"),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("small", { children: [
                Math.round(scale * 100),
                "%"
              ] })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("input", { type: "range", min: "0.35", max: "1.5", step: "0.01", value: scale, disabled: busy, onChange: (event) => {
              const value = Number(event.target.value);
              setState((current) => ({ ...current, preferences: { ...current.preferences, scale: value } }));
            }, onPointerUp: (event) => preferences({ scale: Number(event.target.value) }), onKeyUp: (event) => preferences({ scale: Number(event.currentTarget.value) }) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dhp-setting-row", children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
              t("\u663E\u793A\u4F19\u4F34"),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { children: t("\u6536\u8D77\u540E\u53EF\u5728\u6B64\u5904\u6216\u7528 /pet show \u5524\u56DE\u3002") })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(UiSwitch, { label: t("\u663E\u793A\u4F19\u4F34"), checked: visible, disabled: busy, onChange: (next) => preferences({ visible: next }) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dhp-setting-row", children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
              t("\u7CBE\u7B80\u6A21\u5F0F"),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { children: t("\u4FDD\u7559\u804A\u5929\u4E0E\u52A8\u6001\u64CD\u4F5C\uFF0C\u6682\u65F6\u6536\u8D77\u5F62\u8C61\u3002") })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(UiSwitch, { label: t("\u7CBE\u7B80\u6A21\u5F0F"), checked: mini, disabled: busy, onChange: (next) => preferences({ mode: next ? "mini" : "pet" }) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("label", { className: "dhp-field", children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: t("\u663E\u793A\u65B9\u5F0F") }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("select", { value: prefs.visibilityBehavior || "always", disabled: busy, onChange: (event) => preferences({ visibilityBehavior: event.target.value }), children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("option", { value: "always", children: t("\u59CB\u7EC8\u663E\u793A") }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("option", { value: "on-demand", children: t("\u6309\u9700\u663E\u793A \xB7 \u70B9\u51FB\u7A7A\u767D\u6536\u8D77") })
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dhp-setting-row", children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
              t("\u76EE\u5149\u8DDF\u968F\u6307\u9488"),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { children: t("\u95F2\u6687\u65F6\u671D\u4F60\u7684\u9F20\u6807\u65B9\u5411\u671B\u4E00\u671B\u3002") })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(UiSwitch, { label: t("\u76EE\u5149\u8DDF\u968F\u6307\u9488"), checked: prefs.followPointer !== false, disabled: busy || Number(pet?.spriteVersion) === 1, onChange: (next) => preferences({ followPointer: next }) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dhp-setting-row", children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
              t("\u51CF\u5C11\u52A8\u6001\u6548\u679C"),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { children: osReduced ? t("\u7CFB\u7EDF\u5DF2\u542F\u7528\u51CF\u5C11\u52A8\u6001\u6548\u679C\u3002") : t("\u4FDD\u7559\u9759\u6001\u59FF\u6001\uFF0C\u51CF\u5C11\u5FAA\u73AF\u52A8\u4F5C\u3002") })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(UiSwitch, { label: t("\u51CF\u5C11\u52A8\u6001\u6548\u679C"), checked: Boolean(prefs.reducedMotion), disabled: busy, onChange: (next) => preferences({ reducedMotion: next }) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dhp-actions", style: { marginTop: 18 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(UiButton, { className: "dhp-button", disabled: busy, onClick: () => perform("reset", { scope: "position" }), children: t("\u91CD\u7F6E\u4F4D\u7F6E") }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(UiButton, { className: "dhp-button", disabled: busy, onClick: () => perform("reset", { scope: "size" }), children: t("\u91CD\u7F6E\u5927\u5C0F") })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: "dhp-footer", children: t("\u504F\u597D\u4FDD\u5B58\u5728\u672C\u673A\u3002\u684C\u9762\u6A21\u5F0F\u4E0B\uFF0CCtrl+Alt+Shift+P \u53EF\u5728\u5176\u4ED6\u5E94\u7528\u4E2D\u5524\u51FA\u5FEB\u901F\u804A\u5929\uFF1B\u82E5\u70ED\u952E\u88AB\u5360\u7528\uFF0C\u53EF\u70B9\u51FB\u4F19\u4F34\u64CD\u4F5C\u680F\u3002\u5E94\u7528\u5185\u5FEB\u6377\u952E\u53EF\u5728 Harness \u8BBE\u7F6E\u4E2D\u8C03\u6574\u3002") })
        ] }),
        ready && tab === "import" && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dhp-upload", children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("strong", { children: t("\u8BA9\u65B0\u4F19\u4F34\u52A0\u5165") }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("p", { children: [
              t("\u5BFC\u5165\u5BA0\u7269 ZIP \u5305\uFF0C\u6216\u900F\u660E PNG / WebP \u52A8\u4F5C\u56FE\u3002"),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("br", {}),
              t("v2\uFF1A1536 \xD7 2288 \xB7 9 \u7EC4\u52A8\u4F5C + 16 \u4E2A\u76EE\u5149\u65B9\u5411")
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(UiButton, { className: "dhp-button", disabled: busy, onClick: () => fileInput.current?.click(), children: t("\u9009\u62E9\u6587\u4EF6") }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("input", { ref: fileInput, type: "file", hidden: true, accept: ".zip,.png,.webp,application/zip,image/png,image/webp", onChange: (event) => {
              setUpload(event.target.files?.[0] || null);
              setMessage(null);
              event.target.value = "";
            } }),
            upload && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dhp-file", children: [
              upload.name,
              " \xB7 ",
              (upload.size / 1024 / 1024).toFixed(2),
              " MB"
            ] })
          ] }),
          upload && !/\.zip$/i.test(upload.name) && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("label", { className: "dhp-field", children: [
            t("\u4F19\u4F34\u540D\u79F0"),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(UiInput, { type: "text", placeholder: t("\u4E3A\u65B0\u4F19\u4F34\u53D6\u4E2A\u540D\u5B57"), maxLength: 64, value: uploadName, onChange: (event) => setUploadName(event.target.value) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dhp-actions", children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(UiButton, { className: "dhp-button primary", disabled: busy || !upload, onClick: importPet, children: busy ? t("\u5904\u7406\u4E2D\u2026") : t("\u5BFC\u5165\u4F19\u4F34") }),
            upload && !/\.zip$/i.test(upload.name) && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(UiButton, { className: "dhp-button", disabled: busy, onClick: validatePet, children: t("\u5148\u68C0\u67E5\u52A8\u4F5C\u56FE") })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: "dhp-footer", children: t("ZIP \u5305\u4FDD\u7559\u540D\u79F0\u4E0E\u63CF\u8FF0\uFF1B\u5355\u5F20\u56FE\u7247\u81EA\u52A8\u8BC6\u522B v1 / v2\u3002\u8BF7\u4F7F\u7528\u4F60\u6709\u6743\u4F7F\u7528\u7684\u5F62\u8C61\uFF0C\u5BFC\u5165\u524D\u4F1A\u68C0\u67E5\u6587\u4EF6\u7ED3\u6784\u3002") })
        ] })
      ] })
    ] })
  ] });
}
function apply(ctx) {
  applyWorkChat(ctx);
  setNativeUi(nativeKit);
  ctx.slots.inject("shell.overlay", () => ctx.slots.register({ name: "shell.overlay", id: "dsh-codex-mini-pet", order: 90 }, () => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(PetApp, { ctx })));
  ctx.slots.inject("settings.section", () => ctx.slots.register({ name: "settings.section", id: "dsh-codex-mini-pet", order: 40, label: () => "codex-mini-pet" }, ({ close }) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(PetApp, { ctx, settingsOnly: true, closeSettings: close })));
  ctx.effect(() => registerPetShortcut(ctx.shortcuts, () => {
    apiRequest("action", { action: "preferences", patch: { visible: true } }).then(() => {
      window.dispatchEvent(new Event("dhp-state-change"));
      window.dispatchEvent(new Event("dhp-focus-chat"));
    }).catch(() => {
    });
  }));
}

return module.exports;}});
