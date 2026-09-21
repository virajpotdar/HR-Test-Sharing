import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import { submitAdminRequest } from "../services/apiService";

export default function AdminLogin({ onSuccess, onCancel }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  // Request Access modal inside AdminLogin
  const [showReqModal, setShowReqModal] = useState(false);
  const [reqName, setReqName] = useState("");
  const [reqEmail, setReqEmail] = useState("");
  const [reqOrg, setReqOrg] = useState("");
  const [reqReason, setReqReason] = useState("");
  const [reqSubmitting, setReqSubmitting] = useState(false);
  const [reqMessage, setReqMessage] = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      onSuccess();
    } catch {
      setError("Authorization Failed: Invalid Credentials");
    }
  }

  async function handleRequestSubmit(e) {
    e.preventDefault();
    setReqSubmitting(true);
    setReqMessage("");
    const res = await submitAdminRequest({
      full_name: reqName,
      email: reqEmail,
      organization: reqOrg,
      reason: reqReason
    });
    setReqSubmitting(false);
    if (res.success) {
      setReqMessage("✅ Admin request submitted successfully! An existing admin will review it.");
      setReqName(""); setReqEmail(""); setReqOrg(""); setReqReason("");
    } else {
      setReqMessage("❌ " + (res.error || "Failed to submit request."));
    }
  }

  return (
    <div style={page}>
      <div className="glass" style={card}>
        <div style={header}>
          <h2 style={title}>Admin Login</h2>
          <div style={badge}>CONTROL PANEL</div>
        </div>

        <form onSubmit={handleLogin}>
          <div style={group}>
            <label style={label}>ADMIN EMAIL</label>
            <input
              style={input}
              type="email"
              placeholder="admin@testportal.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div style={group}>
            <label style={label}>PASSCODE</label>
            <input
              style={input}
              type="password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <div style={errBox}>{error}</div>}

          <button style={btnPrimary}>AUTHENTICATE</button>

          <div style={linkRow}>
            <button type="button" style={btnLink} onClick={() => setShowReqModal(true)}>
              Don't have access? Request Access
            </button>
          </div>

          <button type="button" style={btnGhost} onClick={onCancel}>
            RETURN TO PORTAL
          </button>
        </form>
      </div>

      {/* REQUEST MODAL */}
      {showReqModal && (
        <div style={modalOverlay} onClick={() => setShowReqModal(false)}>
          <div style={modalContent} onClick={e => e.stopPropagation()}>
            <div style={modalHeader}>
              <h3 style={{ margin: 0, color: "#1e293b" }}>Request Admin Access</h3>
              <button style={btnClose} onClick={() => setShowReqModal(false)}>&times;</button>
            </div>

            <form onSubmit={handleRequestSubmit}>
              <div style={group}>
                <label style={label}>FULL NAME *</label>
                <input style={input} placeholder="e.g. Prof. Rajesh Patil" value={reqName} onChange={e => setReqName(e.target.value)} required />
              </div>
              <div style={group}>
                <label style={label}>EMAIL ADDRESS *</label>
                <input type="email" style={input} placeholder="hod.cs@college.edu.in" value={reqEmail} onChange={e => setReqEmail(e.target.value)} required />
              </div>
              <div style={group}>
                <label style={label}>ORGANIZATION / COMPANY</label>
                <input style={input} placeholder="e.g. XYZ Engineering College" value={reqOrg} onChange={e => setReqOrg(e.target.value)} />
              </div>
              <div style={group}>
                <label style={label}>REASON FOR REQUEST *</label>
                <textarea style={textArea} placeholder="Explain why you need test administration access..." value={reqReason} onChange={e => setReqReason(e.target.value)} required />
              </div>

              {reqMessage && <div style={{ fontSize: "0.85rem", marginBottom: "15px", color: reqMessage.startsWith("✅") ? "#800000" : "#ef4444" }}>{reqMessage}</div>}

              <button type="submit" style={reqSubmitting ? btnDisabled : btnPrimary} disabled={reqSubmitting}>
                {reqSubmitting ? "SUBMITTING..." : "SUBMIT ACCESS REQUEST"}
              </button>
              
              <div style={{ marginTop: "20px", textAlign: "center", fontSize: "0.8rem", color: "#64748b", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "15px" }}>
                <strong>Contact for Support:</strong><br />
                Email: <a href="mailto:virajpotdar4@gmail.com" style={{color: "#800000", textDecoration: "none"}}>virajpotdar4@gmail.com</a><br />
                Phone: <a href="tel:9764482435" style={{color: "#800000", textDecoration: "none"}}>9764482435</a>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* --- STYLES --- */
const page = { minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center", padding: "20px" };
const card = { width: "420px", padding: "40px", borderRadius: "20px", borderTop: "1px solid rgba(128, 0, 0, 0.4)" };
const header = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" };
const title = { fontSize: "1.5rem", color: "#1e293b", margin: "0" };
const badge = { background: "#800000", color: "#1e293b", fontSize: "0.7rem", fontWeight: "800", padding: "4px 8px", borderRadius: "4px" };
const group = { marginBottom: "20px" };
const label = { display: "block", fontSize: "0.7rem", color: "#64748b", marginBottom: "8px", letterSpacing: "1px", fontWeight: "bold" };
const input = { width: "100%", padding: "14px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "8px", color: "#1e293b", outline: "none" };
const textArea = { ...input, height: "80px", resize: "vertical" };
const errBox = { color: "#ef4444", fontSize: "0.85rem", marginBottom: "20px", textAlign: "center" };
const btnPrimary = { width: "100%", padding: "14px", background: "#800000", color: "#1e293b", border: "none", borderRadius: "8px", fontSize: "0.9rem", fontWeight: "800", cursor: "pointer", marginBottom: "10px" };
const btnDisabled = { ...btnPrimary, background: "#1a1a1a", color: "#555", cursor: "not-allowed" };
const btnGhost = { width: "100%", padding: "14px", background: "transparent", color: "#64748b", border: "none", cursor: "pointer", fontSize: "0.8rem" };
const linkRow = { textAlign: "center", marginBottom: "15px" };
const btnLink = { background: "transparent", border: "none", color: "#800000", fontSize: "0.85rem", cursor: "pointer", textDecoration: "underline" };

const modalOverlay = { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0, 0, 0, 0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, backdropFilter: "blur(5px)" };
const modalContent = { background: "#ffffff", padding: "30px", borderRadius: "20px", width: "450px", maxWidth: "90%", border: "1px solid rgba(255,255,255,0.1)" };
const modalHeader = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" };
const btnClose = { background: "transparent", border: "none", color: "#1e293b", fontSize: "1.5rem", cursor: "pointer" };