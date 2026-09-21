// API Service abstraction for Supabase/Render backend & Firebase fallback

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:5000";

// Submit Admin Access Request
export async function submitAdminRequest(payload) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/admin/request-access`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to submit request.");
    return data;
  } catch (err) {
    console.warn("Backend API request failed, saving to local fallback:", err.message);
    // Local storage fallback so the user can test without a live backend
    const existing = JSON.parse(localStorage.getItem("local_admin_requests") || "[]");
    const newReq = {
      id: "local_" + Date.now(),
      ...payload,
      status: "pending",
      created_at: new Date().toISOString()
    };
    existing.push(newReq);
    localStorage.setItem("local_admin_requests", JSON.stringify(existing));
    return { success: true, message: "Admin request stored locally (Fallback mode).", data: newReq };
  }
}

// Get Admin Requests
export async function getAdminRequests() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/admin/requests`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data.requests || [];
  } catch (err) {
    console.warn("Backend API request failed, reading local fallback:", err.message);
    return JSON.parse(localStorage.getItem("local_admin_requests") || "[]");
  }
}

// Review Admin Request (Approve / Reject)
export async function reviewAdminRequest(id, status, reviewed_by = "Admin") {
  try {
    const res = await fetch(`${BACKEND_URL}/api/admin/requests/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status, reviewed_by }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  } catch (err) {
    console.warn("Backend API request failed, updating local fallback:", err.message);
    const existing = JSON.parse(localStorage.getItem("local_admin_requests") || "[]");
    const updated = existing.map(r => r.id === id ? { ...r, status, reviewed_at: new Date().toISOString() } : r);
    localStorage.setItem("local_admin_requests", JSON.stringify(updated));
    return { success: true };
  }
}
