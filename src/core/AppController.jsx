import { useEffect, useState } from "react";
import Welcome from "../views/Welcome";
import Instructions from "../views/Instructions";
import Countdown from "../views/Countdown";
import Exam from "../views/Exam";
import AdminLogin from "../admin/AdminLogin";
import AdminDashboard from "../admin/AdminDashboard";
import AdminQuestions from "../admin/AdminQuestions";
import AdminResults from "../admin/AdminResults";
import AdminRequests from "../admin/AdminRequests";
import { auth } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

export default function AppController() {
  const [view, setView] = useState("WELCOME");
  const [student, setStudent] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  /* ---------- 🔒 SECURITY & NAVIGATION CONTROL ---------- */
  useEffect(() => {
    // 1. Block Back Button (Prevent accidental exit)
    window.history.pushState(null, "", window.location.href);
    window.onpopstate = () => {
      window.history.pushState(null, "", window.location.href);
    };

    // 2. Block Right Click (Prevent "Inspect Element")
    const handleContextMenu = (e) => {
      e.preventDefault();
    };

    // 3. Block Critical Keyboard Shortcuts
    const handleKeyDown = (e) => {
      if (e.key === "F12") {
        e.preventDefault();
      }

      if (e.ctrlKey && e.shiftKey && ["I", "J", "C", "i", "j", "c"].includes(e.key)) {
        e.preventDefault();
      }

      if (e.ctrlKey && (e.key === "u" || e.key === "U")) {
        e.preventDefault();
      }

      if (!isAdmin && e.ctrlKey && ["c", "v", "x", "C", "V", "X"].includes(e.key)) {
        e.preventDefault();
      }
    };

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isAdmin]);

  /* ---------- ADMIN CHECK ---------- */
  async function verifyAdmin() {
    const user = auth.currentUser;
    if (!user) return true; // Allow dashboard entry for testing / direct admin login

    try {
      const snap = await getDoc(doc(db, "admins", user.uid));
      return snap.exists();
    } catch {
      return true;
    }
  }

  /* ---------- VIEW ROUTING ---------- */
  return (
    <>
      {/* ---------- STUDENT FLOW ---------- */}
      {view === "WELCOME" && (
        <Welcome setView={setView} setStudent={setStudent} />
      )}

      {view === "INSTRUCTIONS" && (
        <Instructions setView={setView} student={student} />
      )}

      {view === "COUNTDOWN" && <Countdown setView={setView} />}

      {view === "EXAM" && <Exam student={student} />}

      {/* ---------- ADMIN FLOW ---------- */}
      {view === "ADMIN_LOGIN" && (
        <AdminLogin
          onSuccess={async () => {
            const ok = await verifyAdmin();
            if (ok) {
              setIsAdmin(true);
              setView("ADMIN_DASHBOARD");
            } else {
              alert("Unauthorized admin access");
              auth.signOut();
              setView("WELCOME");
            }
          }}
          onCancel={() => setView("WELCOME")}
        />
      )}

      {view === "ADMIN_DASHBOARD" && isAdmin && (
        <AdminDashboard
          onLogout={() => {
            auth.signOut();
            setIsAdmin(false);
            setView("WELCOME");
          }}
          goQuestions={() => setView("ADMIN_QUESTIONS")}
          goResults={() => setView("ADMIN_RESULTS")}
          goRequests={() => setView("ADMIN_REQUESTS")}
        />
      )}

      {view === "ADMIN_QUESTIONS" && isAdmin && (
        <AdminQuestions onBack={() => setView("ADMIN_DASHBOARD")} />
      )}

      {view === "ADMIN_RESULTS" && isAdmin && (
        <AdminResults onBack={() => setView("ADMIN_DASHBOARD")} />
      )}

      {view === "ADMIN_REQUESTS" && isAdmin && (
        <AdminRequests onBack={() => setView("ADMIN_DASHBOARD")} />
      )}
    </>
  );
}