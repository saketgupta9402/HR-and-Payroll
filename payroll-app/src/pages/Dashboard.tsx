import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
// Updated import path
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, IndianRupee, FileText, LogOut, PlusCircle, Calendar, CheckCircle2, Clock, Key, Receipt } from "lucide-react";
import { toast } from "sonner";

// Define a type for the profile state
interface UserProfile {
  email: string;
  full_name: string;
  tenant_id: string;
  payroll_role?: string;
  first_name?: string;
  last_name?: string;
  hr_user_id?: string;
}

interface EmployeeData {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  employee_code?: string;
  department?: string;
  designation?: string;
  status?: string;
  date_of_joining?: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<{ id: string } | null>(null);
  // Add state for the user's profile
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [employee, setEmployee] = useState<EmployeeData | null>(null);
  const [payrollRole, setPayrollRole] = useState<string>('payroll_employee');
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState<string>("Loading...");
  const [companyLogo, setCompanyLogo] = useState<string>("");
  const [hrRole, setHrRole] = useState<string>("");
  const [stats, setStats] = useState({
    totalEmployees: 0,
    monthlyPayroll: 0,
    pendingApprovals: 0,
    activeCycles: 0,
    totalNetPayable: 0,
    completedCycles: 0,
    totalAnnualPayroll: 0
  });
  const [recentCycles, setRecentCycles] = useState<any[]>([]);

  useEffect(() => {
    // Use API call to check authentication instead of reading cookies
    // Cookies are httpOnly, so we can't read them with document.cookie
    const checkAuthAndLoad = async () => {
      try {
        // Try to get user info from API - if this succeeds, user is authenticated
        // The API will fail if cookies aren't set, so we can use that to determine auth status
        const res: any = await api.me.profile();
        if (res?.profile?.id) {
          setUser({ id: res.profile.id });
          setProfile(res.profile);
          
          // Check role - if employee, redirect to employee portal
          const role = res.profile.payroll_role || 'payroll_employee';
          setPayrollRole(role);
          
          if (role === 'payroll_employee') {
            // Employee should see employee portal, not admin dashboard
            console.log('[Dashboard] User is employee, redirecting to employee-portal');
            navigate("/employee-portal", { replace: true });
            return;
          }
          
          // Admin/HR/CEO can see admin dashboard - continue loading data
          console.log('[Dashboard] User on Dashboard, role:', role, 'showing dashboard content');
          
          // Load dashboard data (tenant, stats, cycles) - profile already fetched above
          try {
            const [tenantRes, statsRes, cyclesRes] = await Promise.all([
              api.dashboard.tenant(),
              api.dashboard.stats(),
              api.dashboard.cycles(),
            ]);

            // Use tenant data from backend (which should have HR data if backend fetched it)
            // Backend handles HR API calls to avoid CORS issues
            if (tenantRes?.tenant?.company_name) {
              // Only set company name if it's not the default 'Organization'
              if (tenantRes.tenant.company_name !== 'Organization') {
                setCompanyName(tenantRes.tenant.company_name);
              } else {
                // Try to get from HR system via backend
                setCompanyName(tenantRes.tenant.company_name);
              }
            }
            
            if (tenantRes?.tenant?.logo_url) {
              setCompanyLogo(tenantRes.tenant.logo_url);
            }

            if (statsRes?.stats) setStats(statsRes.stats);
            if (cyclesRes?.cycles) {
              // Get recent 5 cycles
              setRecentCycles(cyclesRes.cycles.slice(0, 5));
            }

            // Get HR role from profile - backend should provide this in the profile response
            // Check if role is in the profile response from payroll backend
            if (res.profile?.hr_role) {
              console.log('[Dashboard] Setting HR role from profile:', res.profile.hr_role);
              setHrRole(res.profile.hr_role);
            } else if (res.profile?.role) {
              // Fallback to role if hr_role not available
              console.log('[Dashboard] Setting HR role from profile.role:', res.profile.role);
              setHrRole(res.profile.role);
            } else {
              console.log('[Dashboard] No HR role found in profile:', res.profile);
            }
          } catch (dataError: any) {
            console.error('[Dashboard] Error loading dashboard data:', dataError);
            // Don't redirect on data errors - just show what we have
          } finally {
            setLoading(false);
          }
        } else {
          // No profile, redirect to pin-auth
          console.log('[Dashboard] No profile found, redirecting to pin-auth');
          // Store current path to return after PIN auth
          const currentPath = window.location.pathname + window.location.search;
          sessionStorage.setItem('payroll_last_screen', currentPath);
          navigate("/pin-auth");
        }
      } catch (error: any) {
        // If API call fails, check if it's an auth error
        console.error('[Dashboard] Profile fetch failed:', error.message);
        
        // If it's a 401/403, user needs to authenticate
        if (error.message && (error.message.includes('Unauthorized') || error.message.includes('401') || error.message.includes('403') || error.message.includes('API error'))) {
          console.log('[Dashboard] Unauthorized, redirecting to pin-auth');
          // Store current path to return after PIN auth
          const currentPath = window.location.pathname + window.location.search;
          sessionStorage.setItem('payroll_last_screen', currentPath);
          navigate("/pin-auth");
        } else {
          // Other error - still allow dashboard access (might be temporary)
          console.log('[Dashboard] Non-auth error, allowing dashboard access');
          setUser({ id: 'unknown' });
          setLoading(false);
        }
      }
    };

    checkAuthAndLoad();
  }, [navigate]);
  
