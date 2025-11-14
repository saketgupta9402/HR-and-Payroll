import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// Use the new API client
import { api } from "../lib/api";
import { DollarSign, LogOut, Receipt, FileText, Key } from "lucide-react";
// Use sonner for toasts, consistent with other components
import { toast } from "sonner";
// Import the child components
import { EmployeeSalaryStructure } from "@/components/employees/EmployeeSalaryStructure";
import { PayslipsTab } from "@/components/employee-portal/PayslipsTab";
import { TaxDeclarationsTab } from "@/components/employee-portal/TaxDeclarationsTab";
import { TaxDocumentsTab } from "@/components/employee-portal/TaxDocumentsTab";
import { ReimbursementsTab } from "@/components/employee-portal/ReimbursementsTab";
// Leave and Attendance removed - handled by HR system

const EmployeePortal = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [employee, setEmployee] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async (retryCount = 0) => {
      try {
        // Wait a moment for cookies to be available (they might be set by redirect)
        // This is especially important when coming from PIN verification
        if (retryCount === 0) {
          // First attempt - wait a bit for cookies to be set
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Check for session and PIN cookies (cookie-based auth)
        // Note: httpOnly cookies won't be accessible via document.cookie
        // So we'll try to make an API call - if it succeeds, cookies are set
        // If it fails with 401, cookies are missing
        
        console.log('[EmployeePortal] Attempting to load data (retry:', retryCount, ')');
        
        // Try to get user info from API - this will fail if cookies aren't set
        let profile: any = null;
        try {
          profile = await api.me.profile();
          console.log('[EmployeePortal] Successfully fetched profile, cookies are set');
          if (profile?.profile?.id) {
            setUser({ id: profile.profile.id });
          } else {
            setUser({ id: 'unknown' }); // Fallback
          }
        } catch (error: any) {
          // If unauthorized, cookies might not be set yet
          if (error.message && error.message.includes("Unauthorized")) {
            if (retryCount < 3) {
              console.log('[EmployeePortal] Unauthorized, waiting for cookies... (retry:', retryCount + 1, ')');
              setTimeout(() => {
                fetchData(retryCount + 1);
              }, 1000); // Wait 1 second for cookies to be available
              return;
            } else {
              // Still unauthorized after retries, redirect to pin-auth
              console.log('[EmployeePortal] Still unauthorized after retries, redirecting to pin-auth');
              navigate("/pin-auth");
              return;
            }
          } else {
            // Other error, set fallback
            setUser({ id: 'unknown' }); // Fallback if API fails
          }
        }

        const me = await api.me.employee();
        if (me.employee) {
          setEmployee(me.employee);
        } else {
          // This user is not an employee, check role and redirect accordingly
          const profile = await api.me.profile();
          const payrollRole = profile?.profile?.payroll_role || 'payroll_employee';
          const redirectPath = payrollRole === 'payroll_admin' ? '/employees' : '/employee-portal';
          console.log('[EmployeePortal] User is not an employee, role:', payrollRole, 'redirecting to:', redirectPath);
          navigate(redirectPath, { replace: true });
          return;
        }
      } catch (error: any) {
        toast.error(`Session error: ${error.message}`);
        navigate("/pin-auth");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate]);

  const handleSignOut = async () => {
    try {
      await api.auth.logout();
      toast.success("Signed out successfully");
      navigate("/pin-auth");
    } catch (error: any) {
      toast.error(`Sign out failed: ${error.message}`);
    }
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
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Employee Portal</h1>
              <p className="text-muted-foreground">Welcome, {employee?.full_name || user?.id}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => navigate("/change-pin")}>
                <Key className="mr-2 h-4 w-4" />
                Change PIN
              </Button>
              <Button variant="ghost" onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {!employee ? (
          <Card>
            <CardHeader>
              <CardTitle>Profile Not Found</CardTitle>
              <CardDescription>
                Your employee profile is not set up yet. Please contact HR.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="salary">Salary</TabsTrigger>
              <TabsTrigger value="payslips">Payslips</TabsTrigger>
              <TabsTrigger value="declarations">Declarations</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="reimbursements">Reimbursements</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Welcome to Your Portal</CardTitle>
                  <CardDescription>Quick overview of your employee information</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Employee Code</p>
                      <p className="font-semibold">{employee.employee_code}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-semibold">{employee.email}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Department</p>
                      <p className="font-semibold">{employee.department || "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Designation</p>
                      <p className="font-semibold">{employee.designation || "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Date of Joining</p>
                      <p className="font-semibold">
                        {new Date(employee.date_of_joining).toLocaleDateString("en-IN")}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <p className="font-semibold capitalize">{employee.status}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/*
              Remove employeeId and tenantId props. The components now
              fetch their own data using the session cookie.
            */}

            <TabsContent value="salary">
              <EmployeeSalaryStructure />
            </TabsContent>

            <TabsContent value="payslips">
              <PayslipsTab />
            </TabsContent>

            <TabsContent value="declarations">
              <TaxDeclarationsTab />
            </TabsContent>

            <TabsContent value="documents">
              <TaxDocumentsTab />
            </TabsContent>

            <TabsContent value="reimbursements">
              <ReimbursementsTab />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
};

export default EmployeePortal;
