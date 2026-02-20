"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";

const API = "http://localhost:8001";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface UserContextType {
  users: User[];
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
}

const UserContext = createContext<UserContextType>({ users: [], currentUser: null, setCurrentUser: () => {} });

export function UserProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    fetch(`${API}/api/users`).then(r => r.json()).then((data: User[]) => {
      setUsers(data);
      const saved = localStorage.getItem("tokamak_user_email");
      if (saved) {
        const found = data.find(u => u.email === saved);
        if (found) setCurrentUser(found);
      }
    }).catch(() => {});
  }, []);

  const handleSetUser = (user: User | null) => {
    setCurrentUser(user);
    if (user) {
      localStorage.setItem("tokamak_user_email", user.email);
    } else {
      localStorage.removeItem("tokamak_user_email");
    }
  };

  return (
    <UserContext.Provider value={{ users, currentUser, setCurrentUser: handleSetUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
