import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useMe } from "@/api/hooks";
import { Spinner } from "./ui";

export function RequireAuth({ role }: { role?: "ops" }) {
  const { data: me, isLoading } = useMe();
  const loc = useLocation();
  if (isLoading) return <Spinner label="Loading your garage" />;
  if (!me) return <Navigate to="/signup" state={{ next: loc.pathname + loc.search, reason: "Sign in to continue." }} replace />;
  if (role && me.role !== role) return <Navigate to="/garage" replace />;
  return <Outlet />;
}
