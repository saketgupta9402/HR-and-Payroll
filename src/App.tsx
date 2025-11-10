import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute, PublicRoute } from "./components/ProtectedRoute";

// Pages
import Login from "./pages/auth/Login";
import FirstTimeLogin from "./pages/auth/FirstTimeLogin";
import FirstLoginWithToken from "./pages/auth/FirstLoginWithToken";
import Signup from "./pages/auth/Signup";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import Appraisals from "./pages/Appraisals";
import MyAppraisal from "./pages/MyAppraisal";
import ShiftManagement from "./pages/ShiftManagement";
import AIAssistantPage from "./pages/AIAssistantPage";
import EmployeeImport from "./pages/EmployeeImport";
import AttendanceUpload from "./pages/AttendanceUpload";
import AttendanceUploadHistory from "./pages/AttendanceUploadHistory";
import Workflows from "./pages/Workflows";
import WorkflowEditor from "./pages/WorkflowEditor";
import Timesheets from "./pages/Timesheets";
import TimesheetApprovals from "./pages/TimesheetApprovals";
import Analytics from "./pages/Analytics";
import NotFound from "./pages/NotFound";
import AddEmployee from "./pages/AddEmployee";
import LeavePolicies from "./pages/LeavePolicies";
import LeaveRequests from "./pages/LeaveRequests";
import Onboarding from "./pages/Onboarding";
import ChangePassword from "./pages/ChangePassword";
import OrgChart from "./pages/OrgChart";
import SetupPassword from "./pages/SetupPassword";
import OnboardingTracker from "./pages/OnboardingTracker";
import Settings from "./pages/Settings";
import AdminDashboard from "./pages/AdminDashboard";
import ProfileSkills from "./pages/ProfileSkills";
import ProjectNew from "./pages/ProjectNew";
import ProjectSuggestions from "./pages/ProjectSuggestions";
import CEODashboard from "./pages/CEODashboard";
import EmployeeDetail from "./pages/EmployeeDetail";
import MyProfile from "./pages/MyProfile";
import ProjectCalendar from "./pages/ProjectCalendar";
import HolidayManagement from "./pages/HolidayManagement";
import EmployeeStats from "./pages/EmployeeStats";
import Payroll from "./pages/Payroll";
import PayrollAdjustments from "./pages/PayrollAdjustments";
import BackgroundChecks from "./pages/BackgroundChecks";
import Terminations from "./pages/Terminations";
import DocumentInbox from "./pages/DocumentInbox";
import OffboardingNew from "./pages/OffboardingNew";
import OffboardingQueue from "./pages/OffboardingQueue";
import OffboardingDetail from "./pages/OffboardingDetail";
import OffboardingPolicies from "./pages/OffboardingPolicies";
import OnboardingEnhanced from "./pages/OnboardingEnhanced";
import PoliciesManagement from "./pages/PoliciesManagement";
import PromotionCycles from "./pages/PromotionCycles";
import TaxDeclaration from "./pages/TaxDeclaration";
import TaxDeclarationReview from "./pages/TaxDeclarationReview";
import Form16 from "./pages/Form16";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/auth/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/auth/signup" element={<PublicRoute><Signup /></PublicRoute>} />
            <Route path="/auth/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
            <Route path="/auth/reset-password" element={<PublicRoute><ResetPassword /></PublicRoute>} />
            <Route path="/auth/first-time-login" element={<FirstTimeLogin />} />
            <Route path="/auth/first-login" element={<FirstLoginWithToken />} />
            <Route path="/setup-password" element={<SetupPassword />} />
            
            {/* Protected routes */}
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/employees" element={<ProtectedRoute><Employees /></ProtectedRoute>} />
            <Route path="/employees/:id" element={<ProtectedRoute><EmployeeDetail /></ProtectedRoute>} />
            <Route path="/my/profile" element={<ProtectedRoute><MyProfile /></ProtectedRoute>} />
            <Route path="/profile/skills" element={<ProtectedRoute><ProfileSkills /></ProtectedRoute>} />
            
            {/* HR-only routes */}
            <Route path="/employees/new" element={<ProtectedRoute allowedRoles={['hr', 'director', 'ceo', 'admin']}><AddEmployee /></ProtectedRoute>} />
            <Route path="/employees/import" element={<ProtectedRoute allowedRoles={['hr', 'director', 'ceo', 'admin']}><EmployeeImport /></ProtectedRoute>} />
            <Route path="/onboarding-tracker" element={<ProtectedRoute allowedRoles={['hr', 'director', 'ceo', 'admin']}><OnboardingTracker /></ProtectedRoute>} />
            <Route path="/workflows" element={<ProtectedRoute allowedRoles={['hr', 'director', 'ceo', 'admin']}><Workflows /></ProtectedRoute>} />
            <Route path="/workflows/new" element={<ProtectedRoute allowedRoles={['hr', 'director', 'ceo', 'admin']}><WorkflowEditor /></ProtectedRoute>} />
            <Route path="/workflows/:id/edit" element={<ProtectedRoute allowedRoles={['hr', 'director', 'ceo', 'admin']}><WorkflowEditor /></ProtectedRoute>} />
            <Route path="/policies" element={<ProtectedRoute allowedRoles={['hr', 'director', 'ceo', 'admin']}><LeavePolicies /></ProtectedRoute>} />
            <Route path="/holidays" element={<ProtectedRoute allowedRoles={['hr', 'director', 'ceo', 'admin']}><HolidayManagement /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute allowedRoles={['hr', 'director', 'ceo', 'admin']}><Analytics /></ProtectedRoute>} />
            <Route path="/employee-stats" element={<ProtectedRoute allowedRoles={['hr', 'director', 'ceo', 'admin']}><EmployeeStats /></ProtectedRoute>} />
            <Route path="/ceo/dashboard" element={<ProtectedRoute allowedRoles={['hr','director','ceo','admin']}><CEODashboard /></ProtectedRoute>} />
            <Route path="/projects/new" element={<ProtectedRoute allowedRoles={['hr','director','ceo','admin']}><ProjectNew /></ProtectedRoute>} />
            <Route path="/projects/:id/suggestions" element={<ProtectedRoute allowedRoles={['hr','director','ceo','admin']}><ProjectSuggestions /></ProtectedRoute>} />
            <Route path="/calendar" element={<ProtectedRoute><ProjectCalendar /></ProtectedRoute>} />
            {/* Admin page: login required; backend enforces superadmin */}
            <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
            
            {/* Common routes */}
            <Route path="/timesheets" element={<ProtectedRoute><Timesheets /></ProtectedRoute>} />
            <Route path="/timesheet-approvals" element={<ProtectedRoute allowedRoles={['manager', 'hr', 'director', 'ceo', 'admin']}><TimesheetApprovals /></ProtectedRoute>} />
            <Route path="/leaves" element={<ProtectedRoute><LeaveRequests /></ProtectedRoute>} />
            <Route path="/org-chart" element={<ProtectedRoute><OrgChart /></ProtectedRoute>} />
            <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
            <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/appraisals" element={<ProtectedRoute allowedRoles={['manager', 'hr', 'director', 'ceo', 'admin']}><Appraisals /></ProtectedRoute>} />
            <Route path="/my-appraisal" element={<ProtectedRoute><MyAppraisal /></ProtectedRoute>} />
            <Route path="/shifts" element={<ProtectedRoute allowedRoles={['hr', 'director', 'ceo', 'admin']}><ShiftManagement /></ProtectedRoute>} />
            <Route path="/ai-assistant" element={<ProtectedRoute><AIAssistantPage /></ProtectedRoute>} />
            <Route path="/attendance/upload" element={<ProtectedRoute allowedRoles={['hr', 'director', 'ceo', 'admin', 'accountant']}><AttendanceUpload /></ProtectedRoute>} />
            <Route path="/attendance/history" element={<ProtectedRoute allowedRoles={['hr', 'director', 'ceo', 'admin', 'accountant']}><AttendanceUploadHistory /></ProtectedRoute>} />
            <Route path="/payroll" element={<ProtectedRoute allowedRoles={['accountant', 'ceo', 'admin']}><Payroll /></ProtectedRoute>} />
            <Route path="/tax/declaration" element={<ProtectedRoute><TaxDeclaration /></ProtectedRoute>} />
            <Route path="/tax/declarations/review" element={<ProtectedRoute allowedRoles={['hr', 'director', 'ceo', 'admin', 'accountant']}><TaxDeclarationReview /></ProtectedRoute>} />
            <Route path="/reports/form16" element={<ProtectedRoute><Form16 /></ProtectedRoute>} />
            <Route path="/payroll/adjustments" element={<ProtectedRoute allowedRoles={['accountant', 'ceo', 'admin']}><PayrollAdjustments /></ProtectedRoute>} />
            <Route path="/background-checks" element={<ProtectedRoute allowedRoles={['hr', 'director', 'ceo', 'admin']}><BackgroundChecks /></ProtectedRoute>} />
            <Route path="/terminations" element={<ProtectedRoute allowedRoles={['hr', 'director', 'ceo', 'admin']}><Terminations /></ProtectedRoute>} />
            <Route path="/documents" element={<ProtectedRoute><DocumentInbox /></ProtectedRoute>} />
            <Route path="/offboarding/new" element={<ProtectedRoute><OffboardingNew /></ProtectedRoute>} />
            <Route path="/offboarding/policies" element={<ProtectedRoute allowedRoles={['hr', 'ceo', 'admin']}><OffboardingPolicies /></ProtectedRoute>} />
            <Route path="/offboarding" element={<ProtectedRoute allowedRoles={['hr', 'director', 'ceo', 'admin', 'manager']}><OffboardingQueue /></ProtectedRoute>} />
            <Route path="/offboarding/:id" element={<ProtectedRoute><OffboardingDetail /></ProtectedRoute>} />
            
            {/* Multi-tenant routes */}
            <Route path="/onboarding/enhanced" element={<ProtectedRoute><OnboardingEnhanced /></ProtectedRoute>} />
            <Route path="/policies/management" element={<ProtectedRoute allowedRoles={['hr', 'director', 'ceo', 'admin']}><PoliciesManagement /></ProtectedRoute>} />
            <Route path="/promotion/cycles" element={<ProtectedRoute><PromotionCycles /></ProtectedRoute>} />
            
            {/* Redirects */}
            <Route path="/" element={<Navigate to="/dashboard" />} />
            
            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
