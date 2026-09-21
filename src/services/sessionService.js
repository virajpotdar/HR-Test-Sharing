import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  arrayUnion,
  increment,
  runTransaction,
  writeBatch
} from "firebase/firestore";
import { db } from "../firebase";

// Status values: "NotStarted" | "Active" | "Submitted" | "PendingUpload"

/* ========================================
   SESSION INITIALIZATION (Minimal Writes)
   ======================================== */

export async function initSession(sessionId, data) {
  const ref = doc(db, "exam_sessions", sessionId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    // Only write ONCE at session creation
    await setDoc(ref, {
      ...data,
      status: "NotStarted",
      startTime: null,
      startedAt: serverTimestamp(),
      answers: {},
      violations: 0,
      violationImages: [],
      submitted: false,
      submitReason: null,
      lastUpdated: serverTimestamp(),
    });
  }

  return (await getDoc(ref)).data();
}

// Called when user clicks "Start Exam" - sets status to Active
export async function activateSession(sessionId) {
  const ref = doc(db, "exam_sessions", sessionId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    throw new Error("Session not found");
  }

  const data = snap.data();

  // If already submitted, don't reactivate
  if (data.status === "Submitted" || data.submitted) {
    return { ...data, alreadySubmitted: true };
  }

  // If already active, just return existing data (resume session)
  if (data.status === "Active" && data.startTime) {
    return data;
  }

  // Activate the session with startTime
  await updateDoc(ref, {
    status: "Active",
    startTime: serverTimestamp(),
    lastUpdated: serverTimestamp(),
  });

  return (await getDoc(ref)).data();
}

/* ========================================
   OPTIMIZED ANSWER SAVING
   - NOT called on every keystroke
   - Only called periodically or on critical events
   ======================================== */

// DEPRECATED: Don't call this on every answer change
// Use batchSaveAnswers instead
export async function saveAnswer(sessionId, qid, answer) {
  // Only call this for critical saves, not every keystroke
  const ref = doc(db, "exam_sessions", sessionId);
  await updateDoc(ref, {
    [`answers.${qid}`]: answer,
    lastUpdated: serverTimestamp(),
  });
}

// Batch save multiple answers at once (REDUCES FIREBASE WRITES)
export async function batchSaveAnswers(sessionId, answers) {
  const ref = doc(db, "exam_sessions", sessionId);
  
  // Build update object with all answers
  const updates = {
    lastUpdated: serverTimestamp(),
  };
  
  Object.entries(answers).forEach(([qid, answer]) => {
    updates[`answers.${qid}`] = answer;
  });
  
  await updateDoc(ref, updates);
}

/* ========================================
   VIOLATIONS (Minimal writes)
   ======================================== */

export async function addViolationWithSnapshot(sessionId, imageBase64) {
  const ref = doc(db, "exam_sessions", sessionId);

  await updateDoc(ref, {
    violations: increment(1),
    violationImages: imageBase64
      ? arrayUnion({
          img: imageBase64,
          time: new Date().toISOString(),
        })
      : arrayUnion(),
    lastUpdated: serverTimestamp(),
  });
}

/* ========================================
   ATOMIC SUBMISSION (with retry)
   ======================================== */

export async function submitSession(sessionId, reason, maxRetries = 3) {
  const ref = doc(db, "exam_sessions", sessionId);

  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(ref);

        if (!snap.exists()) {
          throw new Error("Session not found");
        }

        const data = snap.data();

        // CRITICAL: Check if already submitted
        if (data.status === "Submitted" || data.submitted) {
          return { success: true, alreadySubmitted: true };
        }

        // Atomic update
        transaction.update(ref, {
          status: "Submitted",
          submitted: true,
          submitReason: reason,
          submittedAt: serverTimestamp(),
          lastUpdated: serverTimestamp(),
        });

        return { success: true, alreadySubmitted: false };
      });

      return result;
    } catch (error) {
      lastError = error;
      console.error(`Submit attempt ${attempt} failed:`, error);

      // Exponential backoff
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  throw lastError || new Error("Submission failed after retries");
}

/* ========================================
   FULL SUBMISSION WITH ANSWERS
   - Used for offline/pending submissions
   ======================================== */

export async function submitWithAnswers(sessionId, answers, reason, maxRetries = 3) {
  const ref = doc(db, "exam_sessions", sessionId);

  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(ref);

        if (!snap.exists()) {
          throw new Error("Session not found");
        }

        const data = snap.data();

        if (data.status === "Submitted" || data.submitted) {
          return { success: true, alreadySubmitted: true };
        }

        // include answers only if they are not empty (prevent accidental wipe)
        const updateData = {
          status: "Submitted",
          submitted: true,
          submitReason: reason,
          submittedAt: serverTimestamp(),
          lastUpdated: serverTimestamp(),
        };

        if (answers && Object.keys(answers).length > 0) {
          updateData.answers = answers;
        }

        transaction.update(ref, updateData);

        return { success: true, alreadySubmitted: false };
      });

      return result;
    } catch (error) {
      lastError = error;
      console.error(`Submit attempt ${attempt} failed:`, error);

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  throw lastError || new Error("Submission failed after retries");
}

/* ========================================
   SESSION DATA RETRIEVAL
   ======================================== */

export async function getSession(sessionId) {
  const ref = doc(db, "exam_sessions", sessionId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    return null;
  }

  return snap.data();
}
