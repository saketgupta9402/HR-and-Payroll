import { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigate, useLocation } from "react-router-dom";
import { api } from "@/lib/api";

type Props = {
  children: ReactNode;
};

export const AdminProtectedRoute = ({ children }: Props) => {
  const location = useLocation();

  const { data, isLoading, error } = useQuery({
    queryKey: ["me-profile"],
    queryFn: () => api.me.profile(),
    staleTime: 2_000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return <Navigate to="/pin-auth" state={{ from: location.pathname }} replace />;
  }

  const profile = (data as any)?.profile;

  if (!profile?.id) {
    return <Navigate to="/pin-auth" state={{ from: location.pathname }} replace />;
  }

  const payrollRole = profile.payroll_role || "payroll_employee";

  if (payrollRole === "payroll_employee") {
    return <Navigate to="/employee-portal" replace />;
  }

  return <>{children}</>;
};

