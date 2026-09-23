import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, updateDoc, doc, writeBatch, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { evaluateSession } from "./evaluate";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function AdminResults({ onBack }) {
  const [sessions, setSessions] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [viewingEvidence, setViewingEvidence] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: 'score', direction: 'desc' });

  useEffect(() => {
    setIsLoading(true);
    
    // 1. Fetch questions once (they don't change often)
    async function fetchQuestions() {
      const q = query(collection(db, "exam_questions"), where("examId", "==", "common_test"));
      const qSnap = await getDocs(q);
      setQuestions(qSnap.docs.map(d => d.data()));
    }
    fetchQuestions();

    // 2. Real-time listener for sessions
    const sessionsRef = collection(db, "exam_sessions");
    const unsubscribe = onSnapshot(sessionsRef, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setSessions(data);
      setIsLoading(false);
    }, (error) => {
      console.error("Snapshot Error:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredSessions = useMemo(() => {
    let data = [...sessions];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      data = data.filter(s => 
        (s.name && s.name.toLowerCase().includes(q)) || 
        (s.scholar && s.scholar.toLowerCase().includes(q))
      );
    }
    if (sortConfig.key) {
      data.sort((a, b) => {
        let valA = a[sortConfig.key] ?? (sortConfig.key === 'score' ? -1 : "");
        let valB = b[sortConfig.key] ?? (sortConfig.key === 'score' ? -1 : "");
        if (typeof valA === "string") valA = valA.toLowerCase();
        if (typeof valB === "string") valB = valB.toLowerCase();
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return data;
  }, [sessions, searchQuery, sortConfig]);

  const handleSort = (key) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const handleSelectAll = (e) => {
    setSelectedIds(e.target.checked ? new Set(filteredSessions.map(s => s.id)) : new Set());
  };

  const handleSelectOne = (id) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
    setSelectedIds(newSet);
  };

  async function evaluateAll() {
    if (!window.confirm(`Re-evaluate scores for all ${sessions.length} sessions? This will update scores in the database using the latest answer key.`)) return;
    setIsLoading(true);
    let count = 0;
    try {
      for (const s of sessions) {
        const score = evaluateSession(s, questions);
        if (s.score !== score) {
          await updateDoc(doc(db, "exam_sessions", s.id), { score });
          count++;
        }
      }
      alert(`Re-evaluation complete! ${count} candidate scores were updated.`);
    } catch (err) {
      console.error(err);
      alert("Evaluation failed. Check console for details.");
    }
    setIsLoading(false);
  }

  async function deleteSelected() {
    if (!window.confirm(`Delete ${selectedIds.size} records?`)) return;
    setIsLoading(true);
    const batch = writeBatch(db);
    selectedIds.forEach(id => batch.delete(doc(db, "exam_sessions", id)));
    await batch.commit();
    setSelectedIds(new Set());
    setIsLoading(false);
  }

  // --- PROFESSIONAL DARK PDF EXPORT ---
  const exportPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // 1. SET DARK BACKGROUND
    doc.setFillColor(15, 17, 26);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    // 2. HEADER SECTION
    doc.setDrawColor(34, 197, 94);
    doc.setLineWidth(1);
    doc.line(14, 15, 14, 45);

    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.text("ASSESSMENT PORTAL", 20, 25);
    
    doc.setFontSize(12);
    doc.setTextColor(34, 197, 94);
    doc.text("Candidate Exam Results & Performance Report", 20, 33);
    
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text("Aptitude Round 1 | Secure Assessment Report", 20, 40);

    const startY = 55;

    // 4. DATA TABLE
    const tableData = filteredSessions.map(s => [
      s.scholar || "N/A",
      s.name || "N/A",
      s.violations || 0,
      s.score !== undefined ? s.score : "--"
    ]);

    autoTable(doc, {
      head: [['Registration Number', 'Name', 'Violations', 'Final Score']],
      body: tableData,
      startY: startY,
      theme: 'grid',
      styles: {
        fillColor: [15, 17, 26],
        textColor: [241, 245, 249],
        fontSize: 9,
        lineColor: [30, 41, 59],
        lineWidth: 0.1,
        font: "helvetica",
      },
      headStyles: {
        fillColor: [34, 197, 94],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        fontSize: 10,
        halign: 'center'
      },
      alternateRowStyles: {
        fillColor: [30, 41, 59]
      },
      columnStyles: {
        0: { halign: 'left', fontStyle: 'bold' },
        2: { halign: 'center' },
        3: { halign: 'center', fontStyle: 'bold' }
      },
      didParseCell: function(data) {
        // Highlight Score Column in Neon Green
        if (data.column.index === 3 && data.section === 'body') {
          data.cell.styles.textColor = [34, 197, 94];
        }
        // Highlight High Violations in Red
        if (data.column.index === 2 && data.section === 'body') {
          const val = parseInt(data.cell.raw);
          if (val > 3) data.cell.styles.textColor = [239, 68, 68];
        }
      }
    });

    // 5. FOOTER
    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated by HCC System • ${new Date().toLocaleString()}`, 14, Math.min(pageHeight - 10, finalY));
    doc.text("CONFIDENTIAL REPORT - PLACEX RECRUITMENT", pageWidth - 14, Math.min(pageHeight - 10, finalY), { align: 'right' });

    doc.save(`PlaceX_Results_${new Date().toLocaleDateString()}.pdf`);
  };

  return (
    <div style={page}>
      <header style={header}>
         <div style={headerLeft}>
            <button onClick={onBack} style={btnBack}>&larr; DASHBOARD</button>
            <h2 style={title}>Results & Analytics</h2>
         </div>

         <div style={headerRight}>
            <div style={searchWrapper}>
              <span style={searchIcon}>🔍</span>
              <input 
                style={searchInput}
                placeholder="Search Scholar ID or Name..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            <div style={actions}>
               <button onClick={exportPDF} style={btnExport}>PDF</button>
               
               {selectedIds.size > 0 && (
                 <button onClick={deleteSelected} style={btnDanger}>
                   DELETE ({selectedIds.size})
                 </button>
               )}
               
               <button onClick={evaluateAll} style={btnAction} disabled={isLoading}>
                 {isLoading ? "CALCULATING..." : "RE-EVALUATE"}
               </button>
            </div>
         </div>
      </header>

      <div className="glass" style={tableContainer}>
         <table style={table}>
            <thead>
               <tr style={tHeadRow}>
                  <th style={thCenter}>
                    <input 
                      type="checkbox" 
                      onChange={handleSelectAll}
                      checked={filteredSessions.length > 0 && selectedIds.size === filteredSessions.length}
                      style={checkbox}
                    />
                  </th>
                  <th style={thClickable} onClick={() => handleSort('scholar')}>
                    SCHOLAR ID {sortConfig.key==='scholar' && (sortConfig.direction==='asc'?'↑':'↓')}
                  </th>
                  <th style={thClickable} onClick={() => handleSort('name')}>
                    CANDIDATE {sortConfig.key==='name' && (sortConfig.direction==='asc'?'↑':'↓')}
                  </th>
                  <th style={th}>STATUS</th>
                  <th style={thClickableCenter} onClick={() => handleSort('violations')}>
                    FLAGS {sortConfig.key==='violations' && (sortConfig.direction==='asc'?'↑':'↓')}
                  </th>
                  <th style={thClickableRight} onClick={() => handleSort('score')}>
                    SCORE {sortConfig.key==='score' && (sortConfig.direction==='asc'?'↑':'↓')}
                  </th>
               </tr>
            </thead>
            <tbody>
               {filteredSessions.map((s) => {
                  const isSubmitted = s.submitted || s.status === "Submitted";
                  return (
      <tr key={s.id} style={selectedIds.has(s.id) ? tRowSelected : tRow}>
         <td style={tdCenter}>
           <input 
             type="checkbox" 
             checked={selectedIds.has(s.id)}
             onChange={() => handleSelectOne(s.id)}
             style={checkbox}
           />
         </td>
         <td style={tdMono}>{s.scholar}</td>
         <td style={tdName}>{s.name}</td>
         <td style={td}>
            {isSubmitted ? <span style={badgeSuccess}>SUBMITTED</span> : <span style={badgeActive}>ACTIVE</span>}
         </td>
                     <td style={tdCenter}>
                        {s.violations > 0 ? (
                           <div style={badgeDangerWrapper}>
                             <span style={badgeDanger}>{s.violations}</span>
                             <button onClick={() => setViewingEvidence(s.violationImages)} style={btnEye} title="View Evidence">👁</button>
                           </div>
                        ) : <span style={badgeNeutral}>CLEAN</span>}
                     </td>
                     <td style={tdScore}>
                        {s.score !== undefined ? s.score : "--"}
                     </td>
                  </tr>
                  );
               })}
               {filteredSessions.length === 0 && (
                 <tr><td colSpan="6" style={noData}>No records found matching criteria.</td></tr>
               )}
            </tbody>
         </table>
      </div>

      {viewingEvidence && (
        <div style={modalOverlay} onClick={() => setViewingEvidence(null)}>
          <div style={modalContent} onClick={e => e.stopPropagation()}>
            <div style={modalHeader}>
              <h3>Violation Evidence</h3>
              <button onClick={() => setViewingEvidence(null)} style={btnClose}>&times;</button>
            </div>
            <div style={grid}>
              {viewingEvidence?.map((rec, i) => (
                <div key={i} style={imgWrapper}>
                  <img src={rec.img || rec} alt="Evidence" style={evidenceImg} />
                  <div style={imgMeta}>Snapshot {i+1} • {rec.time ? new Date(rec.time).toLocaleTimeString() : 'Unknown Time'}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* --- STYLES (OPEN CSS) --- */
const page = { 
  minHeight: "100vh", 
  padding: "30px 40px", 
  color: "#1e293b" 
};

const header = { 
  display: "flex", 
  justifyContent: "space-between", 
  marginBottom: "25px", 
  alignItems: "center", 
  flexWrap: "wrap", 
  gap: "20px" 
};

const headerLeft = { 
  display: "flex", 
  alignItems: "center", 
  gap: "15px" 
};

const headerRight = { 
  display: "flex", 
  alignItems: "center", 
  gap: "20px" 
};

const title = { 
  fontSize: "1.2rem", 
  fontWeight: "700", 
  letterSpacing: "0.5px", 
  margin: 0 
};

const btnBack = { 
  background: "rgba(255,255,255,0.1)", 
  border: "none", 
  color: "#1e293b", 
  padding: "8px 16px", 
  borderRadius: "6px", 
  cursor: "pointer", 
  fontSize: "0.8rem", 
  fontWeight: "600" 
};

const searchWrapper = { 
  position: "relative", 
  width: "300px" 
};

const searchIcon = { 
  position: "absolute", 
  left: "12px", 
  top: "50%", 
  transform: "translateY(-50%)", 
  fontSize: "0.9rem", 
  opacity: 0.5 
};

const searchInput = { 
  width: "100%", 
  padding: "10px 10px 10px 40px", 
  background: "rgba(0,0,0,0.3)", 
  border: "1px solid #cbd5e1", 
  borderRadius: "8px", 
  color: "#1e293b", 
  fontSize: "0.9rem", 
  outline: "none", 
  transition: "border 0.2s" 
};

const actions = { 
  display: "flex", 
  gap: "10px" 
};

const btnAction = { 
  background: "#800000", 
  color: "#ffffff", 
  border: "none", 
  padding: "10px 20px", 
  borderRadius: "8px", 
  fontWeight: "700", 
  cursor: "pointer", 
  fontSize: "0.85rem" 
};

const btnDanger = { 
  background: "#ef4444", 
  color: "#1e293b", 
  border: "none", 
  padding: "10px 20px", 
  borderRadius: "8px", 
  fontWeight: "700", 
  cursor: "pointer", 
  fontSize: "0.85rem" 
};

const btnExport = { 
  background: "#fff", 
  color: "#ffffff", 
  border: "none", 
  padding: "10px 20px", 
  borderRadius: "8px", 
  fontWeight: "700", 
  cursor: "pointer", 
  fontSize: "0.85rem" 
};

const tableContainer = { 
  borderRadius: "12px", 
  overflow: "hidden", 
  border: "1px solid rgba(255,255,255,0.08)", 
  background: "rgba(20, 20, 25, 0.6)", 
  boxShadow: "0 4px 20px rgba(0,0,0,0.2)" 
};

const table = { 
  width: "100%", 
  borderCollapse: "collapse", 
  color: "#1e293b" 
};

const tHeadRow = { 
  background: "rgba(255,255,255,0.03)", 
  borderBottom: "1px solid rgba(255,255,255,0.1)" 
};

const th = { 
  padding: "16px 20px", 
  textAlign: "left", 
  fontSize: "0.75rem", 
  color: "#94a3b8", 
  fontWeight: "700", 
  letterSpacing: "1px", 
  userSelect: "none" 
};

const thClickable = { 
  ...th, 
  cursor: "pointer", 
  transition: "color 0.2s" 
};

const thCenter = { 
  ...th, 
  textAlign: "center" 
};

const thClickableCenter = { 
  ...thClickable, 
  textAlign: "center" 
};

const thClickableRight = { 
  ...thClickable, 
  textAlign: "right" 
};

const tRow = { 
  borderBottom: "1px solid rgba(255,255,255,0.03)", 
  transition: "background 0.1s" 
};

const tRowSelected = { 
  background: "rgba(128, 0, 0, 0.08)", 
  borderBottom: "1px solid rgba(128, 0, 0, 0.1)" 
};

const td = { 
  padding: "16px 20px", 
  fontSize: "0.9rem", 
  color: "#cbd5e1" 
};

const tdMono = { 
  ...td, 
  fontFamily: "'Fira Code', monospace", 
  color: "#1e293b" 
};

const tdName = { 
  ...td, 
  fontWeight: "600", 
  color: "#1e293b" 
};

const tdCenter = { 
  ...td, 
  textAlign: "center" 
};

const tdScore = { 
  ...td, 
  textAlign: "right", 
  fontFamily: "'Fira Code', monospace", 
  fontWeight: "700", 
  fontSize: "1rem", 
  color: "#800000" 
};

const badgeSuccess = { 
  background: "rgba(128, 0, 0, 0.15)", 
  color: "#800000", 
  padding: "4px 8px", 
  borderRadius: "4px", 
  fontSize: "0.7rem", 
  fontWeight: "700" 
};

const badgeActive = { 
  background: "rgba(59, 130, 246, 0.15)", 
  color: "#3b82f6", 
  padding: "4px 8px", 
  borderRadius: "4px", 
  fontSize: "0.7rem", 
  fontWeight: "700" 
};

const badgeDangerWrapper = { 
  display: "inline-flex", 
  alignItems: "center", 
  gap: "8px", 
  background: "rgba(239, 68, 68, 0.15)", 
  padding: "4px 8px", 
  borderRadius: "4px" 
};

const badgeDanger = { 
  color: "#ef4444", 
  fontSize: "0.75rem", 
  fontWeight: "700" 
};

const badgeNeutral = { 
  color: "#64748b", 
  fontSize: "0.75rem", 
  fontWeight: "600" 
};

const btnEye = { 
  background: "transparent", 
  border: "none", 
  color: "#ef4444", 
  cursor: "pointer", 
  fontSize: "0.9rem", 
  padding: 0 
};

const checkbox = { 
  cursor: "pointer", 
  accentColor: "#800000", 
  width: "16px", 
  height: "16px" 
};

const noData = { 
  textAlign: "center", 
  padding: "40px", 
  color: "#64748b", 
  fontStyle: "italic" 
};

const modalOverlay = { 
  position: "fixed", 
  top: 0, 
  left: 0, 
  right: 0, 
  bottom: 0, 
  background: "rgba(0, 0, 0, 0.5)", 
  display: "flex", 
  justifyContent: "center", 
  alignItems: "center", 
  zIndex: 1000, 
  backdropFilter: "blur(5px)" 
};

const modalContent = { 
  background: "#ffffff", 
  padding: "30px", 
  borderRadius: "16px", 
  width: "800px", 
  maxWidth: "90%", 
  maxHeight: "85vh", 
  overflowY: "auto", 
  border: "1px solid rgba(255,255,255,0.1)" 
};

const modalHeader = { 
  display: "flex", 
  justifyContent: "space-between", 
  alignItems: "center", 
  marginBottom: "20px", 
  borderBottom: "1px solid rgba(255,255,255,0.1)", 
  paddingBottom: "15px" 
};

const btnClose = { 
  background: "transparent", 
  border: "none", 
  color: "#1e293b", 
  fontSize: "1.5rem", 
  cursor: "pointer" 
};

const grid = { 
  display: "grid", 
  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", 
  gap: "15px" 
};

const imgWrapper = { 
  background: "#000", 
  borderRadius: "8px", 
  overflow: "hidden", 
  border: "1px solid #333" 
};

const evidenceImg = { 
  width: "100%", 
  display: "block" 
};

const imgMeta = { 
  padding: "8px", 
  fontSize: "0.75rem", 
  color: "#94a3b8", 
  background: "#1e293b" 
};