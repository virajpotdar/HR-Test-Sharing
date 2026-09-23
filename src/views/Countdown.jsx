import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { getServerTime } from "../services/timeService";

export default function Countdown({ setView }) {
  const [remaining, setRemaining] = useState(null);
  const [ready, setReady] = useState(false);
  const [ended, setEnded] = useState(false);
  const [error, setError] = useState("");
  const [exam, setExam] = useState(null);

  useEffect(() => {
    if (ready) {
      setView("EXAM");
    }
  }, [ready, setView]);

  // 1. Listen to Real-Time Configuration Changes
  useEffect(() => {
    const ref = doc(db, "exam-config", "current-exam");
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setError("Schedule Pending");
        } else {
          setExam(snap.data());
          setError("");
        }
      },
      (err) => {
        console.error("Config fetch error:", err);
        setError("Connection Error");
      }
    );
    return () => unsubscribe();
  }, []);

  // 2. Timer Loop that dynamically accounts for Exam Status and Time
  useEffect(() => {
    if (!exam) return;
    let interval;

    async function tick() {
      try {
        const now = await getServerTime();

        if (!exam.startTime) {
          setError("Schedule Pending");
          setRemaining(null);
          return;
        }

        const scheduledStart = exam.startTime.toDate();
        const endTime = new Date(
          scheduledStart.getTime() + exam.durationMinutes * 60 * 1000
        );

        if (exam.status === "ended" || (exam.status === "active" && now >= endTime)) {
          setEnded(true);
          setReady(false);
          setRemaining(0);
          return;
        }

        if (exam.status !== "active") {
          setReady(false);
          setEnded(false);
          setRemaining(-1); // Special value indicating we are waiting for admin
          return;
        }

        const targetStart = exam.activeStartTime ? exam.activeStartTime.toDate() : scheduledStart;

        if (now >= targetStart) {
          setReady(true);
          setEnded(false);
          setRemaining(0);
          return;
        }

        setReady(false);
        setEnded(false);
        setRemaining(Math.floor((targetStart - now) / 1000));
      } catch (err) {
        console.error("Tick error:", err);
      }
    }

    tick();
    interval = setInterval(tick, 1000);

    return () => clearInterval(interval);
  }, [exam]);

  if (error) return <Wrapper><h2 style={msgError}>⚠️ {error}</h2></Wrapper>;
  if (remaining === null) return <Wrapper><h2 style={msgLoad}>SYNCHRONIZING...</h2></Wrapper>;
  if (remaining === -1) return <Wrapper><h2 style={msgLoad}>WAITING FOR ADMIN TO START...</h2></Wrapper>;
  if (ended) return <Wrapper><h2 style={msgEnd}>ASSESSMENT CONCLUDED</h2></Wrapper>;

  /* --- SYSTEM READY STATE --- */
  if (ready) {
    return <Wrapper><h2 style={msgLoad}>STARTING EXAM...</h2></Wrapper>;
  }

  /* --- COUNTDOWN STATE --- */
  return (
    <div style={page}>
      <h3 style={label}>TEST START IN</h3>
      <TimeBox seconds={remaining} />
    </div>
  );
}

const Wrapper = ({ children }) => (
  <div style={page}><div className="glass" style={card}>{children}</div></div>
);

function TimeBox({ seconds }) {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  let hDisp = h.toString().padStart(2, '0');
  let mDisp = m.toString().padStart(2, '0');
  let sDisp = s.toString().padStart(2, '0');

  const display = d > 0 ? `${d}d ${hDisp}:${mDisp}:${sDisp}` : `${hDisp}:${mDisp}:${sDisp}`;
  return <div style={timerText}>{display}</div>;
}

/* --- STYLES --- */
const page = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "20px",
};

const card = {
  padding: "60px 80px",
  borderRadius: "24px",
  textAlign: "center",
  borderTop: "1px solid rgba(128, 0, 0, 0.4)",
};

const label = {
  fontSize: "1rem",
  letterSpacing: "8px",
  color: "#64748b",
  marginBottom: "20px",
};

const timerText = {
  fontSize: "8rem",
  fontWeight: "300",
  fontFamily: "'Fira Code', monospace",
  color: "transparent",
  WebkitTextStroke: "2px #ffffff",
  textShadow: "0 0 50px rgba(128, 0, 0, 0.2)",
};

const msgError = { color: "#ef4444", fontSize: "1.5rem" };
const msgLoad = { color: "#94a3b8", fontSize: "1.5rem", letterSpacing: "2px" };
const msgEnd = { color: "#94a3b8", fontSize: "2rem" };