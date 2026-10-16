/** Cache one snapshot per underlying Signal identity so React sees stable reads. */
export function combineSessionSources(sources) {
  let previousValues = [], previous = new Map();
  return {
    subscribe(listener) {
      const disposers = sources.map(({ source }) => source.subscribe(listener));
      return () => disposers.forEach(dispose => dispose());
    },
    getSnapshot() {
      const values = sources.map(({ source }) => source.getSnapshot());
      if (values.length === previousValues.length && values.every((value, index) => value === previousValues[index])) return previous;
      previousValues = values;
      previous = new Map(sources.map(({ id }, index) => [id, values[index]]));
      return previous;
    },
  };
}

/** Observe the public event window as well as the Session lifecycle snapshot. */
export function sessionActivitySource(session) {
  let previousSnapshot, previousEvents, cached;
  return {
    subscribe(listener) {
      const offSession = session.subscribe(listener);
      const offEvents = session.eventSource?.subscribe(listener);
      return () => { offSession(); offEvents?.(); };
    },
    getSnapshot() {
      const snapshot = session.getSnapshot();
      const events = session.eventSource?.getSnapshot();
      if (cached && previousSnapshot === snapshot && previousEvents === events) return cached;
      previousSnapshot = snapshot; previousEvents = events;
      let lastTurnError = null, activityVersion = null;
      const entries = events?.entries || [];
      for (let i = entries.length - 1; i >= 0; i--) {
        const event = entries[i].event || entries[i];
        if (!['turn/start', 'turn/end'].includes(event.type)) continue;
        activityVersion = `${event.data?.turn}:${event.seq}`;
        if (event.type === 'turn/end' && event.data?.reason?.kind === 'error') lastTurnError = event.data.reason.error;
        break;
      }
      cached = { ...snapshot, lastTurnError, activityVersion };
      return cached;
    },
  };
}
