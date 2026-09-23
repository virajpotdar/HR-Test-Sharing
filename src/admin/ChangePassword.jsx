import { useState } from "react";
import { changePassword } from "../services/apiService";

export default function ChangePassword({ admin, currentTempPassword, onSuccess, onCancel }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Password strength checks
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const passwordsMatch = newPassword === confirmPassword && newPassword.length > 0;
  const isStrong = hasMinLength && hasUppercase && hasLowercase && hasNumber;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!isStrong) {
      setError("Password does not meet all requirements.");
      return;
    }
    if (!passwordsMatch) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const result = await changePassword(admin.email, currentTempPassword, newPassword);
    setLoading(false);

    if (result.success) {
      onSuccess(admin);
    } else {
      setError(result.error || "Failed to change password.");
    }
  }

  return (
    <div style={page}>
      <div className="glass" style={card}>
        {/* Header */}
        <div style={iconCircle}>🔐</div>
        <h2 style={title}>Change Your Password</h2>
        <p style={subtitle}>
          Welcome, <strong>{admin.full_name}</strong>! You must set a new password before continuing.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={group}>
            <label style={label}>NEW PASSWORD</label>
            <input
              style={input}
              type="password"
              placeholder="Enter new password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>

          <div style={group}>
            <label style={label}>CONFIRM NEW PASSWORD</label>
            <input
              style={input}
              type="password"
              placeholder="Re-enter new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          {/* Password Strength Indicators */}
          <div style={strengthBox}>
            <p style={strengthTitle}>PASSWORD REQUIREMENTS</p>
            <div style={checkRow}>
              <span style={hasMinLength ? checkPass : checkFail}>{hasMinLength ? "✅" : "⬜"}</span>
              <span style={hasMinLength ? textPass : textFail}>At least 8 characters</span>
            </div>
            <div style={checkRow}>
              <span style={hasUppercase ? checkPass : checkFail}>{hasUppercase ? "✅" : "⬜"}</span>
              <span style={hasUppercase ? textPass : textFail}>One uppercase letter (A-Z)</span>
            </div>
            <div style={checkRow}>
              <span style={hasLowercase ? checkPass : checkFail}>{hasLowercase ? "✅" : "⬜"}</span>
              <span style={hasLowercase ? textPass : textFail}>One lowercase letter (a-z)</span>
            </div>
            <div style={checkRow}>
              <span style={hasNumber ? checkPass : checkFail}>{hasNumber ? "✅" : "⬜"}</span>
              <span style={hasNumber ? textPass : textFail}>One number (0-9)</span>
            </div>
            <div style={checkRow}>
              <span style={passwordsMatch ? checkPass : checkFail}>{passwordsMatch ? "✅" : "⬜"}</span>
              <span style={passwordsMatch ? textPass : textFail}>Passwords match</span>
            </div>
          </div>

          {error && <div style={errBox}>{error}</div>}

          <button
            type="submit"
            style={loading || !isStrong || !passwordsMatch ? btnDisabled : btnPrimary}
            disabled={loading || !isStrong || !passwordsMatch}
          >
            {loading ? "UPDATING PASSWORD..." : "SET NEW PASSWORD & CONTINUE"}
          </button>
        </form>

        <p style={helpText}>
          This is a one-time requirement. After setting your password, you'll use it for all future logins.
        </p>
      </div>
    </div>
  );
}

/* --- STYLES --- */
const page = { minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center", padding: "20px" };
const card = { width: "460px", padding: "40px", borderRadius: "20px", borderTop: "3px solid #800000", textAlign: "center" };

const iconCircle = { fontSize: "2.5rem", marginBottom: "10px" };
const title = { fontSize: "1.5rem", color: "#1e293b", margin: "0 0 8px 0" };
const subtitle = { fontSize: "0.9rem", color: "#64748b", margin: "0 0 30px 0" };

const group = { marginBottom: "20px", textAlign: "left" };
const label = { display: "block", fontSize: "0.7rem", color: "#64748b", marginBottom: "8px", letterSpacing: "1px", fontWeight: "bold" };
const input = { width: "100%", padding: "14px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "8px", color: "#1e293b", outline: "none", fontSize: "1rem" };

const strengthBox = { background: "rgba(0,0,0,0.02)", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "16px", marginBottom: "20px", textAlign: "left" };
const strengthTitle = { fontSize: "0.7rem", color: "#64748b", letterSpacing: "1px", fontWeight: "bold", margin: "0 0 12px 0" };
const checkRow = { display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" };
const checkPass = { fontSize: "0.85rem" };
const checkFail = { fontSize: "0.85rem", opacity: 0.5 };
const textPass = { fontSize: "0.85rem", color: "#22c55e" };
const textFail = { fontSize: "0.85rem", color: "#94a3b8" };

const errBox = { color: "#ef4444", fontSize: "0.85rem", marginBottom: "20px", textAlign: "center", background: "rgba(239,68,68,0.08)", padding: "10px", borderRadius: "8px", border: "1px solid rgba(239,68,68,0.2)" };
const btnPrimary = { width: "100%", padding: "16px", background: "#800000", color: "#ffffff", border: "none", borderRadius: "10px", fontSize: "0.9rem", fontWeight: "800", cursor: "pointer", letterSpacing: "0.5px" };
const btnDisabled = { ...btnPrimary, background: "#ccc", color: "#888", cursor: "not-allowed" };
const helpText = { fontSize: "0.8rem", color: "#94a3b8", marginTop: "20px" };
