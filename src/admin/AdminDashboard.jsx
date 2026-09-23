import { useEffect, useState } from "react";
import { getAdminRequests } from "../services/apiService";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:5000";

export default function AdminDashboard({ admin, onLogout, goQuestions, goResults, goRequests, goUsers }) {
  const [startTime, setStartTime] = useState("");
  const [duration, setDuration] = useState(60);
  const [status, setStatus] = useState("scheduled");
  const [saving, setSaving] = useState(false);
  const [totalStudents, setTotalStudents] = useState(0);
  const [activeStudents, setActiveStudents] = useState(0);
  const [activeDelayMinutes, setActiveDelayMinutes] = useState(5);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        // Load exam config from backend API
        const configRes = await fetch(`${BACKEND_URL}/api/exam/config`);
        const configData = await configRes.json();
        if (configData.config) {
          const c = configData.config;
          setDuration(c.duration_minutes || 60);
          setStatus(c.status || "scheduled");
          if (c.start_time) setStartTime(new Date(c.start_time).toISOString().slice(0, 16));
          if (c.active_delay_minutes !== undefined) setActiveDelayMinutes(c.active_delay_minutes);
        }
      } catch (err) {
        console.warn("Failed to load config:", err.message);
      }

      // Check pending admin requests count
      const reqs = await getAdminRequests();
      setPendingRequestsCount(reqs.filter(r => r.status === "pending").length);
    }
    load();

    // LIVE STUDENT COUNTER via polling
    async function pollSessions() {
      try {
        const res = await fetch(`${BACKEND_URL}/api/admin/results`);
        const data = await res.json();
        const sessions = data.sessions || [];
        setTotalStudents(sessions.length);
        setActiveStudents(sessions.filter(s => s.status !== "Submitted").length);
      } catch (err) {
        console.warn("Failed to poll sessions:", err.message);
      }
    }
    pollSessions();
    const interval = setInterval(pollSessions, 10000); // Poll every 10 seconds

    return () => clearInterval(interval);
  }, []);

  async function saveConfig() {
    if (!startTime) return alert("Start time required");
    setSaving(true);
    
    const configPayload = {
      exam_id: "common_test",
      start_time: new Date(startTime).toISOString(),
      duration_minutes: Number(duration),
      status,
    };

    if (status === "active") {
       configPayload.active_delay_minutes = Number(activeDelayMinutes);
       configPayload.active_start_time = new Date(Date.now() + Number(activeDelayMinutes) * 60000).toISOString();
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(configPayload)
      });
      const data = await res.json();
      if (data.success) {
        alert("Configuration Updated Successfully");
      } else {
        alert("Failed to update: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      alert("Failed to update configuration: " + err.message);
    }
    setSaving(false);
  }

  return (
    <div style={page}>
      <header style={header}>
        <h2 style={title}>Command Center</h2>
        <div style={headerRight}>
           <div style={statItem}>
             <span style={statVal}>{activeStudents}</span>
             <span style={statLab}>ACTIVE CANDIDATES</span>
           </div>
           <div style={statItem}>
             <span style={statVal}>{totalStudents}</span>
             <span style={statLab}>TOTAL JOINED</span>
           </div>
           <button style={btnExit} onClick={onLogout}>LOGOUT</button>
        </div>
      </header>

      <div className="glass" style={card}>
        <div style={sectionTitle}>EXAM CONFIGURATION</div>

        <div style={grid}>
          <div style={field}>
            <label style={label}>START TIMESTAMP</label>
            <input 
              type="datetime-local" 
              style={input} 
              value={startTime} 
              onChange={(e) => setStartTime(e.target.value)} 
            />
          </div>
          
          <div style={field}>
            <label style={label}>DURATION (MINUTES)</label>
            <input 
              type="number" 
              style={input} 
              value={duration} 
              onChange={(e) => setDuration(e.target.value)} 
            />
          </div>
          
          <div style={field}>
            <label style={label}>SYSTEM STATE</label>
            <select 
              style={input} 
              value={status} 
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="scheduled">SCHEDULED</option>
              <option value="active">ACTIVE (LIVE)</option>
              <option value="ended">TERMINATED</option>
            </select>
          </div>

          {status === "active" && (
            <div style={field}>
              <label style={label}>QUICK COUNTDOWN (MINS)</label>
              <input 
                type="number" 
                style={input} 
                value={activeDelayMinutes} 
                onChange={(e) => setActiveDelayMinutes(e.target.value)} 
              />
            </div>
          )}
        </div>

        <button style={btnSave} disabled={saving} onClick={saveConfig}>
          {saving ? "SAVING..." : "UPDATE CONFIGURATION"}
        </button>

        <div style={divider}></div>

        <div style={navGrid}>
           <button style={btnNav} onClick={goQuestions}>
              <span style={icon}>📂</span> QUESTION BANK
           </button>
           <button style={btnNav} onClick={goResults}>
              <span style={icon}>📊</span> RESULTS & ANALYTICS
           </button>
           <button style={{ ...btnNav, position: "relative" }} onClick={goRequests}>
              <span style={icon}>🔑</span> ACCESS REQUESTS
              {pendingRequestsCount > 0 && (
                <span style={requestBadge}>{pendingRequestsCount} PENDING</span>
              )}
           </button>
           <button style={btnNav} onClick={goUsers}>
              <span style={icon}>👥</span> USER MANAGEMENT
           </button>
        </div>
      </div>
    </div>
  );
}

/* --- STYLES --- */
const page = { minHeight: "100vh", padding: "40px" };
const header = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px" };
const headerRight = { display: "flex", alignItems: "center", gap: "30px" };
const statItem = { textAlign: "center" };
const statVal = { display: "block", fontSize: "1.5rem", fontWeight: "800", color: "#800000", lineHeight: "1" };
const statLab = { fontSize: "0.6rem", color: "#64748b", letterSpacing: "1px", fontWeight: "700" };
const title = { fontSize: "2rem", color: "#1e293b", letterSpacing: "-1px" };
const btnExit = { background: "rgba(255,255,255,0.1)", border: "none", color: "#1e293b", padding: "10px 20px", borderRadius: "8px", cursor: "pointer" };

const card = { maxWidth: "800px", margin: "0 auto", padding: "40px", borderRadius: "20px" };
const sectionTitle = { color: "#800000", fontSize: "0.8rem", letterSpacing: "2px", marginBottom: "30px" };

const grid = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "30px" };
const field = { marginBottom: "10px" };
const label = { display: "block", fontSize: "0.7rem", color: "#64748b", marginBottom: "8px", letterSpacing: "1px" };
const input = { width: "100%", padding: "12px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#1e293b" };

const btnSave = { width: "100%", padding: "16px", background: "#800000", color: "#ffffff", border: "none", borderRadius: "10px", fontWeight: "bold", cursor: "pointer" };
const divider = { height: "1px", background: "rgba(255,255,255,0.1)", margin: "30px 0" };

const navGrid = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" };
const btnNav = { padding: "20px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", color: "#1e293b", borderRadius: "12px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", fontSize: "0.9rem", fontWeight: "600" };
const icon = { fontSize: "1.2rem" };
const requestBadge = { position: "absolute", right: "15px", background: "#f59e0b", color: "#ffffff", padding: "4px 8px", borderRadius: "12px", fontSize: "0.7rem", fontWeight: "bold" };