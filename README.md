# 🚀 Common Online Assessment & Test Portal

A universal, secure, and production-ready **Common Online Assessment & Test Taking Platform**. Designed for institutions, companies, and educators to schedule exams, manage question banks, review real-time proctoring data, and manage candidate test sessions.

---

## 🌟 Key Features

1. **Universal Candidate Test Portal**: Anyone can take tests using candidate registration details (PRN, Name, Email).
2. **Admin Access Request & Approval System**:
   - Anyone can request Admin privileges via the "Request Admin Access" form.
   - Admins can review, approve, or reject pending admin requests directly in the Command Center.
3. **Advanced Anti-Cheat Proctoring**:
   - Fullscreen enforcement & auto-lock mode.
   - Real-time tab switch violation counters & snapshot capture.
   - Disable keyboard shortcuts (F12, Inspect, Copy-Paste, Tab Switch).
4. **Question Bank Manager**:
   - Single Choice (MCQ), Multi-Choice, Short Answer, and Debugging Code questions.
   - Diagram/Image attachment support.
   - PDF Question Bank Exporter with high-contrast theme.
5. **Real-time Candidate Analytics**:
   - Dynamic live candidate status (Active vs. Submitted).
   - Automated score evaluation & dark-mode PDF report exporter.
6. **Supabase PostgreSQL & Express Backend Ready**:
   - Prepared DDL script (`supabase_schema.sql`).
   - Node.js Express API backend (`backend/server.js`) ready for Render deployment.
   - Single Page Application routing config (`vercel.json`) ready for Vercel deployment.

---

## 🛠️ Step-by-Step Progress & Deployment Guide

### STEP 1: Supabase Database Setup 🗄️

1. Go to [Supabase Console](https://supabase.com) and create a new project.
2. In the Supabase Dashboard, open the **SQL Editor**.
3. Copy the contents of [`supabase_schema.sql`](file:///d:/HR%20TEST%20SHARING/HR%20TEST%20SHARING/supabase_schema.sql) from this repository and run it in Supabase SQL Editor.
4. This creates all 5 tables:
   - `admins`: Admin user records.
   - `admin_requests`: Pending admin access requests.
   - `exam_config`: Exam state & configuration.
   - `exam_questions`: Question bank.
   - `exam_sessions`: Candidate test sessions & answers.
5. In **Project Settings** -> **API**, copy your `Project URL` and `service_role` Secret Key.

---

### STEP 2: Render Backend Deployment 🖥️

1. Log in to [Render](https://render.com) and click **New +** -> **Web Service**.
2. Connect your GitHub repository: `https://github.com/virajpotdar/HR-Test-Sharing.git`.
3. Set the Root Directory to: `backend`
4. Set the Build Command to: `npm install`
5. Set the Start Command to: `node server.js`
6. Add Environment Variables:
   - `SUPABASE_URL`: `https://your-project.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY`: `your-service-role-key`
   - `PORT`: `5000`
7. Click **Create Web Service**. Your backend API will be live at `https://your-backend.onrender.com`.

---

### STEP 3: Vercel Frontend Deployment 🌐

1. Log in to [Vercel](https://vercel.com) and click **Add New Project**.
2. Import the Git repository: `https://github.com/virajpotdar/HR-Test-Sharing.git`.
3. Set Framework Preset: **Create React App** (or Other).
4. Add Environment Variables:
   - `REACT_APP_BACKEND_URL`: `https://your-backend.onrender.com`
   - `REACT_APP_SUPABASE_URL`: `https://your-project.supabase.co`
   - `REACT_APP_SUPABASE_ANON_KEY`: `your-anon-key`
5. Click **Deploy**. Vercel will build and host your frontend application!

---

### STEP 4: GitHub Repository Push Commands 🐙

Run the following commands in your terminal to push your repository changes to GitHub:

```bash
git add .
git commit -m "Refactor to Common Assessment Portal, add Supabase schema, Render backend, Vercel config, and Admin Access Requests"
git remote add origin https://github.com/virajpotdar/HR-Test-Sharing.git
git branch -M main
git push -u origin main --force
```

---

## 💻 Local Development Setup

### Frontend:
```bash
npm install
npm start
```
Frontend starts at `http://localhost:3000`.

### Backend:
```bash
cd backend
npm install
npm run dev
```
Backend API starts at `http://localhost:5000`.

---

## 📄 License
MIT License - Free for institutional, corporate, and educational use.
