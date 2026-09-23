import { useState, useEffect, useRef } from "react";

export default function Instructions({ setView, student }) {
  const [isSecure, setIsSecure] = useState(false);
  const [violationMsg, setViolationMsg] = useState("");
  const wakeLockRef = useRef(null);

  // --- MONITORING LOGIC ---
  useEffect(() => {
    // If secure mode is active, monitor for focus loss IMMEDIATELY
    if (isSecure) {
      const handleFocusLoss = () => {
        setIsSecure(false);
        setViolationMsg("Focus lost! You switched tabs or a notification popped up. Please re-enable secure mode.");

        // Release wake lock if focus is lost
        if (wakeLockRef.current) {
          wakeLockRef.current.release().then(() => { wakeLockRef.current = null; });
        }

        // Optional: Exit fullscreen to force them to restart the process
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => { });
        }
      };

      window.addEventListener("blur", handleFocusLoss);
      return () => window.removeEventListener("blur", handleFocusLoss);
    }
  }, [isSecure]);

  const handleSecureLock = async () => {
    try {
      // 1. Force Fullscreen
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }

      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
        }

      } catch (err) {
        console.log("Wake Lock not supported, user must disable sleep manually.");
      }

      // 3. Set Secure State
      setIsSecure(true);
      setViolationMsg("");

    } catch (err) {
      alert("Error: Fullscreen is required to secure the environment.");
    }
  };

  return (
    <div style={page}>
      <div className="glass" style={card}>
        <div style={header}>
          <h2 style={title}>Exam Instructions</h2>

        </div>

        <div style={metaBox}>
          <div style={metaRow}>
            <span style={metaLabel}>CANDIDATE</span>
            <span style={metaValue}>{student.name}</span>
          </div>
          <div style={metaRow}>
            <span style={metaLabel}>REGISTRATION NO</span>
            <span style={metaValue}>{student.scholar}</span>
          </div>
        </div>

        {/* --- SECURITY LOCKDOWN SECTION --- */}
        <div style={isSecure ? lockdownZoneSuccess : lockdownZone}>
          <div style={iconBox}>{isSecure ? "🔒" : "⚠️"}</div>
          <div style={lockdownContent}>
            <h3 style={isSecure ? lockdownTitleSuccess : lockdownTitle}>
              {isSecure ? "Environment is Secure" : "Secure Mode Required"}
            </h3>

            {!isSecure ? (
              <>
                <p style={lockdownText}>
                  Please enable fullscreen to take the test securely.
                </p>
                <button style={btnLock} onClick={handleSecureLock}>
                  Enable Secure Mode
                </button>
                {violationMsg && <div style={errorBanner}>{violationMsg}</div>}
              </>
            ) : (
              <p style={lockdownTextSuccess}>
                Monitoring is active. Do not press Esc or switch tabs,
                as this may cause your test to submit automatically.
              </p>
            )}
          </div>
        </div>

        {/* --- DANGER ZONE (SYSTEM SETTINGS) --- */}
        {!isSecure && (
          <div style={dangerBox}>
            <div style={dangerIcon}>🛑</div>
            <div>
              <h4 style={dangerTitle}>Please Disable Notifications </h4>
              <p style={dangerText}>
                Your exam may <b>submit automatically</b> if:
              </p>
              <ul style={dangerList}>
                <li>Your screen turns off or goes to <b>Sleep Mode</b>.</li>
                <li>A <b>notification or popup</b> appears (e.g., WhatsApp, Antivirus or any other).</li>
                <li>You press the <b>Windows/Command Key</b>.</li>
                <li>You press the <b>Ctrl+c or Ctrl+v</b>.</li>
              </ul>

            </div>
          </div>
        )}

        <div style={rulesSection}>
          <h4 style={rulesTitle}>EXAM RULES</h4>
          <ul style={list}>
            <li>You must remain in <b>Fullscreen Mode</b> at all times.</li>
            <li>Switching tabs will count as a <b>Violation</b>.</li>
            <li>5 Tab Switches will result in <b>Exam Disqualification</b>.</li>
          </ul>
        </div>

        <button
          style={isSecure ? btnPrimary : btnDisabled}
          disabled={!isSecure}
          onClick={() => setView("COUNTDOWN")}
        >
          {isSecure ? "Start Exam" : "Waiting for Secure Mode..."}
        </button>
      </div>
    </div>
  );
}

/* --- STYLES --- */
const page = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "20px",
};

const card = {
  width: "100%",
  maxWidth: "600px",
  padding: "40px",
  borderRadius: "20px",
  border: "1px solid rgba(255, 255, 255, 0.05)",
};

