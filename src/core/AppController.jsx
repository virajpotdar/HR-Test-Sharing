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
import AdminUsers from "../admin/AdminUsers";
import ChangePassword from "../admin/ChangePassword";

export default function AppController() {
  const [view, setView] = useState("WELCOME");
  const [student, setStudent] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminData, setAdminData] = useState(null);
  const [tempPassword, setTempPassword] = useState(""); // for forced password change

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
          onSuccess={(admin) => {
            setAdminData(admin);
            setIsAdmin(true);
            setView("ADMIN_DASHBOARD");
          }}
          onForceChangePassword={(admin, currentPassword) => {
            setAdminData(admin);
            setTempPassword(currentPassword);
            setView("CHANGE_PASSWORD");
          }}
          onCancel={() => setView("WELCOME")}
        />
      )}

      {view === "CHANGE_PASSWORD" && adminData && (
        <ChangePassword
          admin={adminData}
          currentTempPassword={tempPassword}
          onSuccess={(admin) => {
            setAdminData(admin);
            setIsAdmin(true);
            setTempPassword("");
            setView("ADMIN_DASHBOARD");
          }}
        />
      )}

      {view === "ADMIN_DASHBOARD" && isAdmin && (
        <AdminDashboard
          admin={adminData}
          onLogout={() => {
            setIsAdmin(false);
            setAdminData(null);
            setView("WELCOME");
          }}
          goQuestions={() => setView("ADMIN_QUESTIONS")}
          goResults={() => setView("ADMIN_RESULTS")}
          goRequests={() => setView("ADMIN_REQUESTS")}
          goUsers={() => setView("ADMIN_USERS")}
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

      {view === "ADMIN_USERS" && isAdmin && (
        <AdminUsers onBack={() => setView("ADMIN_DASHBOARD")} />
      )}
    </>
  );
}