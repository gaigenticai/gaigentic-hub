import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function RequireAuth() {
  const { auth } = useAuth();

  if (auth.status === "unauthenticated") {
    return <Navigate to="/signup" replace />;
  }

  return <Outlet />;
}