const header = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "30px",
};

const title = {
  fontSize: "1.8rem",
  color: "#1e293b",
  margin: "0",
};

const metaBox = {
  background: "rgba(255, 255, 255, 0.02)",
  borderRadius: "12px",
  padding: "20px",
  marginBottom: "30px",
  border: "1px solid rgba(255, 255, 255, 0.05)",
};

const metaRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "10px",
};

const metaLabel = {
  color: "#64748b",
  fontSize: "0.8rem",
  letterSpacing: "1px",
  fontWeight: "600",
};

const metaValue = {
  color: "#1e293b",
  fontSize: "1.1rem",
  fontWeight: "700",
  fontFamily: "'Fira Code', monospace",
};

const lockdownZone = {
  background: "linear-gradient(90deg, rgba(239, 68, 68, 0.05) 0%, transparent 100%)",
  borderLeft: "4px solid #ef4444",
  borderRadius: "8px",
  padding: "20px",
  marginBottom: "30px",
  display: "flex",
  gap: "20px",
};

const lockdownZoneSuccess = {
  background: "linear-gradient(90deg, rgba(128, 0, 0, 0.05) 0%, transparent 100%)",
  borderLeft: "4px solid #800000",
  borderRadius: "8px",
  padding: "20px",
  marginBottom: "30px",
  display: "flex",
  gap: "20px",
};

const iconBox = {
  fontSize: "2rem",
};

const lockdownContent = {
  flex: "1",
};

const lockdownTitle = {
  color: "#ef4444",
  fontSize: "1.1rem",
  margin: "0 0 10px 0",
};

const lockdownTitleSuccess = {
  color: "#800000",
  fontSize: "1.1rem",
  margin: "0 0 10px 0",
};

const lockdownText = {
  color: "#cbd5e1",
  fontSize: "0.9rem",
  marginBottom: "15px",
  lineHeight: "1.5",
};

const lockdownTextSuccess = {
  color: "#cbd5e1",
  fontSize: "0.9rem",
  lineHeight: "1.5",
  margin: 0
};

const errorBanner = {
  background: "#ef4444",
  color: "#1e293b",
  padding: "10px",
  borderRadius: "6px",
  fontSize: "0.85rem",
  fontWeight: "bold",
  textAlign: "center",
  marginTop: "10px"
};

const btnLock = {
  width: "100%",
  padding: "12px",
  background: "#ef4444",
  color: "#1e293b",
  border: "none",
  borderRadius: "6px",
  fontSize: "0.85rem",
  fontWeight: "700",
  cursor: "pointer",
  letterSpacing: "0.5px",
};

/* --- NEW DANGER ZONE STYLES --- */
const dangerBox = {
  background: "#1a0505",
  border: "1px dashed #ef4444",
  borderRadius: "8px",
  padding: "15px",
  marginBottom: "30px",
  display: "flex",
  gap: "15px",
  alignItems: "start"
};

const dangerIcon = {
  fontSize: "1.5rem"
};

const dangerTitle = {
  color: "#ef4444",
  fontSize: "0.9rem",
  fontWeight: "800",
  margin: "0 0 8px 0",
  letterSpacing: "0.5px"
};

const dangerText = {
  color: "#cbd5e1",
  fontSize: "0.85rem",
  margin: "0 0 5px 0",
};

const dangerList = {
  color: "#94a3b8",
  fontSize: "0.8rem",
  paddingLeft: "20px",
  margin: "5px 0 10px 0",
  lineHeight: "1.4"
};

const rulesSection = {
  marginBottom: "30px",
  paddingLeft: "10px",
};

const rulesTitle = {
  fontSize: "0.85rem",
  color: "#800000",
  letterSpacing: "1px",
  marginBottom: "15px",
  textTransform: "uppercase",
};

const list = {
  paddingLeft: "20px",
  color: "#cbd5e1",
  lineHeight: "1.8",
  fontSize: "0.95rem",
};

const btnPrimary = {
  width: "100%",
  padding: "18px",
  background: "#800000",
  color: "#ffffff",
  border: "none",
  borderRadius: "12px",
  fontSize: "1rem",
  fontWeight: "800",
  letterSpacing: "1px",
  cursor: "pointer",
  boxShadow: "0 0 25px rgba(128, 0, 0, 0.4)",
};

const btnDisabled = {
  width: "100%",
  padding: "18px",
  background: "#1a1a1a",
  color: "#555",
  border: "none",
  borderRadius: "12px",
  fontSize: "1rem",
  fontWeight: "800",
  letterSpacing: "1px",
  cursor: "not-allowed",
};