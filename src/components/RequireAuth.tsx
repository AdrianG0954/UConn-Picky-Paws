import { Navigate, Outlet, useLocation } from "react-router-dom";
import { isSessionAuthenticated } from "../auth/session";

export function RequireAuth() {
  const location = useLocation();
  const authed = isSessionAuthenticated();

  if (!authed) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
