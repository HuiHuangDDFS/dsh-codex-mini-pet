import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { frameFor } from './client-model.mjs';
import { desktopPng } from './atlas.mjs';

export function isWindowsDesktopHost(platform = process.platform, argv = process.argv) {
  return platform === 'win32' && argv.some(value => /dsh-desktop-host[\\/]lib[\\/]index\.js$/.test(value));
}
const launchCode = `Add-Type -AssemblyName PresentationFramework,PresentationCore,WindowsBase,System.Xaml,System.Web.Extensions,System.Windows.Forms,System.Drawing; $refs=@('System.dll','System.Core.dll',[System.Windows.Application].Assembly.Location,[System.Windows.Media.ImageSource].Assembly.Location,[System.Windows.DependencyObject].Assembly.Location,[System.Xaml.XamlReader].Assembly.Location,[System.Web.Script.Serialization.JavaScriptSerializer].Assembly.Location,[System.Windows.Forms.Screen].Assembly.Location,[System.Drawing.Point].Assembly.Location); Add-Type -Path $env:DSH_PET_NATIVE_SOURCE -ReferencedAssemblies $refs; [DshPet.NativeApp]::Run()`;

/** A private stdin/stdout channel; there is no additional HTTP listener or credential file. */
export class DesktopCompanion {
  constructor(store, { enabled = isWindowsDesktopHost(), spawnImpl = spawn, ownerPid = process.ppid } = {}) {
    this.store = store; this.supported = enabled; this.spawnImpl = spawnImpl; this.ownerPid = ownerPid;
    this.active = false; this.error = null; this.events = []; this.facts = {}; this.sequence = 0;
    this.started = Date.now(); this.animation = 'idle'; this.gaze = null; this.closed = false;
  }
  status() { return { supported: this.supported, active: this.active, error: this.error, hotkey: this.hotkey || false }; }
  start() {
    if (!this.supported || this.child || this.closed) return;
    try {
      const exe = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
      this.child = this.spawnImpl(exe, ['-NoLogo', '-NoProfile', '-NonInteractive', '-STA', '-WindowStyle', 'Hidden', '-Command', launchCode], {
        windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, DSH_PET_NATIVE_SOURCE: fileURLToPath(new URL('../native/PetWindow.cs', import.meta.url)), DSH_PET_OWNER_PID: String(this.ownerPid) },
      });
      this.child.stdin.on('error', () => {});
      let buffer = '', diagnostic = '';
      this.child.stdout.setEncoding('utf8'); this.child.stderr.setEncoding('utf8');
      this.child.stderr.on('data', chunk => { diagnostic = (diagnostic + chunk).slice(-4000); });
      this.child.stdout.on('data', chunk => {
        buffer += chunk;
        if (buffer.length > 256 * 1024) { buffer = ''; return; }
        let end;
        while ((end = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, end).trim(); buffer = buffer.slice(end + 1);
          try { this.onNative(JSON.parse(line)); } catch { /* PowerShell startup diagnostics are not commands. */ }
        }
      });
      this.child.on('error', error => { this.error = error.message; this.active = false; clearInterval(this.stateTimer); clearInterval(this.frameTimer); clearTimeout(this.startTimer); });
      this.child.on('exit', code => {
        this.active = false; this.child = null;
        if (!this.closed && code !== 0) this.error = diagnostic || `桌面窗口退出（${code}）`;
        clearInterval(this.stateTimer); clearInterval(this.frameTimer); clearTimeout(this.startTimer);
      });
      this.startTimer = setTimeout(() => { if (!this.active && this.child) { this.error = diagnostic || '桌面窗口启动超时'; this.child.kill(); } }, 20000);
      this.startTimer.unref?.();
      this.stateTimer = setInterval(() => this.refresh().catch(error => { this.error = error.message; }), 1000);
      this.frameTimer = setInterval(() => this.draw(), 80);
      this.stateTimer.unref?.(); this.frameTimer.unref?.();
    } catch (error) { this.error = error.message; this.active = false; }
  }
  send(value) { if (this.child?.stdin.writable && !this.closed) this.child.stdin.write(JSON.stringify(value) + '\n'); }
  async refresh() {
    if (!this.active || this.refreshing) return;
    this.refreshing = true;
    try {
      const state = await this.store.snapshot(); this.preferences = state.preferences;
      const pet = state.pets.find(item => item.id === state.preferences.selectedPetId) || state.pets[0];
      if (!pet) return;
      const key = `${pet.id}:${pet.sha256 || pet.spritesheet}`;
      this.imageVersion = Number(pet.spriteVersion) === 1 ? 1 : 2;
      if (this.imageKey !== key) {
        const image = await this.store.sprite(pet.id);
        const png = await desktopPng(image.bytes);
        this.send({ type: 'atlas', base64: png.toString('base64') }); this.imageKey = key;
      }
      const value = {
        type: 'state', preferences: { ...state.preferences, reducedMotion: Boolean(state.preferences.reducedMotion || this.facts.osReduced) }, name: pet.name,
        label: this.facts.presentation?.label || '随时准备好', rows: (this.facts.rows || []).slice(0, 30),
        context: this.facts.context || {}, theme: this.facts.theme || {},
      };
      const serialized = JSON.stringify(value);
      if (serialized !== this.previousState) { this.send(value); this.previousState = serialized; }
    } finally { this.refreshing = false; }
  }
  draw() {
    if (!this.active || !this.preferences) return;
    const base = this.facts.presentation?.animation || 'idle';
    const next = this.dragging ? this.dragDirection : Date.now() < (this.interactionUntil || 0) ? this.interaction : base;
    if (this.animation !== next) { this.animation = next; this.started = Date.now(); }
    const frame = frameFor(next, Date.now() - this.started, {
      reducedMotion: Boolean(this.preferences.reducedMotion || this.facts.osReduced),
      gaze: this.dragging || this.preferences.followPointer === false || Date.now() < (this.interactionUntil || 0) ? null : this.gaze,
      version: this.imageVersion || 2,
      loop: Boolean(this.dragging),
    });
    const key = `${frame.row}:${frame.column}`;
    if (key !== this.previousFrame) { this.send({ type: 'frame', row: frame.row, column: frame.column }); this.previousFrame = key; }
  }
  onNative(message) {
    if (!message || typeof message !== 'object') return;
    if (message.type === 'ready') { clearTimeout(this.startTimer); this.active = true; this.error = null; this.hwnd = message.hwnd; this.refresh().catch(error => { this.error = error.message; }); return; }
    if (message.type === 'hotkey') { this.hotkey = message.registered === true; return; }
    if (message.type === 'gaze') { this.gaze = Number.isInteger(message.direction) && message.direction >= 0 && message.direction < 16 ? message.direction : null; return; }
    if (message.type === 'hover') { this.hover = message.value === true; return; }
    if (message.type === 'drag') {
      this.dragging = message.active === true;
      this.dragDirection = message.direction === 'left' ? 'running-left' : 'running-right';
      if (this.dragging) { this.interactionUntil = 0; this.gaze = null; }
      this.draw(); return;
    }
    if (message.type === 'greet') { this.interaction = 'waving'; this.interactionUntil = Date.now() + 2100; return; }
    if (message.type === 'position' && Number.isFinite(message.x) && Number.isFinite(message.y)) { this.store.preferences({ desktopPosition: { x: message.x, y: message.y } }).catch(error => { this.error = error.message; }); return; }
    if (message.type === 'preferences') {
      const patch = message.patch || {};
      const safe = Object.fromEntries(['visible', 'mode', 'surface'].filter(key => Object.hasOwn(patch, key)).map(key => [key, patch[key]]));
      this.store.preferences(safe).then(() => this.refresh()).catch(error => { this.error = error.message; }); return;
    }
    if (!['open-settings', 'open-session', 'send-chat', 'edit-chat'].includes(message.type)) return;
    if (['send-chat', 'edit-chat'].includes(message.type) && (typeof message.text !== 'string' || message.text.length > 64000 || !message.text.trim())) return;
    if (this.events.length >= 20) return;
    this.events.push({ ...message, id: String(++this.sequence) });
  }
  sync(input = {}) {
    if (input.facts && typeof input.facts === 'object' && JSON.stringify(input.facts).length < 128000) this.facts = input.facts;
    for (const reply of (Array.isArray(input.replies) ? input.replies.slice(0, 20) : [])) this.send({ id: String(reply.id || ''), kind: String(reply.kind || ''), ok: reply.ok === true, error: String(reply.error || '').slice(0, 1000), ...(typeof reply.message === 'string' ? { message: reply.message.slice(0, 1000) } : {}), type: 'reply' });
    const events = this.events.splice(0);
    this.refresh().catch(error => { this.error = error.message; });
    return { ...this.status(), events };
  }
  command(name) {
    if (name !== 'toggle-chat') throw new Error('未知桌面伙伴操作。');
    this.send({ type: name });
    return { ok: true };
  }
  dispose() {
    this.closed = true; clearInterval(this.stateTimer); clearInterval(this.frameTimer); clearTimeout(this.startTimer);
    this.child?.stdin.end();
    const child = this.child; const timer = setTimeout(() => child?.kill(), 2000); timer.unref?.();
  }
}
