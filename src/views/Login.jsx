export default function Login({ setView }) {
  return (
    <div style={container}>
      <div style={card}>
        <h2 style={title}>TNP Examination Portal</h2>

        <input style={input} placeholder="Enrollment Number" />
        <input style={input} placeholder="Password" type="password" />

        <button style={button} onClick={() => setView("INSTRUCTIONS")}>
          Login
        </button>
      </div>
    </div>
  );
}

const container = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const card = {
  background: "#ffffff",
  padding: "32px",
  width: "360px",
  borderRadius: "12px",
  boxShadow: "0 20px 40px rgba(0,0,0,0.08)",
};

const title = {
  marginBottom: "24px",
  textAlign: "center",
};

const input = {
  width: "100%",
  padding: "12px",
  marginBottom: "14px",
  borderRadius: "8px",
  border: "1px solid #e5e7eb",
};

const button = {
  width: "100%",
  padding: "12px",
  background: "#4f46e5",
  color: "#1e293b",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
};
