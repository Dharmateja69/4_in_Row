import { useState } from "react";

export default function Login({ onJoin }) {
  const [name, setName] = useState("");
  return (
    <div className="panel card" style={{ width: 360 }}>
      <h3 style={{ color: "var(--accent-2)" }}>Join 4-in-a-Row</h3>
      <input
        placeholder="Enter username"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => name && onJoin(name)}>Join</button>
      </div>
    </div>
  );
}
