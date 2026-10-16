/** Native actions verified against the installed DeepSeek Harness 0.2.0-rc.2. */
const SOURCE = 'hidePet';
const emptyList = { ids: [], byId: {}, phase: 'pending' };

function service(ctx, name) {
  return ctx.get?.(name) ?? ctx[name];
}

function failure(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function requireText(text) {
  if (typeof text !== 'string' || !text.trim()) throw failure('EMPTY_PROMPT', '请先输入要发送的内容。');
  return text;
}

/** These tokens require the host's reference/skill/command input pipeline. */
export function requiresNativeComposer(text) {
  return /(^|\s)[@$]/u.test(text) || /^\s*\//u.test(text);
}

export function createPetPrompt() {
  return '请帮我创建一只新的 DeepSeek Harness 桌面宠物。先询问我想要的角色、风格和名字，再制作包含九类动作和十六方向注视的透明 v2 图集，逐项预览后导入 dsh-hide-pet。如果已安装 dsh-hide-pet 技能，请按该技能执行；如果尚未安装，请先说明缺少技能，不要声称已经调用。';
}

export function createHarnessActions(ctx) {
  const sessions = () => service(ctx, 'sessions');
  const navigation = () => service(ctx, 'uiWorkspace');
  const conversation = () => service(ctx, 'conversation');

  function getContext() {
    const list = sessions()?.list?.getSnapshot?.() ?? emptyList;
    const rows = Object.values(list.byId ?? {});
    const current = rows.find(row => (row.retainedBy?.mainView ?? 0) > 0);
    const workspaceState = service(ctx, 'workspaces')?.list?.getSnapshot?.();
    const workspaces = (workspaceState?.items ?? []).map(item => ({
      workspaceId: item.workspaceId,
      path: item.path,
      sessionIds: [...(item.sessionIds ?? [])],
    }));
    const workspace = current ? workspaces.find(item => item.sessionIds.includes(current.id)) : undefined;
    return {
      currentSessionId: current?.id ?? null,
      currentSessionTitle: current?.displayTitle ?? current?.title ?? null,
      currentWorkspaceId: workspace?.workspaceId ?? null,
      currentWorkspacePath: workspace?.path ?? null,
      workspaces,
      sessionsReady: list.phase === 'ready',
      workspacesReady: workspaceState?.phase === 'ready',
      capabilities: {
        openSession: typeof navigation()?.openSession === 'function',
        sendMessage: typeof sessions()?.create === 'function' && typeof sessions()?.using === 'function',
        composer: typeof conversation()?.input?.for === 'function',
        stopSession: typeof sessions()?.using === 'function',
        errors: typeof service(ctx, 'remote')?.$on === 'function',
        shortcuts: typeof service(ctx, 'shortcuts')?.register === 'function',
        voice: false,
        systemFloatingWindow: false,
        globalShortcut: false,
      },
      unavailable: {
        voice: '宿主的实验性语音按钮位于原生输入栏，未公开跨插件启动录音的方法。',
        systemFloatingWindow: '此版本的插件接口只提供应用内 overlay，未公开系统悬浮窗接口。',
        globalShortcut: '原生快捷键注册作用于 Harness 窗口，未公开系统全局热键接口。',
      },
    };
  }

  function requireSessions() {
    const value = sessions();
    if (typeof value?.using !== 'function') throw failure('CAPABILITY_UNAVAILABLE', '当前环境未提供 Harness 会话操作，请在已安装插件的宿主中使用。');
    return value;
  }

  function requireId(sessionId) {
    if (typeof sessionId !== 'string' || !sessionId) throw failure('SESSION_REQUIRED', '请选择一个会话。');
    return sessionId;
  }

  async function target({ sessionId, workspaceId } = {}) {
    const controller = requireSessions();
    const context = getContext();
    if (sessionId != null) {
      requireId(sessionId);
      const workspace = context.workspaces.find(item => item.sessionIds.includes(sessionId));
      return { sessionId, created: false, workspaceId: workspace?.workspaceId ?? null, workspacePath: workspace?.path ?? null };
    }
    const id = workspaceId ?? context.currentWorkspaceId;
    const workspace = context.workspaces.find(item => item.workspaceId === id);
    if (!workspace) throw failure('WORKSPACE_REQUIRED', '请先选择工作区；新会话将在你选择的目录中创建。');
    if (typeof controller.create !== 'function') throw failure('CAPABILITY_UNAVAILABLE', '当前环境不支持创建原生会话。');
    const createdId = await controller.create({ workspaceId: workspace.workspaceId });
    return { sessionId: createdId, created: true, workspaceId: workspace.workspaceId, workspacePath: workspace.path };
  }

  function openSession(id) {
    requireId(id);
    const ui = navigation();
    if (typeof ui?.openSession !== 'function') throw failure('CAPABILITY_UNAVAILABLE', '当前环境未提供原生会话导航。');
    ui.openSession(id);
    return { sessionId: id };
  }

  async function sendMessage({ text, sessionId, workspaceId } = {}) {
    requireText(text);
    if (requiresNativeComposer(text)) throw failure('NATIVE_COMPOSER_REQUIRED', '含 @、$ 或命令的内容请使用“在主会话编辑”，通过原生输入栏选择上下文后发送。');
    const result = await target({ sessionId, workspaceId });
    openSession(result.sessionId);
    await requireSessions().using(result.sessionId, { source: SOURCE }, async reference => {
      const admission = await reference.binding.session.prompt([{ type: 'text', text }], 'queue');
      if (!admission?.ok) throw failure(admission?.error?.code ?? 'PROMPT_FAILED', admission?.error?.message ?? '宿主未接受这条消息。');
    });
    return result;
  }

  async function stopSession(id) {
    requireId(id);
    await requireSessions().using(id, { source: SOURCE }, async reference => {
      const result = await reference.binding.session.cancel();
      if (!result?.ok) throw failure(result?.error?.code ?? 'STOP_FAILED', result?.error?.message ?? '宿主未能停止这个会话。');
    });
    return { sessionId: id };
  }

  async function openMainComposer({ text = '', sessionId, workspaceId } = {}) {
    if (typeof text !== 'string') throw failure('INVALID_PROMPT', '草稿内容必须是文字。');
    const resolver = conversation()?.input;
    if (typeof resolver?.for !== 'function') throw failure('CAPABILITY_UNAVAILABLE', '当前环境未提供原生输入栏。');
    const result = await target({ sessionId, workspaceId });
    openSession(result.sessionId);
    await requireSessions().using(result.sessionId, { source: SOURCE }, async reference => {
      const input = resolver.for(reference.binding.ctx);
      if (text) {
        // Insert through the public action face; keep any draft, chips, and files.
        const span = input.actions.captureInsertion();
        if (!input.actions.insertText(text, span)) throw failure('COMPOSER_BUSY', '原生输入栏正在处理内容，请稍后重试；原有草稿已保留。');
      }
      input.focus();
    });
    return result;
  }

  function subscribeErrors(listener) {
    if (typeof listener !== 'function') throw new TypeError('listener must be a function');
    const remote = service(ctx, 'remote');
    if (typeof remote?.$on !== 'function') return () => {};
    return remote.$on('api-session/error', (id, message) => listener({ id, message: String(message) }));
  }

  return { getContext, openSession, sendMessage, stopSession, openMainComposer, createPetPrompt, subscribeErrors };
}
