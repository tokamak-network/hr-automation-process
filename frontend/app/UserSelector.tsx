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
      className="text-sm rounded px-2 py-1 outline-none bg-gray-800 border border-gray-600 text-gray-300"
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
