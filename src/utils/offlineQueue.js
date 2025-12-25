// src/utils/offlineQueue.js
const KEY = "pendingActions:v1";

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
