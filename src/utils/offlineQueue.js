// src/utils/offlineQueue.js
const KEY = "pendingActions:v1";
const PROCESSED_KEY = "processedActions:v1";

/**
 * Pending action shape:
 * { type: 'ballTransaction', tournamentId, matchId, payload, timestamp }
 */

export function getPendingActions() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch (e) {
    return [];
  }
}

export function getProcessedActionIds() {
  try {
    return JSON.parse(localStorage.getItem(PROCESSED_KEY)) || [];
  } catch (e) {
    return [];
  }
}

export function isActionProcessed(actionId) {
  if (!actionId) return false;
  return getProcessedActionIds().includes(actionId);
}

export function markActionProcessed(actionId) {
  if (!actionId) return;
  try {
    const processed = getProcessedActionIds();
    if (processed.includes(actionId)) return;
    processed.push(actionId);

    // Keep bounded history for localStorage footprint safety
    const bounded = processed.slice(-500);
    localStorage.setItem(PROCESSED_KEY, JSON.stringify(bounded));
  } catch (e) {
    console.error("markActionProcessed error", e);
  }
}

export function addPendingAction(action) {
  try {
    const queue = getPendingActions();
    queue.push({ ...action, timestamp: Date.now() });
    localStorage.setItem(KEY, JSON.stringify(queue));
  } catch (e) {
    console.error("addPendingAction error", e);
  }
}

export function clearPendingActions() {
  try {
    localStorage.removeItem(KEY);
  } catch (e) {}
}

export async function syncPendingActions(processFn) {
  const queue = getPendingActions();
  if (!queue || queue.length === 0) return;

  // process sequentially; stop on first failure to avoid partial state
  for (const action of queue) {
    try {
      await processFn(action);
    } catch (err) {
      console.error("syncPendingActions failed for", action, err);
      // keep remaining actions in storage (do not clear)
      return;
    }
  }
  // all succeeded
  clearPendingActions();
}
