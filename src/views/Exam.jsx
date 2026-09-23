import { useEffect, useState, useRef, useCallback } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { getExamConfig } from "../services/examService";
import { getQuestions } from "../services/questionService";
import {
  initSession,
  activateSession,
  batchSaveAnswers,
  submitWithAnswers,
  addViolationWithSnapshot,
} from "../services/sessionService";
import {
  saveExamProgress,
  loadExamProgress,
  clearExamProgress,
  saveUserInfo,
  savePendingSubmission,
  loadPendingSubmission,
  clearPendingSubmission,
  hasPendingSubmission,
  downloadBackupFile,
  isStorageAvailable
} from "../services/localStorageService";

// --- CONFIG: Question Type Visuals ---
const TYPE_CONFIG = {
  mcq_single: { label: "SINGLE CHOICE", color: "#3b82f6", icon: "()" },
  mcq_multi: { label: "MULTI SELECT", color: "#a855f7", icon: "[+]" },
  short: { label: "SHORT ANSWER", color: "#f59e0b", icon: "#" },
  code: { label: "DEBUG CODE", color: "#800000", icon: "{ }" }
};

export default function Exam({ student }) {
  const scholar = student.scholar;
  const name = student.name;
  const examId = "common_test";
  const sessionId = `${scholar}_${examId}`;

  // --- REFS ---
  const violationLock = useRef(false);
  const violationsRef = useRef(0);
  const didInit = useRef(false);
  const syncTimerRef = useRef(null);
  const submitLockRef = useRef(false);

  // --- STATE ---
  const [questions, setQuestions] = useState(null);
  const [answers, setAnswers] = useState({});
  const [current, setCurrent] = useState(0);
  const [remaining, setRemaining] = useState(null);
  const [violations, setViolations] = useState(0);
  const [fullscreen, setFullscreen] = useState(true);
  const [blocked] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitStatus, setSubmitStatus] = useState("standard");
  const [shortcutWarning, setShortcutWarning] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionData, setSessionData] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [durationMinutes, setDurationMinutes] = useState(60);
  
  // NEW: Offline-first state
  const [localSaveStatus, setLocalSaveStatus] = useState(null); // "saved" | "syncing" | "error"
  const [recoveredData, setRecoveredData] = useState(null);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [pendingSubmission, setPendingSubmission] = useState(null);

  /* ========================================
     LOCAL STORAGE RECOVERY (On Page Load)
     ======================================== */
  useEffect(() => {
    if (!isStorageAvailable()) {
      console.warn("localStorage not available");
      return;
    }

    // Check for pending submission
    if (hasPendingSubmission()) {
      const pending = loadPendingSubmission();
      if (pending) {
        setPendingSubmission(pending);
        setShowRecoveryModal(true);
      }
    }

    // Check for exam progress recovery
    const progress = loadExamProgress();
    if (progress) {
      // Only recover if it matches current user
      if (progress.scholar === scholar && progress.name === name) {
        setRecoveredData(progress);
        setShowRecoveryModal(true);
      } else {
        // Clear if different user
        clearExamProgress();
      }
    }

    // Save user info for persistence
    saveUserInfo(name, scholar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ========================================
     RECOVERY MODAL HANDLING
     ======================================== */
  const handleRecovery = () => {
    if (recoveredData) {
      setAnswers(recoveredData.answers || {});
      setCurrent(recoveredData.currentQuestion || 0);
      if (recoveredData.startTime) {
        setStartTime(recoveredData.startTime);
      }
      setShowRecoveryModal(false);
      setRecoveredData(null);
    }
  };

  const handleDiscardRecovery = () => {
    clearExamProgress();
    setShowRecoveryModal(false);
    setRecoveredData(null);
  };

  const handleRetryPendingSubmission = async () => {
    if (!pendingSubmission) return;
    
    setIsSubmitting(true);
    try {
      const result = await submitWithAnswers(
        sessionId,
        pendingSubmission.answers,
        "Offline submission retry"
      );
      
      if (result && !result.alreadySubmitted) {
        clearPendingSubmission();
        setSubmitStatus("standard");
        setSubmitted(true);
        setShowRecoveryModal(false);
        setPendingSubmission(null);
      } else if (result && result.alreadySubmitted) {
        clearPendingSubmission();
        setSubmitStatus("existing");
        setSubmitted(true);
        setShowRecoveryModal(false);
        setPendingSubmission(null);
      }
    } catch (error) {
      console.error("Retry submission failed:", error);
      alert("Submission still failed. Please download your backup file and contact admin.");
      downloadBackupFile(pendingSubmission);
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ========================================
     LOGIC: VIOLATIONS
     ======================================== */
  const registerViolation = useCallback(async () => {
    if (violationLock.current || submitted || blocked) return;
    violationLock.current = true;

    const newCount = violationsRef.current + 1;
    violationsRef.current = newCount;
    setViolations(newCount);

    setTimeout(async () => {
      try {
        await addViolationWithSnapshot(sessionId, null);
      } catch (e) { }

      if (newCount >= 5) {
        handleFinalSubmit("Multiple violations (Auto-terminate)");
      } else {
        violationLock.current = false;
      }
    }, 1000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, submitted, blocked]);

  /* ========================================
     SAFE SUBMISSION SYSTEM
     - Local backup first
     - Firebase second
     - Download fallback
     ======================================== */
  const handleFinalSubmit = async (reason) => {
    // Prevent double submission
    if (submitted || isSubmitting || submitLockRef.current) return;
    submitLockRef.current = true;
    setIsSubmitting(true);
    setSubmitStatus(reason && reason.includes("violation") ? "violation" : "standard");

    // STEP 1: Save to localStorage as backup
    const submissionData = {
      name,
      scholar,
      answers,
      startTime,
      endTime: new Date().toISOString(),
      status: "Submitted",
      submitReason: reason
    };
    
    savePendingSubmission(submissionData);
    saveExamProgress(submissionData);

    // STEP 2: Try Firebase submission
    try {
      const result = await submitWithAnswers(sessionId, answers, reason);
      
      if (result && result.alreadySubmitted) {
        setSubmitStatus("existing");
      }
      
      setSubmitted(true);
      
      // STEP 3: Clear local storage on success
      clearExamProgress();
      clearPendingSubmission();
      
      // STEP 4: Download backup file (always)
      downloadBackupFile(submissionData);
      
    } catch (error) {
      console.error("Firebase submission failed:", error);
      
      // If offline or Firebase failed, mark as pending
      if (!isOnline) {
        setSubmitStatus("pending");
        alert("⚠️ You are offline. Your answers have been saved locally.\n\nWhen you go online, they will be auto-uploaded.\n\nA backup file has been downloaded.");
      } else {
        alert("❌ Submission failed. Your answers have been saved locally.\n\nA backup file has been downloaded. Please contact admin.");
      }
      
      // Download backup file as fallback
      downloadBackupFile(submissionData);
      
      // Still mark as submitted to prevent UI loops
      setSubmitted(true);
    } finally {
      setIsSubmitting(false);
      submitLockRef.current = false;
    }
  };

  /* ========================================
     PERIODIC FIREBASE SYNC (Optimized)
     - Every 30 seconds, not every keystroke
     - Only if online
     ======================================== */
  useEffect(() => {
    if (blocked || submitted || !isOnline) return;

    // Sync answers to Firebase every 30 seconds
    syncTimerRef.current = setInterval(async () => {
      if (Object.keys(answers).length > 0) {
        try {
          setLocalSaveStatus("syncing");
          await batchSaveAnswers(sessionId, answers);
          setLocalSaveStatus("saved");
        } catch (error) {
          console.error("Sync failed:", error);
          setLocalSaveStatus("error");
        }
      }
    }, 30000); // 30 seconds

    return () => {
      if (syncTimerRef.current) {
        clearInterval(syncTimerRef.current);
      }
    };
  }, [answers, blocked, submitted, isOnline, sessionId]);

  /* ========================================
     LOCAL AUTO-SAVE (Every Answer Change)
     - Instant save to localStorage
     - No Firebase call here
     ======================================== */
  const handleAnswer = (q, val) => {
    // Update local state immediately
    let updated;
    if (q.type === "mcq_multi") {
      const prev = answers[q.qid] || [];
      updated = prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val];
    } else {
      updated = val;
    }
    setAnswers((prev) => ({ ...prev, [q.qid]: updated }));

    // Save to localStorage immediately (no Firebase call)
    const progressData = {
      name,
      scholar,
      answers: { ...answers, [q.qid]: updated },
      currentQuestion: current,
      startTime,
      lastSaved: Date.now()
    };
    saveExamProgress(progressData);
    setLocalSaveStatus("saved");
  };

  /* ========================================
     INITIALIZATION & ACTIVATION
     ======================================== */
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    async function startExamSession() {
      try {
        const session = await initSession(sessionId, { scholar, name, examId });
        
        if (session.status === "Submitted" || session.submitted) {
          setSubmitStatus("existing");
          setSubmitted(true);
          return;
        }

        const activeSession = await activateSession(sessionId);
        
        if (activeSession.alreadySubmitted) {
          setSubmitStatus("existing");
          setSubmitted(true);
          return;
        }

        setSessionData(activeSession);
        
        // Sync answers from Firebase if available
        if (activeSession.answers && Object.keys(activeSession.answers).length > 0) {
          setAnswers(activeSession.answers);
        }
        
        setViolations(activeSession.violations || 0);
        violationsRef.current = activeSession.violations || 0;

        if (activeSession.startTime) {
          const startTimeMs = activeSession.startTime.toDate 
            ? activeSession.startTime.toDate().getTime()
            : new Date(activeSession.startTime).getTime();
          setStartTime(startTimeMs);
        }

        const examConfig = await getExamConfig();
        setDurationMinutes(examConfig.durationMinutes || 60);

        let qs = await getQuestions(examId);
        for (let i = qs.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [qs[i], qs[j]] = [qs[j], qs[i]];
        }
        setQuestions(qs);

      } catch (err) {
        console.error("Session Init Error:", err);
      }
    }
    startExamSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ========================================
     PER-USER TIMER
     ======================================== */
  useEffect(() => {
    // IMPORTANT: Wait for startTime and initialization to prevent premature auto-submit
    if (blocked || submitted || !startTime || showRecoveryModal || !questions) return;
    let interval;

    const configRef = doc(db, "exam-config", "current-exam");
    const unsubscribe = onSnapshot(configRef, (snap) => {
      if (snap.exists() && snap.data().status === "ended") {
        handleFinalSubmit("Terminated by Admin");
      }
    });

    const DURATION_MS = durationMinutes * 60 * 1000;

    function calculateRemaining() {
      const now = Date.now();
      const elapsed = now - startTime;
      const remainingMs = DURATION_MS - elapsed;
      return Math.max(0, Math.floor(remainingMs / 1000));
    }

    const initialRemaining = calculateRemaining();
    setRemaining(initialRemaining);

    if (initialRemaining <= 0) {
      handleFinalSubmit("Time completed");
      return () => {
        unsubscribe();
      };
    }

    interval = setInterval(() => {
      const remainingSeconds = calculateRemaining();
      setRemaining(remainingSeconds);

      if (remainingSeconds <= 0) {
        clearInterval(interval);
        handleFinalSubmit("Time completed");
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocked, submitted, startTime, durationMinutes]);

  /* ========================================
     NETWORK STATUS (Robus Tracking)
     - navigator.onLine is unreliable
     - Fetch ping confirms REAL connectivity
     ======================================== */
  useEffect(() => {
    const checkConnectivity = async () => {
      try {
        // Use a lightweight fetch to verify actual internet access
        // mode: 'no-cors' allows us to ping without CORS headers
        await fetch("https://www.google.com/favicon.ico", { 
          mode: 'no-cors', 
          cache: 'no-store' 
        });
        if (!isOnline) {
          setIsOnline(true);
          handleOnlineRestored();
        }
      } catch (e) {
        if (isOnline) setIsOnline(false);
      }
    };

    const handleOnlineRestored = async () => {
      console.log("Network restored - starting sync...");
      // Sync current batch
      if (Object.keys(answers).length > 0) {
        try {
          await batchSaveAnswers(sessionId, answers);
          setLocalSaveStatus("saved");
        } catch (e) {}
      }

      // Sync pending submissions if any
      if (hasPendingSubmission()) {
        const pending = loadPendingSubmission();
        if (pending) {
          try {
            await submitWithAnswers(sessionId, pending.answers, "Auto-sync from offline");
            clearPendingSubmission();
          } catch (e) {}
        }
      }
    };

    // Run check every 5 seconds
    const interval = setInterval(checkConnectivity, 5000);
    
    // Initial check
    checkConnectivity();

    return () => clearInterval(interval);
  }, [isOnline, answers, sessionId]);

  /* ========================================
     ANTI-CHEAT LISTENERS
     ======================================== */
  useEffect(() => {
    if (blocked || submitted) return;

    const handleFsChange = () => {
      if (!document.fullscreenElement) {
        setFullscreen(false);
        registerViolation();
      } else {
        setFullscreen(true);
      }
    };

    const handleVisibility = () => { if (document.hidden) registerViolation(); };
    const handleBlur = () => { registerViolation(); };

    const handleKeyDown = (e) => {
      const k = e.key.toLowerCase();
      if (e.key === "F12" || e.altKey || (e.ctrlKey && ["c", "v", "x", "u", "shift", "tab"].includes(k)) || e.metaKey) {
        e.preventDefault();
        setShortcutWarning(true);
        registerViolation();
        setTimeout(() => setShortcutWarning(false), 5000);
      }
    };

    document.addEventListener("fullscreenchange", handleFsChange);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [blocked, submitted, registerViolation]);

  /* ========================================
     HELPERS
     ======================================== */
  function formatTime(seconds) {
    if (seconds == null || seconds < 0) return "--:--";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  /* ========================================
     CONDITIONAL RENDERS
     ======================================== */
  if (blocked) return <Screen><Card title="ACCESS BLOCKED" msg="Environment integrity failed. Access revoked." color="#ef4444" /></Screen>;

  if (submitted) return (
    <Screen>
      <Card
        title={submitStatus === "violation" ? "EXAM AUTO-SUBMITTED" : 
              submitStatus === "pending" ? "OFFLINE SUBMISSION" :
              submitStatus === "existing" ? "ALREADY SUBMITTED" : 
              "SUBMISSION RECEIVED"}
        msg={submitStatus === "violation" ? "Your exam has been submitted automatically due to rule violations." :
              submitStatus === "pending" ? "Your answers have been saved locally and will sync when you're online. A backup file has been downloaded." :
              submitStatus === "existing" ? "This exam has already been submitted." :
              "Your responses have been recorded. A backup file has been downloaded."}
        color={submitStatus === "violation" ? "#ef4444" : 
               submitStatus === "pending" ? "#f59e0b" :
               submitStatus === "existing" ? "#64748b" :
               "#800000"}
      />
    </Screen>
  );

  if (!fullscreen) return (
    <Screen>
      <Card
        title="FULLSCREEN REQUIRED"
        msg={`Violations: ${Math.min(violations, 5)}/5`}
        color="#D4AF37"
        action={() => document.documentElement.requestFullscreen().then(() => setFullscreen(true))}
      />
    </Screen>
  );

  if (!questions) return <Screen><Card title="INITIALIZING IDE..." msg="Loading environment modules." color="#fff" /></Screen>;

  if (showSummary) return (
    <Screen>
      <SummaryCard
        total={questions.length}
        attempted={Object.keys(answers).length}
        onBack={() => setShowSummary(false)}
        onSubmit={() => handleFinalSubmit("Manual")}
        isSubmitting={isSubmitting}
      />
    </Screen>
  );

  const q = questions[current];
  const typeInfo = TYPE_CONFIG[q.type] || TYPE_CONFIG.short;

  /* ========================================
     RECOVERY MODAL
     ======================================== */
  if (showRecoveryModal) {
    return (
      <Screen>
        <div className="glass" style={popup}>
          <h2 style={{ color: pendingSubmission ? "#f59e0b" : "#800000", marginBottom: "20px" }}>
            {pendingSubmission ? "⚠️ Pending Submission Detected" : "💾 Recover Previous Session?"}
          </h2>
          
          {pendingSubmission ? (
            <>
              <p style={{ color: "#94a3b8", marginBottom: "20px" }}>
                A previous submission attempt failed. Would you like to retry?
              </p>
              <div style={{ display: 'flex', gap: "15px", justifyContent: 'center' }}>
                <button style={btnGhost} onClick={() => {
                  clearPendingSubmission();
                  setShowRecoveryModal(false);
                  setPendingSubmission(null);
                }}>
                  Discard
                </button>
                <button style={btnSolid} onClick={handleRetryPendingSubmission}>
                  Retry Submission
                </button>
              </div>
            </>
          ) : (
            <>
              <p style={{ color: "#94a3b8", marginBottom: "20px" }}>
                We found your previous progress. Recover it?
              </p>
              <div style={{ display: 'flex', gap: "15px", justifyContent: 'center' }}>
                <button style={btnGhost} onClick={handleDiscardRecovery}>
                  Start Fresh
                </button>
                <button style={btnSolid} onClick={handleRecovery}>
                  Recover
                </button>
              </div>
            </>
          )}
        </div>
      </Screen>
    );
  }

  /* ========================================
     MAIN RENDER
     ======================================== */
  return (
    <div style={page}>

      {/* SHORTCUT WARNING OVERLAY */}
      {shortcutWarning && (
        <div style={shortcutOverlay}>
          <div style={shortcutBox}>
            <div style={shortcutIcon}>!</div>
            <h2 style={shortcutTitle}>ILLEGAL SHORTCUT DETECTED</h2>
            <p style={shortcutMsg}>
              Keyboard shortcuts are strictly prohibited. This violation has been logged.
            </p>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="glass" style={header}>
        <div style={headerLeft}>
          <div style={logoBadge}>H</div>
          <div style={sep}></div>
          <div>
            <div style={nameText}>{name}</div>
            <div style={idText}>{scholar}</div>
          </div>
        </div>

        <div style={headerRight}>
          {/* Local Save Status */}
          <div style={syncStatusBadge}>
            <span style={localSaveStatus === "saved" ? syncDotGreen : 
                         localSaveStatus === "syncing" ? syncDotYellow : 
                         localSaveStatus === "error" ? syncDotRed : syncDotGray}></span>
            {localSaveStatus === "saved" ? "SAVED" : 
             localSaveStatus === "syncing" ? "SYNCING..." : 
             localSaveStatus === "error" ? "ERROR" : ""}
          </div>

          {/* Network Status */}
          {!isOnline && (
            <div style={offlineBadge}>
              <span style={offlineDot}></span>
              OFFLINE
            </div>
          )}
          
          <div style={statBox}>
            <span style={statLabel}>VIOLATIONS</span>
            <span style={{ color: violations > 0 ? '#ef4444' : '#800000', fontWeight: 'bold' }}>
              {Math.min(violations, 5)} / 5
            </span>
          </div>
          
          <div style={statBox}>
            <span style={statLabel}>REMAINING</span>
            <span style={{...timerMono, color: remaining !== null && remaining < 300 ? '#ef4444' : '#fff'}}>
              {formatTime(remaining)}
            </span>
          </div>
        </div>
      </header>

      {/* WORKSPACE */}
      <div style={workspace}>

        {/* SIDEBAR */}
        <div className="glass" style={sidebar}>
          <div style={sidebarHeader}>QUESTION EXPLORER</div>
          <div style={grid}>
            {questions.map((_q, i) => {
              const isActive = i === current;
              const isDone = answers[_q.qid] && (Array.isArray(answers[_q.qid]) ? answers[_q.qid].length > 0 : true);
              return (
                <div
                  key={_q.qid}
                  onClick={() => setCurrent(i)}
                  style={isActive ? qBoxActive : isDone ? qBoxDone : qBox}
                >
                  {i + 1 < 10 ? `0${i + 1}` : i + 1}
                </div>
              )
            })}
          </div>
        </div>

        {/* EDITOR AREA */}
        <div className="glass" style={editor}>

          <div style={editorBar}>
            <div style={tabActive}>Q{current + 1}</div>

            <div style={{
              ...typeBadge,
              color: typeInfo.color,
              borderColor: typeInfo.color
            }}>
              <span style={{ marginRight: '6px' }}>{typeInfo.icon}</span>
              {typeInfo.label}
            </div>

            <div style={metaGroup}>
              <span style={pillGreen}>+{q.marks}</span>
              <span style={pillRed}>-{q.negative}</span>
            </div>
          </div>

          <div style={content}>
            <h3 style={qText}>
              <span style={lineNum}>{current + 1 < 10 ? `0${current + 1}` : current + 1}</span>
              {q.question}
            </h3>

            {q.questionImg && <img src={q.questionImg} style={imgStyle} alt="diagram" />}

            <div style={optionsArea}>
              {(q.type === "mcq_single" || q.type === "mcq_multi") ? (
                q.options.map((opt, i) => {
                  const isSelected = q.type === "mcq_single"
                    ? answers[q.qid] === opt
                    : (answers[q.qid] || []).includes(opt);

                  return (
                    <div
                      key={i}
                      style={isSelected ? optRowSelected : optRow}
                      onClick={() => handleAnswer(q, opt)}
                    >
                      <span style={lineNum}>{String.fromCharCode(65 + i)}</span>

                      <div style={q.type === 'mcq_single' ? radioCircle(isSelected) : checkSquare(isSelected)}>
                        {isSelected && <div style={innerDot(q.type === 'mcq_single' ? typeInfo.color : null)}></div>}
                      </div>

                      <div style={optText}>
                        {opt}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={optRow}>
                  <span style={lineNum}>Answer</span>
                  <textarea
                    style={textArea}
                    placeholder="// Type your answer here..."
                    value={answers[q.qid] || ""}
                    onChange={(e) => handleAnswer(q, e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>

          <div style={footer}>
            <button style={btnGhost} disabled={current === 0} onClick={() => setCurrent(c => c - 1)}>
              &lt; PREV
            </button>

            {current === questions.length - 1 ? (
              <button style={btnSolid} onClick={() => setShowSummary(true)}>
                SUBMIT TEST
              </button>
            ) : (
              <button style={btnSolid} onClick={() => setCurrent(c => c + 1)}>
                NEXT &gt;
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ========================================
   SUB COMPONENTS
   ======================================== */

const Screen = ({ children }) => <div style={screen}>{children}</div>;

const Card = ({ title, msg, color, action }) => (
  <div className="glass" style={popup}>
    <h2 style={{ color: color, marginBottom: "15px" }}>{title}</h2>
    <p style={{ color: '#94a3b8', marginBottom: "25px" }}>{msg}</p>
    {action && <button style={btnSolid} onClick={action}>ENABLE FULLSCREEN</button>}
  </div>
);

const SummaryCard = ({ total, attempted, onBack, onSubmit, isSubmitting }) => {
  const [submitting, setSubmitting] = useState(false);
  
  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    await onSubmit();
  };
  
  return (
    <div className="glass" style={popup}>
      <h2 style={{ color: '#fff', marginBottom: "20px" }}>Confirm Submission</h2>
      <div style={{ marginBottom: "30px", fontSize: '1.2rem', fontFamily: "'Fira Code', monospace" }}>
        ATTEMPTED: <span style={{ color: '#800000' }}>{attempted}</span> / {total}
      </div>
      <div style={{ display: 'flex', gap: "15px", justifyContent: 'center' }}>
        <button style={btnGhost} onClick={onBack} disabled={submitting}>RETURN</button>
        <button 
          style={submitting ? btnDisabled : btnSolid} 
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? "SUBMITTING..." : "FINAL SUBMIT"}
        </button>
      </div>
    </div>
  );
};

/* ========================================
   STYLES
   ======================================== */

const page = {
  height: "100vh",
  padding: "20px",
  display: "flex",
  flexDirection: "column",
  gap: "20px",
  background: "#050505"
};

const shortcutOverlay = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(239, 68, 68, 0.4)",
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backdropFilter: "blur(8px)"
};

const shortcutBox = {
  background: "#1a0505",
  border: "2px solid #ef4444",
  padding: "50px",
  borderRadius: "20px",
  textAlign: "center",
  boxShadow: "0 0 50px rgba(239, 68, 68, 0.5)",
  maxWidth: "500px"
};

const shortcutIcon = {
  fontSize: "4rem",
  marginBottom: "20px",
  color: "#ef4444"
};

const shortcutTitle = {
  color: "#ef4444",
  fontSize: "1.8rem",
  fontWeight: "900",
  marginBottom: "15px",
  textTransform: "uppercase",
  letterSpacing: "1px"
};

const shortcutMsg = {
  color: "#1e293b",
  fontSize: "1rem",
  lineHeight: "1.6"
};

const header = {
  height: "70px",
  borderRadius: "12px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "0 25px"
};

const headerLeft = {
  display: "flex",
  gap: "20px",
  alignItems: "center"
};

const headerRight = {
  display: "flex",
  gap: "30px",
  alignItems: "center"
};

const logoBadge = {
  width: "35px",
  height: "35px",
  background: "#800000",
  color: "#ffffff",
  fontWeight: "bold",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "8px"
};

const sep = {
  width: "1px",
  height: "25px",
  background: "rgba(255,255,255,0.1)"
};

const nameText = {
  fontWeight: "700",
  fontSize: "0.9rem",
  color: "#1e293b"
};

const idText = {
  fontSize: "0.75rem",
  color: "#94a3b8",
  fontFamily: "'Fira Code', monospace"
};

const syncStatusBadge = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "6px 12px",
  background: "rgba(128, 0, 0, 0.1)",
  border: "1px solid #800000",
  borderRadius: "6px",
  color: "#800000",
  fontSize: "0.7rem",
  fontWeight: "bold"
};

const syncDotGreen = {
  width: "8px",
  height: "8px",
  background: "#800000",
  borderRadius: "50%",
  boxShadow: "0 0 8px #800000"
};

const syncDotYellow = {
  width: "8px",
  height: "8px",
  background: "#f59e0b",
  borderRadius: "50%",
  animation: "pulse 1s infinite"
};

const syncDotRed = {
  width: "8px",
  height: "8px",
  background: "#ef4444",
  borderRadius: "50%"
};

const syncDotGray = {
  width: "8px",
  height: "8px",
  background: "#64748b",
  borderRadius: "50%"
};

const offlineBadge = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "6px 12px",
  background: "rgba(239, 68, 68, 0.2)",
  border: "1px solid #ef4444",
  borderRadius: "6px",
  color: "#ef4444",
  fontSize: "0.75rem",
  fontWeight: "bold"
};

const offlineDot = {
  width: "8px",
  height: "8px",
  background: "#ef4444",
  borderRadius: "50%"
};

const statBox = {
  textAlign: "right"
};

const statLabel = {
  fontSize: "0.65rem",
  color: "#64748b",
  letterSpacing: "1px",
  display: "block",
  marginBottom: "4px"
};

const timerMono = {
  fontFamily: "'Fira Code', monospace",
  fontSize: "1.2rem",
  fontWeight: "bold",
  color: "#1e293b"
};

const workspace = {
  display: "grid",
  gridTemplateColumns: "260px 1fr",
  gap: "20px",
  flex: "1",
  minHeight: "0"
};

const sidebar = {
  borderRadius: "12px",
  padding: "20px",
  display: "flex",
  flexDirection: "column"
};

const sidebarHeader = {
  fontSize: "0.75rem",
  color: "#64748b",
  letterSpacing: "1px",
  marginBottom: "20px",
  fontWeight: "bold"
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: "10px"
};

const qBox = {
  height: "40px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "8px",
  background: "rgba(255,255,255,0.03)",
  color: "#64748b",
  cursor: "pointer",
  fontFamily: "'Fira Code', monospace",
  fontSize: "0.8rem"
};

const qBoxActive = {
  ...qBox,
  background: "rgba(128, 0, 0, 0.2)",
  color: "#800000",
  border: "1px solid #800000"
};

const qBoxDone = {
  ...qBox,
  background: "rgba(128, 0, 0, 0.05)",
  color: "#800000"
};

const editor = {
  borderRadius: "12px",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden"
};

const editorBar = {
  height: "45px",
  background: "rgba(0,0,0,0.3)",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center"
};

const tabActive = {
  height: "100%",
  padding: "0 25px",
  background: "rgba(255,255,255,0.05)",
  borderRight: "1px solid rgba(255,255,255,0.08)",
  display: "flex",
  alignItems: "center",
  fontSize: "0.85rem",
  color: "#cbd5e1",
  fontFamily: "'Fira Code', monospace",
  borderTop: "2px solid #800000"
};

const typeBadge = {
  fontSize: "0.7rem",
  fontWeight: "800",
  padding: "4px 12px",
  borderRadius: "20px",
  border: "1px solid",
  letterSpacing: "0.5px",
  display: "flex",
  alignItems: "center"
};

const metaGroup = {
  paddingRight: "20px",
  display: "flex",
  gap: "10px"
};

const pillGreen = {
  fontSize: "0.75rem",
  color: "#800000",
  background: "rgba(128, 0, 0,0.1)",
  padding: "2px 8px",
  borderRadius: "4px"
};

const pillRed = {
  fontSize: "0.75rem",
  color: "#ef4444",
  background: "rgba(239,68,68,0.1)",
  padding: "2px 8px",
  borderRadius: "4px"
};

const content = {
  padding: "40px",
  flex: "1",
  overflowY: "auto"
};

const lineNum = {
  color: "#334155",
  fontFamily: "'Fira Code', monospace",
  marginRight: "20px",
  fontSize: "0.9rem",
  userSelect: "none"
};

const qText = {
  fontSize: "1.2rem",
  lineHeight: "1.6",
  fontWeight: "500",
  display: "flex",
  color: "#1e293b"
};

const imgStyle = {
  maxWidth: "100%",
  borderRadius: "8px",
  margin: "20px 0 20px 40px",
  border: "1px solid #333"
};

const optionsArea = {
  marginTop: "40px"
};

const optRow = {
  display: "flex",
  alignItems: "center",
  marginTop: "15px",
  cursor: "pointer",
  transition: "all 0.2s"
};

const optRowSelected = {
  ...optRow
};

const optText = {
  flex: "1",
  padding: "15px 20px",
  background: "rgba(255,255,255,0.02)",
  borderRadius: "8px",
  color: "#94a3b8",
  fontSize: "0.95rem"
};

const textArea = {
  width: "100%",
  height: "150px",
  background: "#0a0a0f",
  border: "1px solid #333",
  borderRadius: "8px",
  padding: "15px",
  color: "#1e293b",
  fontFamily: "'Fira Code', monospace"
};

const footer = {
  padding: "20px",
  borderTop: "1px solid rgba(255,255,255,0.08)",
  display: "flex",
  justifyContent: "space-between"
};

const btnGhost = {
  padding: "12px 24px",
  background: "transparent",
  border: "1px solid #334155",
  color: "#94a3b8",
  borderRadius: "6px",
  cursor: "pointer"
};

const btnSolid = {
  padding: "12px 30px",
  background: "#fff",
  color: "#ffffff",
  border: "none",
  borderRadius: "6px",
  fontWeight: "bold",
  cursor: "pointer"
};

const btnDisabled = {
  padding: "12px 30px",
  background: "#333",
  color: "#666",
  border: "none",
  borderRadius: "6px",
  fontWeight: "bold",
  cursor: "not-allowed"
};

const screen = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#050505"
};

const popup = {
  padding: "40px",
  borderRadius: "16px",
  width: "450px",
  textAlign: "center",
  border: "1px solid rgba(255,255,255,0.1)"
};

const radioCircle = (active) => ({
  minWidth: "20px",
  height: "20px",
  borderRadius: "50%",
  border: active ? "2px solid #800000" : "2px solid #475569",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginRight: "15px"
});

const checkSquare = (active) => ({
  minWidth: "20px",
  height: "20px",
  borderRadius: "4px",
  border: active ? "2px solid #a855f7" : "2px solid #475569",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginRight: "15px"
});

const innerDot = (color) => ({
  width: "10px",
  height: "10px",
  background: color || "#a855f7",
  borderRadius: "50%"
});
