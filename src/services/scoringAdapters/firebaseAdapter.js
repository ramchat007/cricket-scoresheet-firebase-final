import {
  ballTransaction,
  undoLast,
  finishMatch,
  deleteMatch,
  subscribeMatchLite,
} from "../../utils/firestore";

/**
 * Drop-in adapter using existing Firebase implementation.
 */
export const firebaseAdapter = {
  ballTransaction,
  undoLast,
  finishMatch,
  deleteMatch,
  subscribeMatchLite,
};
