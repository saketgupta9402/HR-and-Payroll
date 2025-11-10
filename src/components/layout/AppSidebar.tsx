import { 
  LayoutDashboard,
  Users,
  FileText,
  Calendar,
  Clock,
  Workflow,
  Settings,
  BarChart3,
  Building2,
  Network,
  UserCheck,
  CalendarClock,
  Award,
  Bot,
  CheckSquare,
  Upload,
  History,
  DollarSign,
  Search,
  UserX,
  Inbox,
  LogOut,
  ClipboardList,
  Receipt,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

// Navigation items for different roles
const hrItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, showBadge: false },
  { title: "My Profile", url: "/my/profile", icon: Users, showBadge: false },
  { title: "Employees", url: "/employees", icon: Users, showBadge: false },
  { title: "Onboarding", url: "/onboarding-tracker", icon: UserCheck, showBadge: false },
  { title: "Offboarding", url: "/offboarding", icon: LogOut, showBadge: false },
  { title: "Background Checks", url: "/background-checks", icon: Search, showBadge: false },
  { title: "Terminations & Rehires", url: "/terminations", icon: UserX, showBadge: false },
  { title: "Org Chart", url: "/org-chart", icon: Network, showBadge: false },
  { title: "Timesheets", url: "/timesheets", icon: Clock, showBadge: false },
  { title: "Timesheet Approvals", url: "/timesheet-approvals", icon: CheckSquare, showBadge: true },
  { title: "Leave Requests", url: "/leaves", icon: Calendar, showBadge: true },
  { title: "Shift Management", url: "/shifts", icon: CalendarClock, showBadge: false },
  { title: "Attendance Upload", url: "/attendance/upload", icon: Upload, showBadge: false },
  { title: "Upload History", url: "/attendance/history", icon: History, showBadge: false },
  { title: "Workflows", url: "/workflows", icon: Workflow, showBadge: false },
  { title: "Skills", url: "/profile/skills", icon: Award, showBadge: false },
  { title: "New Project", url: "/projects/new", icon: Building2, showBadge: false },
  { title: "CEO Dashboard", url: "/ceo/dashboard", icon: BarChart3, showBadge: false },
  { title: "Project Calendar", url: "/calendar", icon: CalendarClock, showBadge: false },
  { title: "Holiday Management", url: "/holidays", icon: Calendar, showBadge: false },
  { title: "Leave Policies", url: "/policies", icon: FileText, showBadge: false },
  { title: "Tax Declarations", url: "/tax/declarations/review", icon: Receipt, showBadge: false },
  { title: "Form 16", url: "/reports/form16", icon: Receipt, showBadge: false },
  { title: "Offboarding Policies", url: "/offboarding/policies", icon: ClipboardList, showBadge: false },
  { title: "Analytics", url: "/analytics", icon: BarChart3, showBadge: false },
  { title: "Employee Stats", url: "/employee-stats", icon: Users, showBadge: false },
  { title: "AI Assistant", url: "/ai-assistant", icon: Bot, showBadge: false },
  { title: "Payroll", url: "/payroll", icon: DollarSign, showBadge: false, isExternal: true, sso: true },
];

const managerItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, showBadge: false },
  { title: "My Profile", url: "/my/profile", icon: Users, showBadge: false },
  { title: "My Team", url: "/employees", icon: Users, showBadge: false },
  { title: "Offboarding", url: "/offboarding", icon: LogOut, showBadge: false },
  { title: "Org Chart", url: "/org-chart", icon: Network, showBadge: false },
  { title: "Timesheets", url: "/timesheets", icon: Clock, showBadge: false },
  { title: "Timesheet Approvals", url: "/timesheet-approvals", icon: CheckSquare, showBadge: true },
  { title: "Leave Requests", url: "/leaves", icon: Calendar, showBadge: true },
  { title: "Project Calendar", url: "/calendar", icon: CalendarClock, showBadge: false },
  { title: "Appraisals", url: "/appraisals", icon: Award, showBadge: false },
  { title: "Tax Declaration", url: "/tax/declaration", icon: Receipt, showBadge: false },
  { title: "Form 16", url: "/reports/form16", icon: Receipt, showBadge: false },
  { title: "AI Assistant", url: "/ai-assistant", icon: Bot, showBadge: false },
  { title: "Payroll", url: "/payroll", icon: DollarSign, showBadge: false, isExternal: true, sso: true },
];

const employeeItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, showBadge: false },
  { title: "My Profile", url: "/my/profile", icon: Users, showBadge: false },
  { title: "My Timesheets", url: "/timesheets", icon: Clock, showBadge: false },
  { title: "Leave Requests", url: "/leaves", icon: Calendar, showBadge: false },
  { title: "Request Resignation", url: "/offboarding/new", icon: LogOut, showBadge: false },
  { title: "Documents", url: "/documents", icon: Inbox, showBadge: false },
  { title: "Project Calendar", url: "/calendar", icon: CalendarClock, showBadge: false },
  { title: "Org Chart", url: "/org-chart", icon: Network, showBadge: false },
  { title: "My Appraisal", url: "/my-appraisal", icon: Award, showBadge: false },
  { title: "Tax Declaration", url: "/tax/declaration", icon: Receipt, showBadge: false },
  { title: "Form 16", url: "/reports/form16", icon: Receipt, showBadge: false },
  { title: "AI Assistant", url: "/ai-assistant", icon: Bot, showBadge: false },
  { title: "Payroll", url: "/payroll", icon: DollarSign, showBadge: false, isExternal: true, sso: true },
];

export function AppSidebar() {
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const [pendingCounts, setPendingCounts] = useState<{ timesheets: number; leaves: number }>({
    timesheets: 0,
    leaves: 0,
  });
  const [organization, setOrganization] = useState<{ name: string; logo_url: string | null } | null>(null);
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [payrollIntegrationEnabled, setPayrollIntegrationEnabled] = useState(true); // Default to true

  useEffect(() => {
    // Check if Payroll integration is enabled (default to true)
    // Set to false by setting VITE_PAYROLL_INTEGRATION_ENABLED=false
    const enabled = import.meta.env.VITE_PAYROLL_INTEGRATION_ENABLED !== 'false';
    setPayrollIntegrationEnabled(enabled);
    console.log('Payroll integration enabled:', enabled);
    
    if (user) {
      fetchOrganization();
      fetchIsSuperadmin();
      
      if (userRole && ['manager', 'hr', 'director', 'ceo', 'admin'].includes(userRole)) {
        fetchPendingCounts();
        
        // Poll for updates every 30 seconds (replaces realtime)
        const interval = setInterval(() => {
          fetchPendingCounts();
        }, 30000);

        return () => {
          clearInterval(interval);
        };
      }
    }
  }, [user, userRole]);

  const fetchOrganization = async () => {
    if (!user) return;

    try {
      const org = await api.getOrganization();
      if (org) {
        setOrganization(org);
      }
    } catch (error) {
      console.error('Error fetching organization:', error);
    }
  };

  const fetchIsSuperadmin = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/access`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      setIsSuperadmin(!!data.superadmin);
    } catch (e) {
      // ignore
    }
  };

  const fetchPendingCounts = async () => {
    if (!user) return;

    try {
      const counts = await api.getPendingCounts();
      setPendingCounts({
        timesheets: counts.timesheets || 0,
        leaves: counts.leaves || 0,
      });
    } catch (error) {
      console.error('Error fetching pending counts:', error);
    }
  };
  
  // Determine which navigation items to show based on role
  const getNavigationItems = () => {
    switch (userRole) {
      case 'ceo':
      case 'director':
      case 'hr':
      case 'admin':
        return hrItems;
      case 'manager':
        return managerItems;
      case 'accountant':
        return [
          { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, showBadge: false },
          { title: "Payroll", url: "/payroll", icon: DollarSign, showBadge: false, isExternal: true, sso: true },
          { title: "Tax Declarations", url: "/tax/declarations/review", icon: Receipt, showBadge: false },
          { title: "Form 16", url: "/reports/form16", icon: Receipt, showBadge: false },
          { title: "Attendance Upload", url: "/attendance/upload", icon: Upload, showBadge: false },
          { title: "Upload History", url: "/attendance/history", icon: History, showBadge: false },
        ];
      case 'employee':
      default:
        return employeeItems;
    }
  };
  
  const navigationItems = getNavigationItems();
  
  // Debug: Log what menu items are being shown
  if (navigationItems && navigationItems.length > 0) {
    console.log('✅ Navigation items loaded:', navigationItems.map(i => i.title));
    console.log('✅ User role:', userRole);
    const hasApprovals = navigationItems.some(item => item.title === 'Timesheet Approvals');
    console.log('✅ Has Timesheet Approvals:', hasApprovals);
  } else {
    console.warn('⚠️ No navigation items found! User role:', userRole);
  }

  const getBadgeCount = (url: string) => {
    if (url === '/timesheet-approvals') return pendingCounts.timesheets;
    if (url === '/leaves') return pendingCounts.leaves;
    return 0;
  };

  // Get organization name abbreviation (ZM) or first two letters
  const getLogoText = () => {
    if (organization?.name) {
      const words = organization.name.split(' ');
      if (words.length >= 2) {
        return (words[0][0] + words[1][0]).toUpperCase();
      }
      return organization.name.substring(0, 2).toUpperCase();
    }
    return 'ZM';
  };

  return (
    <Sidebar className="bg-slate-900 border-r border-slate-800">
      <SidebarHeader className="border-b border-slate-800 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            {organization?.logo_url ? (
              <div className="relative h-12 w-12 rounded-lg overflow-hidden border border-slate-700 shadow-sm bg-slate-800">
                <img 
                  src={organization.logo_url} 
                  alt={organization.name || 'Organization'}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div className="h-12 w-12 rounded-lg bg-blue-600 border border-slate-700 flex items-center justify-center shadow-sm">
                <span className="text-white font-bold text-lg">{getLogoText()}</span>
              </div>
            )}
          </div>
          <div className="hidden lg:block min-w-0 flex-1">
            <h2 className="text-lg font-bold text-white leading-tight truncate">
              {getLogoText()}
            </h2>
            <p className="text-xs text-slate-400 leading-tight mt-1">Powered by AI</p>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent className="px-2 py-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems && navigationItems.length > 0 ? (
                navigationItems.map((item) => {
                  const badgeCount = item.showBadge ? getBadgeCount(item.url) : 0;
                  const isPayrollSso = (item as any).sso === true;
                  
                  // Skip Payroll if integration is not enabled
                  if (isPayrollSso && !payrollIntegrationEnabled) {
                    return null;
                  }
                  
                  // Handle Payroll SSO separately
                  if (isPayrollSso) {
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild>
                          <button
                            onClick={async () => {
                              try {
                                const result = await api.getPayrollSso();
                                if (result.redirectUrl) {
                                  window.open(result.redirectUrl, '_blank');
                                } else {
                                  toast({
                                    title: "Error",
                                    description: "Failed to generate Payroll SSO link",
                                    variant: "destructive",
                                  });
                                }
                              } catch (error: any) {
                                console.error('Payroll SSO error:', error);
                                toast({
                                  title: "Error",
                                  description: error.message || "Failed to access Payroll",
                                  variant: "destructive",
                                });
                              }
                            }}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-slate-300 hover:bg-slate-800 hover:text-white w-full text-left"
                          >
                            <item.icon className="h-4 w-4 shrink-0" />
                            <span className="flex-1 text-sm">{item.title}</span>
                            {badgeCount > 0 && (
                              <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-medium text-white shrink-0">
                                {badgeCount > 9 ? '9+' : badgeCount}
                              </span>
                            )}
                          </button>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  }
                  
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink 
                          to={item.url}
                          className={({ isActive }) => 
                            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                              isActive 
                                ? "bg-slate-800 text-white" 
                                : "text-slate-300 hover:bg-slate-800 hover:text-white"
                            }`
                          }
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span className="flex-1 text-sm">{item.title}</span>
                          {badgeCount > 0 && (
                            <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-medium text-white shrink-0">
                              {badgeCount > 9 ? '9+' : badgeCount}
                            </span>
                          )}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })
              ) : (
                <SidebarMenuItem>
                  <div className="px-3 py-2 text-sm text-slate-400">
                    Loading menu items...
                  </div>
                </SidebarMenuItem>
              )}
              {isSuperadmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to="/admin"
                      className={({ isActive }) => 
                        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                          isActive 
                            ? "bg-slate-800 text-white" 
                            : "text-slate-300 hover:bg-slate-800 hover:text-white"
                        }`
                      }
                    >
                      <BarChart3 className="h-4 w-4" />
                      <span>Admin</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink 
                    to="/settings"
                    className={({ isActive }) => 
                      `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                        isActive 
                          ? "bg-slate-800 text-white" 
                          : "text-slate-300 hover:bg-slate-800 hover:text-white"
                      }`
                    }
                  >
                    <Settings className="h-4 w-4" />
                    <span>Settings</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}