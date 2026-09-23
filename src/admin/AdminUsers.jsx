import { useEffect, useState } from "react";
import { getAdminUsers, toggleUserAccess, resetUserPassword } from "../services/apiService";

export default function AdminUsers({ onBack }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [actionLoading, setActionLoading] = useState(null); // email of user being acted on

  async function fetchUsers() {
    setLoading(true);
    const data = await getAdminUsers();
    setUsers(data);
    setLoading(false);
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  async function handleToggleAccess(email, action) {
    const actionText = action === "suspend" ? "SUSPEND" : "REACTIVATE";
    if (!window.confirm(`Are you sure you want to ${actionText} access for ${email}?`)) return;

    setActionLoading(email);
    const result = await toggleUserAccess(email, action);
    setActionLoading(null);

    if (result.success) {
      fetchUsers();
    } else {
      alert("Failed: " + (result.error || "Unknown error"));
    }
  }

  async function handleResetPassword(email, name) {
    if (!window.confirm(`Reset password for ${name} (${email})?\n\nA new temporary password will be generated and sent to their email.`)) return;

    setActionLoading(email);
    const result = await resetUserPassword(email);
    setActionLoading(null);

    if (result.success) {
      alert(result.message);
      fetchUsers();
    } else {
      alert("Failed: " + (result.error || "Unknown error"));
    }
  }

  const filteredUsers = users.filter(u => {
    if (filter === "active") return u.status === "active";
    if (filter === "suspended") return u.status === "suspended";
    return true;
  });

  const activeCount = users.filter(u => u.status === "active").length;
  const suspendedCount = users.filter(u => u.status === "suspended").length;

  return (
    <div style={page}>
      <header style={header}>
        <div style={headerLeft}>
          <button onClick={onBack} style={btnBack}>&larr; DASHBOARD</button>
          <h2 style={title}>User Management</h2>
        </div>

        <div style={filterGroup}>
          <button style={filter === "all" ? btnFilterActive : btnFilter} onClick={() => setFilter("all")}>
            All ({users.length})
          </button>
          <button style={filter === "active" ? btnFilterActive : btnFilter} onClick={() => setFilter("active")}>
            Active ({activeCount})
          </button>
          <button style={filter === "suspended" ? btnFilterActive : btnFilter} onClick={() => setFilter("suspended")}>
            Suspended ({suspendedCount})
          </button>
        </div>
      </header>

      <div className="glass" style={card}>
        {loading ? (
          <div style={empty}>Loading users...</div>
        ) : filteredUsers.length === 0 ? (
          <div style={empty}>No users found.</div>
        ) : (
          <div style={grid}>
            {filteredUsers.map((u) => (
              <div key={u.id} style={itemCard}>
                <div style={itemHeader}>
                  <div>
                    <h3 style={itemTitle}>{u.full_name}</h3>
                    <p style={itemEmail}>{u.email}</p>
                  </div>
                  <span style={
                    u.status === "active" ? badgeActive :
                    u.status === "suspended" ? badgeSuspended :
                    badgePending
                  }>
                    {u.status ? u.status.toUpperCase() : "UNKNOWN"}
                  </span>
                </div>

                {u.organization && (
                  <p style={itemInfo}><strong>Organization:</strong> {u.organization}</p>
                )}

                <div style={metaRow}>
                  <p style={itemMeta}>
                    <strong>Role:</strong> {u.role === "super_admin" ? "Super Admin" : "Admin"}
                  </p>
                  <p style={itemMeta}>
                    <strong>Password:</strong> {u.must_change_password ? "⚠️ Temp (not changed)" : "✅ Set"}
                  </p>
                  {u.last_login && (
                    <p style={itemMeta}>
                      <strong>Last Login:</strong> {new Date(u.last_login).toLocaleString()}
                    </p>
                  )}
                  <p style={itemMeta}>
                    <strong>Created:</strong> {new Date(u.created_at).toLocaleString()}
                  </p>
                </div>

                {/* Don't show actions for super_admin */}
                {u.role !== "super_admin" && (
                  <div style={actionRow}>
                    {u.status === "active" ? (
                      <button
                        style={actionLoading === u.email ? btnActionDisabled : btnSuspend}
                        onClick={() => handleToggleAccess(u.email, "suspend")}
                        disabled={actionLoading === u.email}
                      >
                        {actionLoading === u.email ? "..." : "🔒 SUSPEND ACCESS"}
                      </button>
                    ) : (
                      <button
                        style={actionLoading === u.email ? btnActionDisabled : btnReactivate}
                        onClick={() => handleToggleAccess(u.email, "reactivate")}
                        disabled={actionLoading === u.email}
                      >
                        {actionLoading === u.email ? "..." : "✅ REACTIVATE"}
                      </button>
                    )}
                    <button
                      style={actionLoading === u.email ? btnActionDisabled : btnReset}
                      onClick={() => handleResetPassword(u.email, u.full_name)}
                      disabled={actionLoading === u.email}
                    >
                      🔑 RESET PASSWORD
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* --- STYLES --- */
const page = { minHeight: "100vh", padding: "40px", color: "#1e293b" };
const header = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px", flexWrap: "wrap", gap: "15px" };
const headerLeft = { display: "flex", alignItems: "center", gap: "20px" };
const title = { fontSize: "1.8rem", color: "#1e293b", margin: 0 };
const btnBack = { background: "rgba(255,255,255,0.1)", border: "none", color: "#1e293b", padding: "10px 18px", borderRadius: "8px", cursor: "pointer" };

const filterGroup = { display: "flex", gap: "10px" };
const btnFilter = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", padding: "8px 16px", borderRadius: "8px", cursor: "pointer" };
const btnFilterActive = { ...btnFilter, background: "#800000", color: "#ffffff", fontWeight: "bold", border: "none" };

const card = { maxWidth: "1100px", margin: "0 auto", padding: "30px", borderRadius: "20px" };
const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(450px, 1fr))", gap: "20px" };

const itemCard = { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", padding: "24px", borderRadius: "12px" };
const itemHeader = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" };
const itemTitle = { fontSize: "1.2rem", margin: "0 0 4px 0", color: "#1e293b" };
const itemEmail = { fontSize: "0.85rem", color: "#800000", margin: 0, fontFamily: "monospace" };
const itemInfo = { fontSize: "0.85rem", color: "#94a3b8", margin: "8px 0" };
const metaRow = { marginTop: "12px", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "12px" };
const itemMeta = { fontSize: "0.8rem", color: "#64748b", margin: "4px 0" };

const badgeActive = { background: "rgba(34, 197, 94, 0.15)", color: "#22c55e", padding: "4px 12px", borderRadius: "6px", fontSize: "0.7rem", fontWeight: "bold" };
const badgeSuspended = { background: "rgba(239, 68, 68, 0.15)", color: "#ef4444", padding: "4px 12px", borderRadius: "6px", fontSize: "0.7rem", fontWeight: "bold" };
const badgePending = { background: "rgba(245, 158, 11, 0.2)", color: "#f59e0b", padding: "4px 12px", borderRadius: "6px", fontSize: "0.7rem", fontWeight: "bold" };

const actionRow = { display: "flex", gap: "10px", marginTop: "16px", flexWrap: "wrap" };
const btnSuspend = { flex: 1, padding: "10px 14px", background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", fontSize: "0.8rem", minWidth: "140px" };
const btnReactivate = { flex: 1, padding: "10px 14px", background: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", fontSize: "0.8rem", minWidth: "140px" };
const btnReset = { flex: 1, padding: "10px 14px", background: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", fontSize: "0.8rem", minWidth: "140px" };
const btnActionDisabled = { flex: 1, padding: "10px 14px", background: "#eee", color: "#999", border: "1px solid #ddd", borderRadius: "8px", fontWeight: "bold", cursor: "not-allowed", fontSize: "0.8rem", minWidth: "140px" };

const empty = { textAlign: "center", padding: "40px", color: "#64748b", fontStyle: "italic" };
