/**
 * Sync Service - Auto-upload pending submissions when online
 * 
 * This service handles:
 * - Checking for pending submissions
 * - Auto-uploading when network is restored
 * - Retry logic with exponential backoff
 */

import {
  submitWithAnswers,
  getSession
} from "./sessionService";
import {
  loadPendingSubmission,
  clearPendingSubmission,
  hasPendingSubmission
} from "./localStorageService";

/**
 * Check if user has a pending submission
 */
export function checkPendingSubmission() {
  return hasPendingSubmission();
}

/**
 * Load pending submission data
 */
export function getPendingSubmission() {
  return loadPendingSubmission();
}

/**
 * Clear pending submission after successful upload
 */
export function clearPending() {
  clearPendingSubmission();
}

/**
 * Sync pending submission to Firebase
 * Called when user comes online or explicitly retries
 */
export async function syncPendingSubmission(sessionId) {
  const pending = loadPendingSubmission();
  
  if (!pending) {
    return { success: false, reason: "No pending submission" };
  }

  try {
    const result = await submitWithAnswers(
      sessionId,
      pending.answers,
      "Auto-sync from offline"
    );

    if (result && !result.alreadySubmitted) {
      clearPendingSubmission();
      return { success: true, message: "Submission synced successfully" };
    } else if (result && result.alreadySubmitted) {
      clearPendingSubmission();
      return { success: true, message: "Already submitted", alreadySubmitted: true };
    }

    return { success: false, reason: "Unknown error" };
  } catch (error) {
    console.error("Sync failed:", error);
    return { success: false, reason: error.message, error };
  }
}

/**
 * Retry pending submission with multiple attempts
 */
export async function retryPendingSubmission(sessionId, maxRetries = 3) {
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await syncPendingSubmission(sessionId);
      
      if (result.success) {
        return result;
      }
      
      lastError = result.reason || "Sync failed";
      
      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    } catch (error) {
      lastError = error.message;
      console.error(`Retry attempt ${attempt} failed:`, error);
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  return { success: false, reason: lastError || "Max retries exceeded" };
}

/**
 * Setup auto-sync when network is restored
 * Call this in your main component or App.jsx
 */
export function setupAutoSync(sessionId, onSyncComplete, onSyncFailed) {
  const handleOnline = async () => {
    if (hasPendingSubmission()) {
      console.log("Network restored - attempting to sync pending submission...");
      
      try {
        const result = await retryPendingSubmission(sessionId);
        
        if (result.success) {
          console.log("Pending submission synced successfully");
          if (onSyncComplete) onSyncComplete(result);
        } else {
          console.error("Sync failed:", result.reason);
          if (onSyncFailed) onSyncFailed(result);
        }
      } catch (error) {
        console.error("Auto-sync error:", error);
        if (onSyncFailed) onSyncFailed({ error: error.message });
      }
    }
  };

  window.addEventListener("online", handleOnline);

  // Return cleanup function
  return () => {
    window.removeEventListener("online", handleOnline);
  };
}

/**
 * Check if session exists in Firebase
 * Used to validate before syncing
 */
export async function validateSession(sessionId) {
  try {
    const session = await getSession(sessionId);
    return session !== null;
  } catch (error) {
    console.error("Session validation failed:", error);
    return false;
  }
}

/**
 * Get sync status info
 */
export function getSyncStatus() {
  const pending = loadPendingSubmission();
  
  if (!pending) {
    return { hasPending: false, status: "No pending submission" };
  }

  const age = Date.now() - (pending.savedAt || 0);
  const ageMinutes = Math.floor(age / 60000);
  
  return {
    hasPending: true,
    status: "Pending upload",
    savedAt: pending.savedAt,
    ageMinutes,
    name: pending.name,
    scholar: pending.scholar
  };
}
