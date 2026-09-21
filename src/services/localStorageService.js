/**
 * LocalStorage Service - Offline-first data persistence
 * 
 * Handles:
 * - Auto-save exam progress
 * - Recovery on page reload
 * - Pending submissions (offline mode)
 * - Backup file downloads
 */

const STORAGE_KEYS = {
  EXAM_DATA: "examData",
  PENDING_SUBMISSION: "pendingSubmission",
  USER_INFO: "userInfo"
};

/* ========================================
   EXAM DATA - Auto-save & Recovery
   ======================================== */

/**
 * Save exam progress to localStorage
 * Called on every answer change (debounced in component)
 */
export const saveExamProgress = (data) => {
  try {
    const payload = {
      ...data,
      lastSaved: Date.now(),
      version: 1
    };
    localStorage.setItem(STORAGE_KEYS.EXAM_DATA, JSON.stringify(payload));
    return true;
  } catch (error) {
    console.error("localStorage save failed:", error);
    return false;
  }
};

/**
 * Load exam progress from localStorage
 * Called on page load for recovery
 */
export const loadExamProgress = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.EXAM_DATA);
    if (!raw) return null;
    
    const data = JSON.parse(raw);
    
    // Check if data is too old (more than 24 hours)
    const age = Date.now() - (data.lastSaved || 0);
    if (age > 24 * 60 * 60 * 1000) {
      console.log("Cached data expired, clearing...");
      clearExamProgress();
      return null;
    }
    
    return data;
  } catch (error) {
    console.error("localStorage load failed:", error);
    return null;
  }
};

/**
 * Clear exam progress
 * Called after successful submission
 */
export const clearExamProgress = () => {
  try {
    localStorage.removeItem(STORAGE_KEYS.EXAM_DATA);
    return true;
  } catch (error) {
    console.error("localStorage clear failed:", error);
    return false;
  }
};

/* ========================================
   USER INFO - Persist login across refresh
   ======================================== */

/**
 * Save user info for recovery
 */
export const saveUserInfo = (name, scholar) => {
  try {
    localStorage.setItem(STORAGE_KEYS.USER_INFO, JSON.stringify({ name, scholar }));
    return true;
  } catch (error) {
    console.error("User info save failed:", error);
    return false;
  }
};

/**
 * Load user info
 */
export const loadUserInfo = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USER_INFO);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
};

/**
 * Clear user info
 */
export const clearUserInfo = () => {
  localStorage.removeItem(STORAGE_KEYS.USER_INFO);
};

/* ========================================
   PENDING SUBMISSIONS - Offline Mode
   ======================================== */

/**
 * Save pending submission (when offline)
 * Stores full exam data for later upload
 */
export const savePendingSubmission = (data) => {
  try {
    const payload = {
      ...data,
      savedAt: Date.now(),
      status: "PendingUpload"
    };
    localStorage.setItem(STORAGE_KEYS.PENDING_SUBMISSION, JSON.stringify(payload));
    return true;
  } catch (error) {
    console.error("Pending submission save failed:", error);
    return false;
  }
};

/**
 * Load pending submission
 */
export const loadPendingSubmission = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PENDING_SUBMISSION);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
};

/**
 * Clear pending submission after successful upload
 */
export const clearPendingSubmission = () => {
  localStorage.removeItem(STORAGE_KEYS.PENDING_SUBMISSION);
};

/**
 * Check if there's a pending submission
 */
export const hasPendingSubmission = () => {
  return localStorage.getItem(STORAGE_KEYS.PENDING_SUBMISSION) !== null;
};

/* ========================================
   BACKUP FILE DOWNLOAD
   ======================================== */

/**
 * Download exam data as JSON file
 * Ensures user always has a backup
 */
export const downloadBackupFile = (data, filename = null) => {
  try {
    const { name, scholar, answers, startTime, endTime, status } = data;
    
    const backupData = {
      name,
      scholarId: scholar,
      answers,
      startTime: startTime ? new Date(startTime).toISOString() : null,
      endTime: endTime ? new Date(endTime).toISOString() : new Date().toISOString(),
      status: status || "Submitted",
      exportedAt: new Date().toISOString(),
      version: "1.0"
    };
    
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { 
      type: "application/json" 
    });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename || `${name}_${scholar}_backup.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    return true;
  } catch (error) {
    console.error("Backup download failed:", error);
    return false;
  }
};

/**
 * Download pending submission as backup
 */
export const downloadPendingBackup = () => {
  const pending = loadPendingSubmission();
  if (pending) {
    return downloadBackupFile(pending, `${pending.name}_${pending.scholar}_pending.json`);
  }
  return false;
};

/* ========================================
   UTILITY FUNCTIONS
   ======================================== */

/**
 * Get storage usage info
 */
export const getStorageInfo = () => {
  try {
    const examData = localStorage.getItem(STORAGE_KEYS.EXAM_DATA);
    const pendingData = localStorage.getItem(STORAGE_KEYS.PENDING_SUBMISSION);
    const userData = localStorage.getItem(STORAGE_KEYS.USER_INFO);
    
    return {
      hasExamData: examData !== null,
      hasPendingSubmission: pendingData !== null,
      hasUserInfo: userData !== null,
      examDataSize: examData ? new Blob([examData]).size : 0,
      pendingDataSize: pendingData ? new Blob([pendingData]).size : 0
    };
  } catch (error) {
    return null;
  }
};

/**
 * Clear all exam-related storage
 */
export const clearAllExamStorage = () => {
  clearExamProgress();
  clearPendingSubmission();
  clearUserInfo();
};

/**
 * Check if storage is available
 */
export const isStorageAvailable = () => {
  try {
    const test = "__storage_test__";
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (error) {
    return false;
  }
};
