import { useEffect, useState } from "react";
import { collection, addDoc, deleteDoc, doc, getDocs, query, where, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function AdminQuestions({ onBack }) {
  const examId = "common_test";
  const [questions, setQuestions] = useState([]);
  const [type, setType] = useState("mcq_single");
  const [saving, setSaving] = useState(false);

  const ANSWER_KEY = {};
  
  // Form State
  const [question, setQuestion] = useState("");
  const [questionImg, setQuestionImg] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correct, setCorrect] = useState([]);
  const [marks, setMarks] = useState(1);
  const [negative, setNegative] = useState(0);
  
  // --- IMAGE HANDLING ---
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (ev) => {
       const img = new Image();
       img.src = ev.target.result;
       img.onload = () => {
          const canvas = document.createElement("canvas");
          const scale = 500 / img.width;
          canvas.width = 500;
          canvas.height = img.height * scale;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          setQuestionImg(canvas.toDataURL("image/jpeg", 0.6));
       };
    };
  };

  // --- LOAD DATA (Fixed: Client-Side Sort) ---
  async function loadQuestions() {
    try {
      // Removed 'orderBy' from query to prevent "Missing Index" errors
      const q = query(collection(db, "exam_questions"), where("examId", "==", examId));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Sort manually by 'order' field
      data.sort((a, b) => (a.order || 0) - (b.order || 0));
      
      setQuestions(data);
    } catch (e) {
      console.error("Error loading questions:", e);
    }
  }
  
  useEffect(() => { loadQuestions(); }, []);

  // --- ADD QUESTION ---
  async function addQuestion() {
    if (saving) return;
    if (!question.trim() && !questionImg) return alert("Question Text or Image Required");
    if (correct.length === 0) return alert("Please select the correct answer(s)");
    
    setSaving(true);
    try {
       await addDoc(collection(db, "exam_questions"), {
          examId, 
          qid: `q${questions.length+1}`, 
          type, 
          question, 
          questionImg,
          options: type === "short" ? [] : options, 
          correct,
          marks: Number(marks), 
          negative: Number(negative), 
          order: questions.length + 1
       });
       
       // Reset Form
       setQuestion(""); setQuestionImg(""); setOptions(["","","",""]); setCorrect([]);
       loadQuestions();
    } catch (e) { 
      console.error(e);
      alert("Error saving question"); 
    }
    setSaving(false);
  }

  async function bulkSyncAnswers() {
    if (!window.confirm("Sync all correct answers?")) return;
    setSaving(true);
    try {
       const q = query(collection(db, "exam_questions"), where("examId", "==", examId));
       const snap = await getDocs(q);
       
       for (const d of snap.docs) {
          const qData = d.data();
          const targetAnswer = ANSWER_KEY[qData.qid];
          if (targetAnswer) {
             const ref = doc(db, "exam_questions", d.id);
             await updateDoc(ref, { correct: [targetAnswer] });
          }
       }
       alert("Sync Complete!");
       loadQuestions();
    } catch (e) {
       console.error(e);
       alert("Sync Failed");
    }
    setSaving(false);
  }

  function toggleCorrect(opt) {
     if (!opt) return;
     if (type === "mcq_single") setCorrect([opt]);
     else setCorrect(prev => prev.includes(opt) ? prev.filter(p=>p!==opt) : [...prev, opt]);
  }

  // --- PDF EXPORT ---
  const exportPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // 1. SET DARK BACKGROUND
    doc.setFillColor(15, 17, 26); 
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    // 2. HEADER
    doc.setDrawColor(34, 197, 94);
    doc.setLineWidth(1);
    doc.line(14, 15, 14, 45);

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.text("ASSESSMENT PORTAL", 20, 25);
    
    doc.setFontSize(12);
    doc.setTextColor(34, 197, 94);
    doc.text("Official Question Bank Repository", 20, 33);
    
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184);
    doc.text(`Total Questions: ${questions.length} | Exam ID: ${examId}`, 20, 40);

    // 3. TABLE
    const tableRows = questions.map(q => [
       q.qid,
       q.type.replace('_', ' ').toUpperCase(),
       q.question,
       q.marks,
       Array.isArray(q.correct) ? q.correct.join(", ") : q.correct
    ]);

    autoTable(doc, {
       head: [['ID', 'Type', 'Question Text', 'Marks', 'Correct Answer']],
       body: tableRows,
       startY: 55,
       theme: 'grid',
       styles: {
          fillColor: [15, 17, 26],
          textColor: [241, 245, 249],
          fontSize: 8,
          lineColor: [30, 41, 59],
       },
       headStyles: {
          fillColor: [34, 197, 94],
          textColor: [0, 0, 0],
          fontStyle: 'bold'
       },
       alternateRowStyles: {
          fillColor: [30, 41, 59]
       },
       columnStyles: {
          2: { cellWidth: 80 }
       }
    });

    doc.save(`PlaceX_Question_Bank_${examId}.pdf`);
  };

  return (
    <div style={page}>
      <header style={header}>
         <div style={headerLeft}>
            <button onClick={onBack} style={btnBack}>&larr; DASHBOARD</button>
            <h2 style={title}>Question Bank Manager</h2>
         </div>
         <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={bulkSyncAnswers} style={btnSync} disabled={saving}>
               {saving ? "SYNCING..." : "⚡ SYNC ANSWERS"}
            </button>
            <button onClick={exportPDF} style={btnExport}>
               ⬇ DOWNLOAD PDF
            </button>
         </div>
      </header>

      <div style={grid}>
         {/* EDITOR COLUMN */}
         <div className="glass" style={editorCard}>
            <h3 style={sectionTitle}>CREATE NEW QUESTION</h3>
            
            <div style={row}>
               <select style={select} value={type} onChange={e=>{setType(e.target.value); setCorrect([])}}>
                  <option value="mcq_single">Single Choice (Radio)</option>
                  <option value="mcq_multi">Multi Select (Checkbox)</option>
                  <option value="short">Short Answer (Text)</option>
                  <option value="code">Code / Debugging (Keywords)</option>
               </select>
               <div style={markGroup}>
                  <input type="number" style={inputMark} placeholder="+1" value={marks} onChange={e=>setMarks(e.target.value)} />
                  <input type="number" style={inputMark} placeholder="-0" value={negative} onChange={e=>setNegative(e.target.value)} />
               </div>
            </div>

            <textarea 
               style={textArea} 
               placeholder="Enter full question text here..." 
               value={question} 
               onChange={e=>setQuestion(e.target.value)} 
            />
            
            <div style={fileRow}>
               <label style={btnUpload}>
                 📸 Upload Diagram <input type="file" hidden onChange={handleFileChange} />
               </label>
               {questionImg && <span style={fileStatus}>Image Attached ✅</span>}
            </div>

            {type !== "short" ? (
               <div style={optContainer}>
                  <p style={label}>OPTIONS (Click circle/box to mark correct)</p>
                  {options.map((o,i) => (
                     <div key={i} style={optRow}>
                        <div 
                           onClick={()=>toggleCorrect(o)}
                           style={{
                              ...selectorBox, 
                              borderRadius: type === 'mcq_single' ? '50%' : '4px',
                              background: correct.includes(o) && o ? '#800000' : 'transparent',
                              border: correct.includes(o) && o ? 'none' : '2px solid #333'
                           }}
                        />
                        <input 
                           style={inputOpt} 
                           placeholder={`Option ${i+1}`} 
                           value={o} 
                           onChange={e=>{
                              const arr=[...options]; arr[i]=e.target.value; setOptions(arr);
                           }} 
                        />
                     </div>
                  ))}
               </div>
            ) : (
               <div style={optContainer}>
                  <p style={label}>{type === 'code' ? 'REQUIRED KEYWORDS (Comma separated)' : 'CORRECT ANSWER KEY (Exact Match)'}</p>
                  <input 
                     style={inputFull} 
                     placeholder={type === 'code' ? "e.g. for, if, return, result" : "e.g. O(n log n)"} 
                     value={correct.join(", ")} 
                     onChange={e=>setCorrect(e.target.value.split(","))} 
                  />
               </div>
            )}

            <button style={btnAdd} onClick={addQuestion} disabled={saving}>
               {saving ? "SAVING..." : "ADD QUESTION TO BANK"}
            </button>
         </div>

         {/* LIST COLUMN */}
         <div className="glass" style={listCard}>
            <div style={listHeader}>
               <h3 style={sectionTitle}>EXISTING QUESTIONS ({questions.length})</h3>
            </div>
            
            <div style={scrollArea}>
               {questions.length === 0 ? (
                  <div style={emptyState}>No questions added yet.</div>
               ) : (
                  questions.map((q, idx) => (
                    <div key={q.id} style={item}>
                       <div style={itemMeta}>
                          <span style={qidBadge}>{idx+1}</span>
                          <span style={typeBadge}>{q.type.replace('_', ' ').toUpperCase()}</span>
                       </div>
                       
                       <div style={qContent}>
                          {/* FULL TEXT DISPLAY */}
                          <div style={qText}>{q.question}</div>
                          
                          {/* CORRECT ANSWER DISPLAY */}
                          <div style={ansBox}>
                             <span style={ansLabel}>ANSWER:</span> 
                             <span style={ansValue}>
                                {Array.isArray(q.correct) ? q.correct.join(", ") : q.correct}
                             </span>
                          </div>
                       </div>

                       <div style={metaRight}>
                          <div style={marksBadge}>+{q.marks}</div>
                          <button 
                             onClick={async()=>{
                                if(window.confirm("Delete this question?")) { 
                                   await deleteDoc(doc(db,"exam_questions",q.id)); 
                                   loadQuestions(); 
                                }
                             }} 
                             style={btnDel}
                          >
                             ×
                          </button>
                       </div>
                    </div>
                  ))
               )}
            </div>
         </div>
      </div>
    </div>
  );
}

