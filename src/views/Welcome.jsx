import { useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { submitAdminRequest } from "../services/apiService";

export default function Welcome({ setView, setStudent }) {
  const [loading, setLoading] = useState(false);

  // Admin Access Request Modal State
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [reqName, setReqName] = useState("");
  const [reqEmail, setReqEmail] = useState("");
  const [reqOrg, setReqOrg] = useState("");
  const [reqReason, setReqReason] = useState("");
  const [reqSubmitting, setReqSubmitting] = useState(false);
  const [reqSuccess, setReqSuccess] = useState("");
  const [reqError, setReqError] = useState("");

  const handleStudentEnter = async () => {
    const scholar = document.getElementById("scholar").value.trim();
    const name = document.getElementById("name").value.trim();
    const examId = "common_test";

    if (!scholar || !name) {
      alert("⚠️ Identification Required: Please enter your Registration Number and Full Name.");
      return;
    }

    setLoading(true);

    try {
      // Construct unique Session ID
      const sessionId = `${scholar}_${examId}`;
      const sessionRef = doc(db, "exam_sessions", sessionId);
      const sessionSnap = await getDoc(sessionRef);
      if (sessionSnap.exists()) {
        const data = sessionSnap.data();
        if (data.status === "Submitted" || data.submitted === true) {
          alert(`⛔ ACCESS DENIED\n\nRegistration Number ${scholar} has already submitted this examination.\n\nMultiple attempts are strictly prohibited.`);
          setLoading(false);
          return;
        }
      }

      setStudent({ scholar, name });
      setView("INSTRUCTIONS");

    } catch (error) {
      console.error("Auth Error:", error);
      alert("Connection Error. Please check your internet connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleAdminRequestSubmit = async (e) => {
    e.preventDefault();
    setReqError("");
    setReqSuccess("");
    setReqSubmitting(true);

    try {
      const res = await submitAdminRequest({
        full_name: reqName,
        email: reqEmail,
        organization: reqOrg,
        reason: reqReason,
      });

      if (res.success) {
        setReqSuccess("✅ Request submitted! An administrator will review your access request shortly.");
        setReqName("");
        setReqEmail("");
        setReqOrg("");
        setReqReason("");
      } else {
        setReqError(res.error || "Failed to submit request.");
      }
    } catch (err) {
      setReqError("Error submitting request. Please try again.");
    } finally {
      setReqSubmitting(false);
    }
  };

  return (
    <div style={page}>
      <div style={container}>
        {/* HERO SECTION */}
        <div style={hero}>
          <div style={glowEffect}></div>
          <h1 style={title}>
            Common <span style={accentText}>Assessment Portal</span>
          </h1>
          <div style={subtitle}>
            <span style={pill}>ONLINE TEST & EVALUATION PLATFORM</span>
          </div>
        </div>

        {/* CENTERED LAYOUT */}
        <div style={centerWrapper}>

          {/* STUDENT LOGIN CARD */}
          <div className="glass" style={cardMain}>
            <div style={cardHeader}>
              <h2 style={cardTitle}>Take Examination</h2>
              <div style={activeDot}></div>
            </div>

            <p style={label}>Enter your registration details below to start your test.</p>

            <div style={inputGroup}>
              <input
                id="scholar"
                style={input}
                placeholder="Registration Number / PRN"
                autoComplete="off"
              />
            </div>
            <div style={inputGroup}>
              <input
                id="name"
                style={input}
                placeholder="Full Name"
                autoComplete="off"
              />
            </div>

            <button
              style={loading ? btnDisabled : btnPrimary}
              onClick={handleStudentEnter}
              disabled={loading}
            >
              {loading ? "VERIFYING RECORDS..." : "Start Examination"}
            </button>
          </div>

          {/* ADMIN & REQUEST LINKS */}
          <div style={adminFooter}>
            <button style={btnLink} onClick={() => setView("ADMIN_LOGIN")}>
              Admin Login
            </button>
            <span style={{ color: "#475569", margin: "0 10px" }}>|</span>
            <button style={btnLinkHighlight} onClick={() => setShowRequestModal(true)}>
              Request Admin Access
            </button>
          </div>

        </div>
      </div>

      {/* REQUEST ADMIN ACCESS MODAL */}
      {showRequestModal && (
        <div style={modalOverlay} onClick={() => setShowRequestModal(false)}>
          <div style={modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeader}>
              <h3 style={{ margin: 0, color: "#1e293b" }}>Request Admin Access</h3>
              <button style={btnClose} onClick={() => setShowRequestModal(false)}>&times;</button>
            </div>

            <p style={{ color: "#94a3b8", fontSize: "0.9rem", marginBottom: "20px" }}>
              Submit your details to request administrative permissions to create tests, manage questions, and view candidate results.
            </p>

            <form onSubmit={handleAdminRequestSubmit}>
              <div style={inputGroup}>
                <label style={modalLabel}>FULL NAME *</label>
                <input
                  style={input}
                  placeholder="e.g. Prof. Rajesh Patil"
                  value={reqName}
                  onChange={(e) => setReqName(e.target.value)}
                  required
                />
              </div>

              <div style={inputGroup}>
                <label style={modalLabel}>EMAIL ADDRESS *</label>
                <input
                  type="email"
                  style={input}
                  placeholder="hod.cs@college.edu.in"
                  value={reqEmail}
                  onChange={(e) => setReqEmail(e.target.value)}
                  required
                />
              </div>

              <div style={inputGroup}>
                <label style={modalLabel}>ORGANIZATION / INSTITUTION</label>
                <input
                  style={input}
                  placeholder="e.g. XYZ Engineering College"
                  value={reqOrg}
                  onChange={(e) => setReqOrg(e.target.value)}
                />
              </div>

              <div style={inputGroup}>
                <label style={modalLabel}>PURPOSE / REASON FOR ACCESS *</label>
                <textarea
                  style={textArea}
                  placeholder="Describe your role and why you require admin access..."
                  value={reqReason}
                  onChange={(e) => setReqReason(e.target.value)}
                  required
                />
              </div>

              {reqSuccess && <div style={msgSuccess}>{reqSuccess}</div>}
              {reqError && <div style={msgError}>{reqError}</div>}

              <button type="submit" style={reqSubmitting ? btnDisabled : btnPrimary} disabled={reqSubmitting}>
                {reqSubmitting ? "SUBMITTING..." : "Submit Access Request"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* --- STYLES --- */
const page = { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", position: "relative", zIndex: 1 };
const container = { width: "100%", maxWidth: "1100px" };
const hero = { textAlign: "center", marginBottom: "50px", position: "relative" };
const glowEffect = { position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "400px", height: "150px", background: "rgba(128, 0, 0, 0.15)", filter: "blur(80px)", borderRadius: "50%", zIndex: -1 };
const title = { fontSize: "3.5rem", fontWeight: "900", letterSpacing: "-2px", color: "#1e293b", margin: "0", lineHeight: "1.1" };
const accentText = { color: "#800000" };
const subtitle = { marginTop: "20px", display: "flex", justifyContent: "center", alignItems: "center", gap: "15px", fontFamily: "'Fira Code', monospace" };
const pill = { fontSize: "0.9rem", color: "#94a3b8", letterSpacing: "2px" };
const centerWrapper = { display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" };
const cardMain = { padding: "40px", borderRadius: "24px", borderTop: "1px solid rgba(128, 0, 0, 0.3)", width: "100%", maxWidth: "500px" };
const cardHeader = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "25px" };
const cardTitle = { fontSize: "1.8rem", fontWeight: "700", color: "#1e293b", margin: "0" };
const activeDot = { width: "10px", height: "10px", backgroundColor: "#800000", borderRadius: "50%", boxShadow: "0 0 15px #800000" };
const label = { color: "#94a3b8", marginBottom: "25px", fontSize: "0.95rem", lineHeight: "1.5" };
const inputGroup = { marginBottom: "20px" };
const input = { width: "100%", padding: "16px 20px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "12px", color: "#1e293b", fontSize: "1rem", outline: "none", transition: "border-color 0.3s" };
const textArea = { ...input, height: "90px", resize: "vertical" };
const btnPrimary = { width: "100%", padding: "18px", marginTop: "10px", background: "linear-gradient(135deg, #800000 0%, #5a0000 100%)", color: "#ffffff", border: "none", borderRadius: "12px", fontSize: "1rem", fontWeight: "800", letterSpacing: "1px", cursor: "pointer", boxShadow: "0 10px 30px rgba(128, 0, 0, 0.2)" };
const btnDisabled = { ...btnPrimary, background: "#1a1a1a", color: "#555", cursor: "not-allowed", boxShadow: "none" };
const adminFooter = { marginTop: "15px", display: "flex", alignItems: "center" };
const btnLink = { background: "transparent", border: "none", color: "#94a3b8", fontSize: "0.85rem", cursor: "pointer", textDecoration: "underline" };
const btnLinkHighlight = { ...btnLink, color: "#800000", fontWeight: "bold" };

const modalOverlay = { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0, 0, 0, 0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, backdropFilter: "blur(5px)" };
const modalContent = { background: "#ffffff", padding: "30px", borderRadius: "20px", width: "500px", maxWidth: "90%", border: "1px solid rgba(255,255,255,0.1)" };
const modalHeader = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" };
const modalLabel = { display: "block", fontSize: "0.75rem", color: "#64748b", marginBottom: "6px", fontWeight: "bold", letterSpacing: "1px" };
const btnClose = { background: "transparent", border: "none", color: "#1e293b", fontSize: "1.5rem", cursor: "pointer" };
const msgSuccess = { background: "rgba(128, 0, 0, 0.15)", color: "#800000", padding: "12px", borderRadius: "8px", fontSize: "0.85rem", marginBottom: "15px", textAlign: "center" };
const msgError = { background: "rgba(239, 68, 68, 0.15)", color: "#ef4444", padding: "12px", borderRadius: "8px", fontSize: "0.85rem", marginBottom: "15px", textAlign: "center" };