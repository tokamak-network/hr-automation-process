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
      className="bg-gray-800 border border-gray-700 text-sm rounded px-2 py-1 text-gray-300 focus:border-blue-500 outline-none"
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
