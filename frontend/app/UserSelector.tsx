"use client";
import { useUser } from "./UserContext";

export default function UserSelector() {
  const { users, currentUser, setCurrentUser } = useUser();

  return (
    <select
      value={currentUser?.email || ""}
      onChange={e => {
        const user = users.find(u => u.email === e.target.value) || null;
        setCurrentUser(user);
      }}
      className="text-sm rounded px-2 py-1 outline-none"
      style={{
        background: "var(--color-card)",
        border: "1px solid var(--color-border)",
        color: "var(--color-text-secondary)",
      }}
    >
      <option value="">Select user...</option>
      {users.map(u => (
        <option key={u.email} value={u.email}>
          {u.name} ({u.role})
        </option>
      ))}
    </select>
  );
}