/* --- STYLES (OPEN CSS) --- */
const page = { 
  minHeight: "100vh", 
  padding: "30px", 
  background: "#050505", 
  color: "#1e293b" 
};

const header = { 
  display: "flex", 
  justifyContent: "space-between", 
  alignItems: "center", 
  marginBottom: "30px" 
};

const headerLeft = { 
  display: "flex", 
  alignItems: "center", 
  gap: "20px" 
};

const title = { 
  fontSize: "1.5rem", 
  color: "#1e293b", 
  margin: "0", 
  fontWeight: "700" 
};

const btnBack = { 
  background: "transparent", 
  border: "1px solid #333", 
  color: "#94a3b8", 
  padding: "8px 16px", 
  borderRadius: "6px", 
  cursor: "pointer", 
  fontSize: "0.8rem", 
  fontWeight: "600" 
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

const btnSync = {
  ...btnExport,
  background: "#f59e0b",
  color: "#1e293b"
};

const grid = { 
  display: "grid", 
  gridTemplateColumns: "1fr 1.2fr", 
  gap: "30px", 
  alignItems: "start" 
};

const editorCard = { 
  padding: "30px", 
  borderRadius: "16px", 
  background: "rgba(20, 20, 25, 0.6)" 
};

const listCard = { 
  padding: "30px", 
  borderRadius: "16px", 
  background: "rgba(20, 20, 25, 0.6)", 
  height: "85vh", 
  display: "flex", 
  flexDirection: "column" 
};

const listHeader = { 
  marginBottom: "20px", 
  paddingBottom: "15px", 
  borderBottom: "1px solid rgba(255,255,255,0.1)" 
};

const sectionTitle = { 
  fontSize: "0.9rem", 
  color: "#64748b", 
  letterSpacing: "1px", 
  fontWeight: "700", 
  marginBottom: "20px", 
  textTransform: "uppercase" 
};

const row = { 
  display: "flex", 
  gap: "15px", 
  marginBottom: "15px" 
};

const select = { 
  flex: "1", 
  padding: "12px", 
  background: "#0a0a0f", 
  border: "1px solid #333", 
  borderRadius: "8px", 
  color: "#1e293b", 
  outline: "none" 
};

const markGroup = { 
  display: "flex", 
  gap: "10px" 
};

const inputMark = { 
  width: "80px", 
  padding: "12px", 
  background: "#0a0a0f", 
  border: "1px solid #333", 
  borderRadius: "8px", 
  color: "#1e293b", 
  textAlign: "center" 
};

const textArea = { 
  width: "100%", 
  height: "120px", 
  background: "#0a0a0f", 
  border: "1px solid #333", 
  borderRadius: "8px", 
  padding: "15px", 
  color: "#1e293b", 
  marginBottom: "15px", 
  fontFamily: "inherit", 
  resize: "vertical" 
};

const fileRow = { 
  display: "flex", 
  alignItems: "center", 
  gap: "15px", 
  marginBottom: "25px" 
};

const btnUpload = { 
  background: "#1a1a1a", 
  color: "#cbd5e1", 
  padding: "8px 16px", 
  borderRadius: "6px", 
  fontSize: "0.85rem", 
  cursor: "pointer", 
  border: "1px solid #333", 
  display: "inline-block" 
};

const fileStatus = { 
  fontSize: "0.8rem", 
  color: "#800000" 
};

const optContainer = { 
  marginTop: "10px" 
};

const label = { 
  fontSize: "0.75rem", 
  color: "#64748b", 
  marginBottom: "10px", 
  display: "block", 
  fontWeight: "600" 
};

const optRow = { 
  display: "flex", 
  alignItems: "center", 
  gap: "10px", 
  marginBottom: "10px" 
};

const selectorBox = { 
  width: "20px", 
  height: "20px", 
  cursor: "pointer", 
  flexShrink: 0 
};

const inputOpt = { 
  flex: "1", 
  padding: "10px", 
  background: "transparent", 
  borderBottom: "1px solid #333", 
  borderTop: "none", 
  borderLeft: "none", 
  borderRight: "none", 
  color: "#1e293b", 
  outline: "none" 
};

const inputFull = { 
  width: "100%", 
  padding: "12px", 
  background: "#0a0a0f", 
  border: "1px solid #800000", 
  borderRadius: "8px", 
  color: "#1e293b" 
};

const btnAdd = { 
  width: "100%", 
  padding: "14px", 
  background: "#800000", 
  color: "#ffffff", 
  border: "none", 
  borderRadius: "8px", 
  fontWeight: "800", 
  marginTop: "20px", 
  cursor: "pointer" 
};

const scrollArea = { 
  flex: 1, 
  overflowY: "auto", 
  paddingRight: "10px" 
};

const emptyState = { 
  textAlign: "center", 
  color: "#64748b", 
  marginTop: "40px", 
  fontStyle: "italic" 
};

const item = { 
  display: "flex", 
  alignItems: "start", 
  padding: "20px", 
  background: "rgba(255,255,255,0.02)", 
  border: "1px solid rgba(255,255,255,0.05)", 
  marginBottom: "10px", 
  borderRadius: "10px", 
  gap: "20px" 
};

const itemMeta = { 
  display: "flex", 
  flexDirection: "column", 
  gap: "5px", 
  width: "50px" 
};

const qidBadge = { 
  color: "#1e293b", 
  fontWeight: "800", 
  fontSize: "1.2rem", 
  fontFamily: "monospace" 
};

const typeBadge = { 
  fontSize: "0.6rem", 
  color: "#64748b", 
  border: "1px solid #333", 
  padding: "2px 4px", 
  borderRadius: "4px", 
  textAlign: "center" 
};

const qContent = { 
  flex: "1" 
};

const qText = { 
  color: "#cbd5e1", 
  fontSize: "0.95rem", 
  lineHeight: "1.5", 
  whiteSpace: "pre-wrap", 
  marginBottom: "10px" 
};

const ansBox = { 
  display: "inline-block", 
  background: "rgba(128, 0, 0, 0.1)", 
  padding: "4px 8px", 
  borderRadius: "4px", 
  border: "1px solid rgba(128, 0, 0, 0.2)" 
};

const ansLabel = { 
  fontSize: "0.7rem", 
  color: "#800000", 
  fontWeight: "700", 
  marginRight: "6px" 
};

const ansValue = { 
  fontSize: "0.85rem", 
  color: "#1e293b", 
  fontWeight: "500" 
};

const metaRight = { 
  display: "flex", 
  flexDirection: "column", 
  alignItems: "center", 
  gap: "10px" 
};

const marksBadge = { 
  fontSize: "0.8rem", 
  color: "#94a3b8", 
  fontFamily: "monospace" 
};

const btnDel = { 
  background: "rgba(239,68,68,0.2)", 
  color: "#ef4444", 
  border: "none", 
  width: "32px", 
  height: "32px", 
  borderRadius: "50%", 
  cursor: "pointer", 
  fontSize: "1.2rem", 
  lineHeight: "1" 
};