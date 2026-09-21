import { useEffect, useState } from "react";
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { getAdminRequests } from "../services/apiService";

export default function AdminDashboard({ onLogout, goQuestions, goResults, goRequests }) {
  const [startTime, setStartTime] = useState("");
  const [duration, setDuration] = useState(60);
  const [status, setStatus] = useState("scheduled");
  const [saving, setSaving] = useState(false);
  const [totalStudents, setTotalStudents] = useState(0);
  const [activeStudents, setActiveStudents] = useState(0);
  const [activeDelayMinutes, setActiveDelayMinutes] = useState(5);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  const ref = doc(db, "exam-config", "current-exam");

  useEffect(() => {
    async function load() {
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const d = snap.data();
        setDuration(d.durationMinutes || 60);
        setStatus(d.status || "scheduled");
        if (d.startTime) setStartTime(d.startTime.toDate ? d.startTime.toDate().toISOString().slice(0, 16) : new Date(d.startTime).toISOString().slice(0, 16));
        if (d.activeDelayMinutes !== undefined) setActiveDelayMinutes(d.activeDelayMinutes);
      }

      // Check pending admin requests count
      const reqs = await getAdminRequests();
      setPendingRequestsCount(reqs.filter(r => r.status === "pending").length);
    }
    load();

    // LIVE STUDENT COUNTER
    const sessionsRef = collection(db, "exam_sessions");
    const q = query(sessionsRef, where("examId", "==", "common_test"));
    
    const unsubscribe = onSnapshot(sessionsRef, (snapshot) => {
      const docs = snapshot.docs;
      setTotalStudents(docs.length);
      setActiveStudents(docs.filter(d => !d.data().submitted).length);
    });

    return () => unsubscribe();
  }, []);

  async function saveConfig() {
    if (!startTime) return alert("Start time required");
    setSaving(true);
    
    const configData = {
      examId: "common_test",
      startTime: new Date(startTime),
      durationMinutes: Number(duration),
      status,
      updatedAt: serverTimestamp(),
    };

    if (status === "active") {
       configData.activeDelayMinutes = Number(activeDelayMinutes);
       configData.activeStartTime = new Date(Date.now() + Number(activeDelayMinutes) * 60000);
    }

    await setDoc(ref, configData, { merge: true });
    alert("Configuration Updated Successfully");
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
           <button style={{ ...btnNav, gridColumn: "span 2", position: "relative" }} onClick={goRequests}>
              <span style={icon}>🔑</span> ADMIN ACCESS REQUESTS
              {pendingRequestsCount > 0 && (
                <span style={requestBadge}>{pendingRequestsCount} PENDING</span>
              )}
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