  // Function to fetch employee data from HR system
  const fetchEmployeeFromHr = async (hrUserId: string, orgId: string) => {
    try {
      // Use profile email to fetch employee from HR
      if (!profile?.email) {
        console.warn('No email in profile to fetch employee from HR');
        return;
      }
      
      const hrApiUrl = import.meta.env.VITE_HR_API_URL || 'http://localhost:3001';
      // Try to fetch employee by email from HR
      const response = await fetch(`${hrApiUrl}/api/employees?email=${encodeURIComponent(profile.email)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        // HR returns an array of employees, find the one matching the email
        const hrEmployee = Array.isArray(data.employees) 
          ? data.employees.find((emp: any) => emp.email === profile.email)
          : data.employee;
        
        if (hrEmployee) {
          // Create employee record in Payroll if it doesn't exist
          try {
            await api.employees.create({
              email: hrEmployee.email || profile.email,
              first_name: hrEmployee.first_name || profile.first_name || '',
              last_name: hrEmployee.last_name || profile.last_name || '',
              employee_code: hrEmployee.employee_code,
              department: hrEmployee.department,
              designation: hrEmployee.designation || hrEmployee.job_title,
              status: hrEmployee.status || 'active',
              date_of_joining: hrEmployee.date_of_joining,
            });
            
            // Fetch the created employee
            const employeeRes: any = await api.me.employee();
            if (employeeRes?.employee) {
              setEmployee(employeeRes.employee);
            }
          } catch (createError: any) {
            console.error('Error creating employee in Payroll:', createError);
            // Still set the employee data from HR for display
            setEmployee({
              id: hrEmployee.id || hrUserId,
              email: hrEmployee.email || profile.email,
              first_name: hrEmployee.first_name || profile.first_name || '',
              last_name: hrEmployee.last_name || profile.last_name || '',
              full_name: hrEmployee.full_name || `${hrEmployee.first_name || profile.first_name || ''} ${hrEmployee.last_name || profile.last_name || ''}`,
              employee_code: hrEmployee.employee_code,
              department: hrEmployee.department,
              designation: hrEmployee.designation || hrEmployee.job_title,
              status: hrEmployee.status || 'active',
              date_of_joining: hrEmployee.date_of_joining,
            });
          }
        }
      }
    } catch (error: any) {
      console.error('Error fetching employee from HR:', error);
      // Silently fail - employee data will be shown as unavailable
    }
  };

  const handleSignOut = async () => {
    await api.auth.logout();
    navigate("/pin-auth");
    toast.success("Signed out successfully");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {companyLogo ? (
              <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-700 shadow-sm bg-slate-800 flex items-center justify-center">
                <img 
                  src={companyLogo}
                  alt={companyName}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    // Fallback to icon if image fails to load
                    e.currentTarget.style.display = 'none';
                    const parent = e.currentTarget.parentElement;
                    if (parent) {
                      parent.innerHTML = '<div class="w-10 h-10 rounded-lg bg-primary flex items-center justify-center"><svg class="w-6 h-6 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg></div>';
                    }
                  }}
                />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                <Building2 className="w-6 h-6 text-primary-foreground" />
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold text-foreground">{companyName}</h1>
              {/* Use the email from the fetched profile */}
              <p className="text-xs text-muted-foreground">{profile?.email || user?.id}</p>
            </div>
          </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => navigate("/change-pin")}>
                    <Key className="mr-2 h-4 w-4" />
                    Change PIN
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </Button>
                </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-2">
            {payrollRole === 'payroll_admin' && hrRole === 'hr' ? 'HR Dashboard' : 
             payrollRole === 'payroll_admin' ? 'Admin Dashboard' : 'Employee Dashboard'}
          </h2>
          <p className="text-muted-foreground">
            {payrollRole === 'payroll_admin' 
              ? 'Manage your payroll operations efficiently' 
              : employee 
                ? `Welcome, ${employee.full_name || employee.first_name || profile?.full_name || profile?.email}` 
                : 'Your payroll information'}
          </p>
        </div>

        {/* Employee Profile Section (for employees) */}
        {payrollRole === 'payroll_employee' && employee && (
          <Card className="mb-8 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="mr-2 h-5 w-5 text-primary" />
                My Profile
              </CardTitle>
              <CardDescription>Your employee information</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Name</p>
                  <p className="text-lg font-semibold">{employee.full_name || `${employee.first_name} ${employee.last_name}`}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Email</p>
                  <p className="text-lg font-semibold">{employee.email}</p>
                </div>
                {employee.employee_code && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Employee Code</p>
                    <p className="text-lg font-semibold">{employee.employee_code}</p>
                  </div>
                )}
                {employee.department && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Department</p>
                    <p className="text-lg font-semibold">{employee.department}</p>
                  </div>
                )}
                {employee.designation && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Designation</p>
                    <p className="text-lg font-semibold">{employee.designation}</p>
                  </div>
                )}
                {employee.status && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Status</p>
                    <p className="text-lg font-semibold capitalize">{employee.status}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Admin Stats Grid (only for admin) */}
        {payrollRole === 'payroll_admin' && (
        <>
        {/* Stats Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalEmployees}</div>
              <p className="text-xs text-muted-foreground">Active employees</p>
            </CardContent>
          </Card>

          <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Payroll</CardTitle>
              <IndianRupee className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{stats.monthlyPayroll.toLocaleString('en-IN')}</div>
              <p className="text-xs text-muted-foreground">Last approved cycle</p>
            </CardContent>
          </Card>

          <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingApprovals}</div>
              <p className="text-xs text-muted-foreground">Awaiting approval</p>
            </CardContent>
          </Card>

          <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed Cycles</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completedCycles}</div>
              <p className="text-xs text-muted-foreground">Processed this year</p>
            </CardContent>
          </Card>
        </div>

        {/* Additional Stats Row */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
          <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Net Payable</CardTitle>
              <IndianRupee className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{stats.totalNetPayable.toLocaleString('en-IN')}</div>
              <p className="text-xs text-muted-foreground">Last processed cycle</p>
            </CardContent>
          </Card>

          <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Annual Payroll</CardTitle>
              <FileText className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{stats.totalAnnualPayroll.toLocaleString('en-IN')}</div>
              <p className="text-xs text-muted-foreground">Total this year</p>
            </CardContent>
          </Card>

          <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Cycles</CardTitle>
              <Clock className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeCycles}</div>
              <p className="text-xs text-muted-foreground">Draft cycles</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Payroll Cycles */}
        {recentCycles.length > 0 && (
          <Card className="mb-8 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="mr-2 h-5 w-5 text-primary" />
                Recent Payroll Cycles
              </CardTitle>
              <CardDescription>Latest payroll processing activity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentCycles.map((cycle: any) => {
                  const monthName = new Date(2000, cycle.month - 1).toLocaleString('en-IN', { month: 'long' });
                  const statusColor = 
                    cycle.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' :
                    cycle.status === 'processing' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' :
                    cycle.status === 'draft' ? 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' :
                    'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
                  
                  return (
                    <div 
                      key={cycle.id} 
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => navigate("/payroll")}
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Calendar className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold">{monthName} {cycle.year}</p>
                          <p className="text-sm text-muted-foreground">
                            {cycle.total_employees || 0} employees • 
                            ₹{(cycle.total_amount || 0).toLocaleString('en-IN')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${statusColor}`}>
                          {cycle.status.replace('_', ' ').toUpperCase()}
                        </span>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  );
                })}
              </div>
              <Button 
                variant="outline" 
                className="w-full mt-4" 
                onClick={() => navigate("/payroll")}
              >
                View All Payroll Cycles
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="shadow-md hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/employees")}>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="mr-2 h-5 w-5 text-primary" />
                Manage Employees
              </CardTitle>
              <CardDescription>Add, edit, or remove employee records</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={(e) => { e.stopPropagation(); navigate("/employees?new=true"); }}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Employee
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-md hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/payroll")}>
            <CardHeader>
              <CardTitle className="flex items-center">
                <IndianRupee className="mr-2 h-5 w-5 text-green-500" />
                Payroll Cycles
              </CardTitle>
              <CardDescription>Create and manage payroll runs</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="secondary" onClick={(e) => { e.stopPropagation(); navigate("/payroll?new=true"); }}>
                <PlusCircle className="mr-2 h-4 w-4" />
                New Payroll Cycle
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-md hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/reports")}>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="mr-2 h-5 w-5 text-blue-500" />
                Reports
              </CardTitle>
              <CardDescription>View payroll and compliance reports</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="outline">
                View Reports
              </Button>
            </CardContent>
          </Card>

          <Card
            className="shadow-md hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => navigate("/approve-reimbursements")}
          >
            <CardHeader>
              <CardTitle className="flex items-center">
                <Receipt className="mr-2 h-5 w-5 text-purple-500" />
                Reimbursements
              </CardTitle>
              <CardDescription>Review and approve expense claims</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate("/approve-reimbursements");
                }}
              >
                Pending Claims
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Getting Started (only for admin) */}
        <Card className="mt-8 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
            <CardDescription>Complete these steps to set up your payroll system</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                1
              </div>
              <p className="text-sm">Add your first employee</p>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-sm font-bold">
                2
              </div>
              <p className="text-sm text-muted-foreground">Configure salary structures</p>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-sm font-bold">
                3
              </div>
              <p className="text-sm text-muted-foreground">Run your first payroll cycle</p>
            </div>
          </CardContent>
        </Card>
        </>
        )}

        {/* Employee Quick Links (only for employees) */}
        {payrollRole === 'payroll_employee' && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-8">
            <Card className="shadow-md hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/employee-portal")}>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="mr-2 h-5 w-5 text-primary" />
                  My Payslips
                </CardTitle>
                <CardDescription>View and download your payslips</CardDescription>
              </CardHeader>
            </Card>

            <Card className="shadow-md hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/employee-portal")}>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <IndianRupee className="mr-2 h-5 w-5 text-green-500" />
                  Salary Structure
                </CardTitle>
                <CardDescription>View your salary breakdown</CardDescription>
              </CardHeader>
            </Card>

            <Card className="shadow-md hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/employee-portal")}>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="mr-2 h-5 w-5 text-blue-500" />
                  Tax Documents
                </CardTitle>
                <CardDescription>Download Form 16 and tax forms</CardDescription>
              </CardHeader>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
