import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import PinAuth from "./pages/PinAuth";
import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import Payroll from "./pages/Payroll";
import PayrollSettings from "./pages/PayrollSettings";
import Reports from "./pages/Reports";
import EmployeePortal from "./pages/EmployeePortal";
import SetupPin from "./pages/SetupPin";
import ChangePin from "./pages/ChangePin";
import ForgotPin from "./pages/ForgotPin";
import ResetPin from "./pages/ResetPin";
import NotFound from "./pages/NotFound";
import ApproveReimbursements from "./pages/ApproveReimbursements";
import { AdminProtectedRoute } from "./components/routing/AdminProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/sso" element={<Index />} /> {/* SSO redirect handled by backend */}
          <Route path="/pin-auth" element={<PinAuth />} />
          <Route path="/setup-pin" element={<SetupPin />} />
          <Route path="/change-pin" element={<ChangePin />} />
          <Route path="/forgot-pin" element={<ForgotPin />} />
          <Route path="/reset-pin" element={<ResetPin />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/payroll" element={<Payroll />} />
          <Route path="/payroll/settings" element={<PayrollSettings />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/employee-portal" element={<EmployeePortal />} />
          <Route
            path="/approve-reimbursements"
            element={
              <AdminProtectedRoute>
                <ApproveReimbursements />
              </AdminProtectedRoute>
            }
          />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
