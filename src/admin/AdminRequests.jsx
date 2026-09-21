import { useEffect, useState } from "react";
import { getAdminRequests, reviewAdminRequest } from "../services/apiService";

export default function AdminRequests({ onBack }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  async function fetchRequests() {
    setLoading(true);
    const data = await getAdminRequests();
    setRequests(data);
    setLoading(false);
  }

  useEffect(() => {
    fetchRequests();
  }, []);

  async function handleReview(id, status) {
    if (!window.confirm(`Are you sure you want to ${status.toUpperCase()} this request?`)) return;
    await reviewAdminRequest(id, status);
    fetchRequests();
  }

  const filteredRequests = requests.filter(r => {
    if (filter === "pending") return r.status === "pending";
    if (filter === "approved") return r.status === "approved";
    if (filter === "rejected") return r.status === "rejected";
    return true;
  });

  return (
    <div style={page}>
      <header style={header}>
        <div style={headerLeft}>
          <button onClick={onBack} style={btnBack}>&larr; DASHBOARD</button>
          <h2 style={title}>Admin Access Requests</h2>
        </div>

        <div style={filterGroup}>
          <button style={filter === "all" ? btnFilterActive : btnFilter} onClick={() => setFilter("all")}>All ({requests.length})</button>
          <button style={filter === "pending" ? btnFilterActive : btnFilter} onClick={() => setFilter("pending")}>Pending ({requests.filter(r => r.status === 'pending').length})</button>
          <button style={filter === "approved" ? btnFilterActive : btnFilter} onClick={() => setFilter("approved")}>Approved ({requests.filter(r => r.status === 'approved').length})</button>
        </div>
      </header>

      <div className="glass" style={card}>
        {loading ? (
          <div style={empty}>Loading requests...</div>
        ) : filteredRequests.length === 0 ? (
          <div style={empty}>No access requests found.</div>
        ) : (
          <div style={grid}>
            {filteredRequests.map((r) => (
              <div key={r.id} style={itemCard}>
                <div style={itemHeader}>
                  <div>
                    <h3 style={itemTitle}>{r.full_name}</h3>
                    <p style={itemEmail}>{r.email}</p>
                  </div>
                  <span style={r.status === 'approved' ? badgeApproved : r.status === 'rejected' ? badgeRejected : badgePending}>
                    {r.status ? r.status.toUpperCase() : "PENDING"}
                  </span>
                </div>

                {r.organization && (
                  <p style={itemOrg}><strong>Organization / Inst:</strong> {r.organization}</p>
                )}

                <p style={itemReason}><strong>Reason / Role:</strong> {r.reason}</p>

                <p style={itemMeta}>Requested: {new Date(r.created_at).toLocaleString()}</p>

                {r.status === "pending" && (
                  <div style={actionRow}>
                    <button style={btnApprove} onClick={() => handleReview(r.id, "approved")}>Approve Access</button>
                    <button style={btnReject} onClick={() => handleReview(r.id, "rejected")}>Reject</button>
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
const header = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" };
const headerLeft = { display: "flex", alignItems: "center", gap: "20px" };
const title = { fontSize: "1.8rem", color: "#1e293b", margin: 0 };
const btnBack = { background: "rgba(255,255,255,0.1)", border: "none", color: "#1e293b", padding: "10px 18px", borderRadius: "8px", cursor: "pointer" };

const filterGroup = { display: "flex", gap: "10px" };
const btnFilter = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", padding: "8px 16px", borderRadius: "8px", cursor: "pointer" };
const btnFilterActive = { ...btnFilter, background: "#800000", color: "#ffffff", fontWeight: "bold", border: "none" };

const card = { maxWidth: "1000px", margin: "0 auto", padding: "30px", borderRadius: "20px" };
const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))", gap: "20px" };

const itemCard = { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", padding: "20px", borderRadius: "12px" };
const itemHeader = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" };
const itemTitle = { fontSize: "1.2rem", margin: "0 0 4px 0", color: "#1e293b" };
const itemEmail = { fontSize: "0.85rem", color: "#800000", margin: 0, fontFamily: "monospace" };

const itemOrg = { fontSize: "0.85rem", color: "#cbd5e1", margin: "8px 0" };
const itemReason = { fontSize: "0.9rem", color: "#94a3b8", margin: "8px 0", lineHeight: "1.4" };
const itemMeta = { fontSize: "0.75rem", color: "#64748b", marginTop: "12px" };

const badgePending = { background: "rgba(245, 158, 11, 0.2)", color: "#f59e0b", padding: "4px 10px", borderRadius: "6px", fontSize: "0.7rem", fontWeight: "bold" };
const badgeApproved = { background: "rgba(128, 0, 0, 0.2)", color: "#800000", padding: "4px 10px", borderRadius: "6px", fontSize: "0.7rem", fontWeight: "bold" };
const badgeRejected = { background: "rgba(239, 68, 68, 0.2)", color: "#ef4444", padding: "4px 10px", borderRadius: "6px", fontSize: "0.7rem", fontWeight: "bold" };

const actionRow = { display: "flex", gap: "12px", marginTop: "16px" };
const btnApprove = { flex: 1, padding: "10px", background: "#800000", color: "#ffffff", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" };
const btnReject = { flex: 1, padding: "10px", background: "rgba(239,68,68,0.2)", color: "#ef4444", border: "1px solid #ef4444", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" };

const empty = { textAlign: "center", padding: "40px", color: "#64748b", fontStyle: "italic" };
