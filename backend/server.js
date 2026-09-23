const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
const nodemailer = require("nodemailer");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10mb" }));

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-key";
const supabase = createClient(supabaseUrl, supabaseKey);

/* ====================================================================
   EMAIL TRANSPORTER - Created ONCE at startup (fixes 5-min delay)
   ==================================================================== */
let emailTransporter = null;

function initEmailTransporter() {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;

  if (!emailUser || !emailPass || emailPass === "your-gmail-app-password-here") {
    console.warn("⚠️  EMAIL_USER or EMAIL_PASS not configured. Email sending disabled.");
    console.warn("   Set them in .env with a Gmail App Password.");
    return;
  }

  emailTransporter = nodemailer.createTransport({
    service: "gmail",
    pool: true,          // Use connection pooling (faster)
    maxConnections: 3,
    maxMessages: 50,
    auth: {
      user: emailUser,
      pass: emailPass
    }
  });

  // Verify connection on startup
  emailTransporter.verify((error) => {
    if (error) {
      console.error("❌ Email transporter verification failed:", error.message);
      emailTransporter = null;
    } else {
      console.log("✅ Email transporter ready — emails will send instantly");
    }
  });
}

initEmailTransporter();

// Helper: Send email (fast, non-blocking)
async function sendEmail(to, subject, html) {
  if (!emailTransporter) {
    console.warn("Email not sent (transporter not configured):", subject);
    return false;
  }
  try {
    await emailTransporter.sendMail({
      from: `"HR Test Portal" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html
    });
    console.log(`✅ Email sent to ${to}: ${subject}`);
    return true;
  } catch (err) {
    console.error(`❌ Email send failed to ${to}:`, err.message);
    return false;
  }
}

// Helper: Generate a random temp password
function generateTempPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let pass = "Temp-";
  for (let i = 0; i < 8; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Common Assessment API Backend",
    emailConfigured: !!emailTransporter,
    timestamp: new Date()
  });
});

// Test email endpoint
app.get("/api/test-email", async (req, res) => {
  const sent = await sendEmail(
    process.env.EMAIL_USER,
    "🧪 Test Email from HR Portal",
    "<h2>Email is working!</h2><p>If you see this, your email configuration is correct.</p>"
  );
  res.json({ success: sent, message: sent ? "Test email sent!" : "Email not configured. Check .env" });
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

    // Send email notification to admin (FAST — uses pooled connection)
    sendEmail(
      process.env.EMAIL_USER || "virajpotdar4@gmail.com",
      `🔔 New Admin Access Request: ${full_name}`,
      `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; background: #f8f9fa; border-radius: 12px;">
          <h2 style="color: #800000; margin-bottom: 20px;">New Access Request</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px; color: #666; font-weight: bold;">Name:</td><td style="padding: 8px;">${full_name}</td></tr>
            <tr><td style="padding: 8px; color: #666; font-weight: bold;">Email:</td><td style="padding: 8px;">${email}</td></tr>
            <tr><td style="padding: 8px; color: #666; font-weight: bold;">Organization:</td><td style="padding: 8px;">${organization || "N/A"}</td></tr>
            <tr><td style="padding: 8px; color: #666; font-weight: bold;">Reason:</td><td style="padding: 8px;">${reason}</td></tr>
          </table>
          <p style="margin-top: 20px; color: #888; font-size: 0.85rem;">Review this request in your Admin Dashboard.</p>
        </div>
      `
    );

    res.json({ success: true, message: "Admin access request submitted successfully.", data: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all Admin Access Requests
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
// On APPROVE: Creates user account with temp password + sends credentials email
app.post("/api/admin/requests/review", async (req, res) => {
  try {
    const { id, status, reviewed_by } = req.body;
    if (!id || !["approved", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Invalid parameters." });
    }

    // 1. Update request status
    const { data: reqData, error: reqErr } = await supabase
      .from("admin_requests")
      .update({ status, reviewed_at: new Date().toISOString(), reviewed_by: reviewed_by || "Admin" })
      .eq("id", id)
      .select();

    if (reqErr) return res.status(500).json({ error: reqErr.message });
    if (!reqData || reqData.length === 0) return res.status(404).json({ error: "Request not found." });

    const adminReq = reqData[0];

    // 2. If APPROVED — create user account with temp password
    if (status === "approved") {
      const tempPassword = generateTempPassword();
      const passwordHash = await bcrypt.hash(tempPassword, 12);

      // Upsert into admins table with hashed password
      const { error: adminErr } = await supabase
        .from("admins")
        .upsert([{
          email: adminReq.email,
          full_name: adminReq.full_name,
          role: "admin",
          status: "active",
          password_hash: passwordHash,
          must_change_password: true,
          organization: adminReq.organization || ""
        }], { onConflict: "email" });

      if (adminErr) {
        console.error("Failed to create admin user:", adminErr.message);
        return res.status(500).json({ error: "Failed to create admin account: " + adminErr.message });
      }

      // 3. Send credentials email to the user
      const emailSent = await sendEmail(
        adminReq.email,
        "✅ Your Admin Access Has Been Approved — HR Test Portal",
        `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 30px; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: #ffffff; border-radius: 16px;">
            <div style="text-align: center; margin-bottom: 25px;">
              <h1 style="color: #800000; margin: 0;">Access Approved! 🎉</h1>
              <p style="color: #94a3b8; margin-top: 8px;">HR Test Portal — Admin Access</p>
            </div>
            
            <p style="color: #cbd5e1;">Hello <strong>${adminReq.full_name}</strong>,</p>
            <p style="color: #cbd5e1;">Your admin access request has been approved. Use the credentials below to log in:</p>
            
            <div style="background: rgba(128,0,0,0.15); border: 1px solid rgba(128,0,0,0.3); border-radius: 12px; padding: 20px; margin: 20px 0;">
              <table style="width: 100%;">
                <tr>
                  <td style="padding: 6px 0; color: #94a3b8; font-size: 0.8rem; letter-spacing: 1px;">EMAIL (LOGIN ID)</td>
                </tr>
                <tr>
                  <td style="padding: 0 0 12px 0; color: #ffffff; font-size: 1.1rem; font-family: monospace; font-weight: bold;">${adminReq.email}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #94a3b8; font-size: 0.8rem; letter-spacing: 1px;">TEMPORARY PASSWORD</td>
                </tr>
                <tr>
                  <td style="padding: 0; color: #800000; font-size: 1.3rem; font-family: monospace; font-weight: bold; letter-spacing: 2px;">${tempPassword}</td>
                </tr>
              </table>
            </div>
            
            <div style="background: rgba(245,158,11,0.1); border-left: 3px solid #f59e0b; padding: 12px 16px; border-radius: 0 8px 8px 0; margin: 20px 0;">
              <p style="color: #f59e0b; margin: 0; font-size: 0.9rem;">
                ⚠️ <strong>You will be required to change your password on first login.</strong>
              </p>
            </div>
            
            <p style="color: #64748b; font-size: 0.8rem; margin-top: 25px; text-align: center;">
              If you did not request this access, please contact support.
            </p>
          </div>
        `
      );

      return res.json({
        success: true,
        data: reqData[0],
        credentialsSent: emailSent,
        message: emailSent
          ? "User approved & credentials sent via email."
          : "User approved but email failed — temp password: " + tempPassword
      });
    }

    // If REJECTED
    if (status === "rejected") {
      sendEmail(
        adminReq.email,
        "❌ Admin Access Request — Not Approved",
        `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 30px; background: #f8f9fa; border-radius: 12px;">
            <h2 style="color: #ef4444;">Access Request Not Approved</h2>
            <p>Hello ${adminReq.full_name},</p>
            <p>Unfortunately, your admin access request for the HR Test Portal has not been approved at this time.</p>
            <p style="color: #888;">If you believe this is an error, please contact the administrator.</p>
          </div>
        `
      );
    }

    res.json({ success: true, data: reqData[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ====================================================================
   AUTH ENDPOINTS (Password-based login with Supabase DB)
   ==================================================================== */

// Login — verify email + password against admins table
app.post("/api/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    // Fetch admin by email
    const { data: admin, error } = await supabase
      .from("admins")
      .select("*")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!admin) return res.status(401).json({ error: "No account found for this email. Request access first." });

    // Check if suspended
    if (admin.status === "suspended") {
      return res.status(403).json({ error: "Your account has been suspended. Contact the administrator." });
    }

    // Verify password
    if (!admin.password_hash) {
      return res.status(401).json({ error: "Account not set up. Contact the administrator." });
    }

    const isValid = await bcrypt.compare(password, admin.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid password. Please try again." });
    }

    // Update last login
    await supabase
      .from("admins")
      .update({ last_login: new Date().toISOString() })
      .eq("id", admin.id);

    // Return admin data (without password hash)
    const { password_hash, ...safeAdmin } = admin;
    res.json({
      success: true,
      admin: safeAdmin,
      must_change_password: admin.must_change_password || false
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Change password (forced or voluntary)
app.post("/api/admin/change-password", async (req, res) => {
  try {
    const { email, current_password, new_password } = req.body;
    if (!email || !current_password || !new_password) {
      return res.status(400).json({ error: "All fields are required." });
    }

    if (new_password.length < 8) {
      return res.status(400).json({ error: "New password must be at least 8 characters." });
    }

    // Fetch admin
    const { data: admin, error } = await supabase
      .from("admins")
      .select("*")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!admin) return res.status(404).json({ error: "Account not found." });

    // Verify current password
    const isValid = await bcrypt.compare(current_password, admin.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: "Current password is incorrect." });
    }

    // Hash new password and update
    const newHash = await bcrypt.hash(new_password, 12);
    const { error: updateErr } = await supabase
      .from("admins")
      .update({
        password_hash: newHash,
        must_change_password: false
      })
      .eq("id", admin.id);

    if (updateErr) return res.status(500).json({ error: updateErr.message });

    res.json({ success: true, message: "Password changed successfully." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle user access (suspend / reactivate)
app.post("/api/admin/toggle-access", async (req, res) => {
  try {
    const { email, action } = req.body; // action: 'suspend' | 'reactivate'
    if (!email || !["suspend", "reactivate"].includes(action)) {
      return res.status(400).json({ error: "Email and action (suspend/reactivate) required." });
    }

    const newStatus = action === "suspend" ? "suspended" : "active";
    const { data, error } = await supabase
      .from("admins")
      .update({ status: newStatus })
      .eq("email", email.toLowerCase().trim())
      .select();

    if (error) return res.status(500).json({ error: error.message });
    if (!data || data.length === 0) return res.status(404).json({ error: "User not found." });

    // Notify user via email
    if (action === "suspend") {
      sendEmail(
        email,
        "🔒 Your Admin Access Has Been Suspended — HR Test Portal",
        `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 30px; background: #f8f9fa; border-radius: 12px;">
            <h2 style="color: #ef4444;">Access Suspended</h2>
            <p>Hello ${data[0].full_name},</p>
            <p>Your admin access to the HR Test Portal has been suspended. You will not be able to log in until your access is restored.</p>
            <p style="color: #888; font-size: 0.85rem;">If you believe this is an error, contact the administrator.</p>
          </div>
        `
      );
    } else {
      sendEmail(
        email,
        "✅ Your Admin Access Has Been Restored — HR Test Portal",
        `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 30px; background: #f8f9fa; border-radius: 12px;">
            <h2 style="color: #22c55e;">Access Restored!</h2>
            <p>Hello ${data[0].full_name},</p>
            <p>Your admin access to the HR Test Portal has been restored. You can now log in with your existing credentials.</p>
          </div>
        `
      );
    }

    res.json({ success: true, user: data[0], message: `User ${action}d successfully.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all admin users (for user management panel)
app.get("/api/admin/users", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("admins")
      .select("id, email, full_name, role, status, organization, must_change_password, last_login, created_at")
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ users: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reset user password (admin action — generates new temp password)
app.post("/api/admin/reset-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email required." });

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const { data, error } = await supabase
      .from("admins")
      .update({ password_hash: passwordHash, must_change_password: true })
      .eq("email", email.toLowerCase().trim())
      .select();

    if (error) return res.status(500).json({ error: error.message });
    if (!data || data.length === 0) return res.status(404).json({ error: "User not found." });

    // Send new credentials
    const emailSent = await sendEmail(
      email,
      "🔑 Your Password Has Been Reset — HR Test Portal",
      `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 30px; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: #ffffff; border-radius: 16px;">
          <h2 style="color: #800000;">Password Reset</h2>
          <p style="color: #cbd5e1;">Hello ${data[0].full_name},</p>
          <p style="color: #cbd5e1;">Your password has been reset by the administrator. Use the new temporary password below:</p>
          <div style="background: rgba(128,0,0,0.15); border: 1px solid rgba(128,0,0,0.3); border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center;">
            <p style="color: #94a3b8; font-size: 0.8rem; margin: 0 0 8px 0;">NEW TEMPORARY PASSWORD</p>
            <p style="color: #800000; font-size: 1.4rem; font-family: monospace; font-weight: bold; letter-spacing: 2px; margin: 0;">${tempPassword}</p>
          </div>
          <p style="color: #f59e0b; font-size: 0.9rem;">⚠️ You will be required to change this password on next login.</p>
        </div>
      `
    );

    res.json({
      success: true,
      message: emailSent
        ? "Password reset & new credentials sent via email."
        : "Password reset but email failed — temp password: " + tempPassword
    });
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
  console.log(`\n🚀 Server listening on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Email:  ${emailTransporter ? "✅ Configured" : "❌ Not configured"}\n`);
});
