/** Detect fresh completions, including the main chat whose unread bit stays false. */
export function createCompletionTracker() {
  let previous = new Map(), serial = 0;
  const observedRunning = new Set();
  return rows => {
    const next = new Map(rows.map(row => [row.id, row]));
    const notices = [];
    for (const row of rows) {
      const before = previous.get(row.id);
      if (row.running) { observedRunning.add(row.id); continue; }
      if (row.error || (row.turnOutcome && /error|cancel|abort|interrupt/.test(row.turnOutcome))) { observedRunning.delete(row.id); continue; }
      if (!before || !observedRunning.has(row.id) || row.pendingInteraction) continue;
      const ended = row.turnEnded && row.activityVersion !== before.activityVersion;
      if (!before.running && !ended && !(row.state === 'ready' && before.state !== 'ready')) continue;
      // A failed/cancelled turn can reach us after the running bit drops.
      // With a visible turn/start, wait for its durable end rather than guessing.
      if (row.activityVersion && !row.turnEnded && row.state !== 'ready') continue;
      notices.push({ id: `${row.id}:${++serial}`, sessionId: row.id, title: row.title, expiresAt: Date.now() + 30000 });
      observedRunning.delete(row.id);
    }
    for (const id of observedRunning) if (!next.has(id)) observedRunning.delete(id);
    previous = next;
    return notices;
  };
}

/** Keep a side panel outside the pet, clamped vertically to the available screen. */
export function sidePanelPosition(pet, viewport, width = 350, height = 470, gap = 12) {
  const rightSpace = viewport.width - pet.x - pet.width;
  const leftSpace = pet.x;
  const preferRight = pet.x + pet.width / 2 < viewport.width / 2;
  const right = preferRight ? rightSpace >= width + gap || rightSpace >= leftSpace : !(leftSpace >= width + gap || leftSpace >= rightSpace);
  const available = Math.max(120, (right ? rightSpace : leftSpace) - gap - 8);
  const panelWidth = Math.min(width, available);
  return { side: right ? 'right' : 'left', x: right ? pet.x + pet.width + gap : pet.x - panelWidth - gap, y: Math.max(8, Math.min(pet.y - 24, viewport.height - height - 8)), width: panelWidth, maxHeight: Math.max(120, viewport.height - 16) };
}

export function inwardBubblePosition(pet, viewport, width = 250, height = 120) {
  const right = pet.x + pet.width / 2 < viewport.width / 2;
  return { side: right ? 'right' : 'left', x: Math.max(8, Math.min(right ? pet.x + pet.width - 12 : pet.x - width + 12, viewport.width - width - 8)), y: Math.max(8, Math.min(pet.y - height + 24, viewport.height - height - 8)) };
}
