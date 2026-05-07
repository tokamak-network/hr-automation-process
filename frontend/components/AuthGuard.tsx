"use client";
import { useAuth } from "@/lib/AuthContext";
import { usePathname } from "next/navigation";
import LoginPage from "@/app/login/page";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  // Show nothing while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  // Login page is always accessible
  if (pathname === "/login") {
    return <>{children}</>;
  }

  // Not logged in → show login
  if (!user) {
    return <LoginPage />;
  }

  // Logged in → show app
  return <>{children}</>;
}
