const STORAGE_KEY = "cricsync_scoring_metrics_v1";

const readStore = () => {
  if (typeof window === "undefined" || !window.localStorage) {
    return { counters: {}, recent: [] };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { counters: {}, recent: [] };
    const parsed = JSON.parse(raw);
    return {
      counters: parsed?.counters || {},
      recent: Array.isArray(parsed?.recent) ? parsed.recent : [],
    };
  } catch {
    return { counters: {}, recent: [] };
  }
};

const writeStore = (store) => {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // noop: telemetry is best-effort only
  }
};

export const recordScoringMetric = (eventName, payload = {}) => {
  const store = readStore();
  const name = String(eventName || "unknown");

  store.counters[name] = (store.counters[name] || 0) + 1;
  store.recent.unshift({
    event: name,
    payload,
    timestamp: new Date().toISOString(),
  });
  if (store.recent.length > 100) store.recent = store.recent.slice(0, 100);

  writeStore(store);
  return store;
};

export const getScoringTelemetrySnapshot = () => readStore();

