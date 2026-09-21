const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
const nodemailer = require("nodemailer");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10mb" }));

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-key";
const supabase = createClient(supabaseUrl, supabaseKey);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "Common Assessment API Backend", timestamp: new Date() });
});

/* ====================================================================
   1. ADMIN REQUESTS & AUTH
   ==================================================================== */

// Submit a new Admin Access Request
app.post("/api/admin/request-access", async (req, res) => {
  try {
    const { full_name, email, organization, reason } = req.body;
    if (!full_name || !email || !reason) {
      return res.status(400).json({ error: "Name, email, and reason are required." });
    }

    const { data, error } = await supabase
      .from("admin_requests")
      .insert([{ full_name, email, organization: organization || "", reason, status: "pending" }])
      .select();

    if (error) {
      if (error.code === "23505") {
        return res.status(400).json({ error: "An access request for this email already exists." });
      }
      return res.status(500).json({ error: error.message });
    }

    // Send email notification to virajpotdar4@gmail.com
    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER || "virajpotdar4@gmail.com",
          pass: process.env.EMAIL_PASS || "your-app-password"
        }
      });

      const mailOptions = {
        from: process.env.EMAIL_USER || "virajpotdar4@gmail.com",
        to: "virajpotdar4@gmail.com",
        subject: `New Admin Access Request: ${full_name}`,
        text: `You have received a new admin access request.\n\nName: ${full_name}\nEmail: ${email}\nOrganization: ${organization}\nReason: ${reason}\n\nPlease review it in your admin dashboard.`
      };

      await transporter.sendMail(mailOptions);
    } catch (mailErr) {
      console.warn("Failed to send email notification:", mailErr.message);
      // We don't fail the request if email fails, just log it.
    }

    res.json({ success: true, message: "Admin access request submitted successfully.", data: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all pending Admin Access Requests
app.get("/api/admin/requests", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("admin_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ requests: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Approve or Reject Admin Request
app.post("/api/admin/requests/review", async (req, res) => {
  try {
    const { id, status, reviewed_by } = req.body; // status: 'approved' | 'rejected'
    if (!id || !["approved", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Invalid parameters." });
    }

    // 1. Update request status
    const { data: reqData, error: reqErr } = await supabase
      .from("admin_requests")
      .update({ status, reviewed_at: new Date(), reviewed_by: reviewed_by || "Admin" })
      .eq("id", id)
      .select();

    if (reqErr) return res.status(500).json({ error: reqErr.message });

    // 2. If approved, add to admins table
    if (status === "approved" && reqData.length > 0) {
      const adminReq = reqData[0];
      await supabase
        .from("admins")
        .upsert([{ email: adminReq.email, full_name: adminReq.full_name, role: "admin", status: "active" }], { onConflict: "email" });
    }

    res.json({ success: true, data: reqData[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Verify Admin Credentials
app.post("/api/admin/login", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email required." });

    const { data, error } = await supabase
      .from("admins")
      .select("*")
      .eq("email", email)
      .eq("status", "active")
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(401).json({ error: "Unauthorized admin user." });

    res.json({ success: true, admin: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ====================================================================
   2. EXAM CONFIGURATION & QUESTIONS
   ==================================================================== */

// Get current exam config
app.get("/api/exam/config", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("exam_config")
      .select("*")
      .eq("id", "current-exam")
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ config: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update exam config
app.post("/api/admin/config", async (req, res) => {
  try {
    const config = req.body;
    const { data, error } = await supabase
      .from("exam_config")
      .upsert([{ id: "current-exam", ...config, updated_at: new Date() }])
      .select();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, config: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get questions for exam
app.get("/api/exam/questions", async (req, res) => {
  try {
    const examId = req.query.examId || "common_test";
    const { data, error } = await supabase
      .from("exam_questions")
      .select("*")
      .eq("exam_id", examId)
      .order("order_num", { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ questions: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save question
app.post("/api/admin/questions", async (req, res) => {
  try {
    const question = req.body;
    const { data, error } = await supabase
      .from("exam_questions")
      .insert([question])
      .select();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, question: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete question
app.delete("/api/admin/questions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from("exam_questions")
      .delete()
      .eq("id", id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ====================================================================
   3. EXAM SESSIONS & RESULTS
   ==================================================================== */

// Init Candidate Session
app.post("/api/exam/session/init", async (req, res) => {
  try {
    const { sessionId, scholar, name, email, examId } = req.body;
    if (!sessionId) return res.status(400).json({ error: "Session ID required." });

    const { data: existing } = await supabase
      .from("exam_sessions")
      .select("*")
      .eq("id", sessionId)
      .maybeSingle();

    if (existing) {
      return res.json({ session: existing, exists: true });
    }

    const { data, error } = await supabase
      .from("exam_sessions")
      .insert([{
        id: sessionId,
        scholar,
        name,
        email: email || "",
        exam_id: examId || "common_test",
        status: "NotStarted",
        answers: {},
        violations: 0,
        violation_images: []
      }])
      .select();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ session: data[0], exists: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Submit Candidate Exam
app.post("/api/exam/session/submit", async (req, res) => {
  try {
    const { sessionId, answers, score, submitReason } = req.body;
    const { data, error } = await supabase
      .from("exam_sessions")
      .update({
        status: "Submitted",
        answers: answers || {},
        score: score || 0,
        submit_reason: submitReason || "Manual",
        submitted_at: new Date()
      })
      .eq("id", sessionId)
      .select();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, session: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all test results
app.get("/api/admin/results", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("exam_sessions")
      .select("*")
      .order("submitted_at", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ sessions: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
