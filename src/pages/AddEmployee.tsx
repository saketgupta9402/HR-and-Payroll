import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { z } from "zod";

const employeeSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  email: z.string().trim().email("Invalid email").max(255),
  employeeId: z.string().trim().min(1, "Employee ID is required").max(50),
  department: z.string().trim().min(1, "Department is required"),
  position: z.string().trim().min(1, "Position is required"),
  workLocation: z.string().trim().min(1, "Work location is required"),
  joinDate: z.string().min(1, "Join date is required"),
  reportingManagerId: z.string().optional(),
  role: z.enum(['employee', 'manager', 'hr', 'director', 'ceo']),
});

export default function AddEmployee() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [managers, setManagers] = useState<Array<{ id: string; name: string }>>([]);
  
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    employeeId: "",
    department: "",
    position: "",
    workLocation: "",
    joinDate: "",
    reportingManagerId: "",
    role: "employee" as const,
  });

  useEffect(() => {
    fetchManagers();
  }, []);

  const fetchManagers = async () => {
    try {
      const employees = await api.getEmployees();
      const managersList = employees
        .filter((emp: any) => {
          // Robust filter:
          // 1. Must be active
          // 2. Must have an id (not null, not undefined)
          // 3. The id, when converted to a string, must not be empty.
          return emp.status === 'active' &&
                 emp.id !== null &&
                 emp.id !== undefined &&
                 String(emp.id).trim() !== '';
        })
        .map((emp: any) => ({
          id: emp.id,
          // Add fallback name in case profile is empty
          name: `${emp.profiles?.first_name || ''} ${emp.profiles?.last_name || ''}`.trim() || String(emp.id),
        }));
      setManagers(managersList);
    } catch (error) {
      console.error('Error fetching managers:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Validate form data
      const validated = employeeSchema.parse(formData);
      setLoading(true);

      // Call API to create employee
      const result = await api.createEmployee(validated);

      if (result.error) {
        throw new Error(result.error);
      }

      toast({
        title: "Employee added successfully",
        description: `${result.email || validated.email} can now use "First Time Login" on the login page`,
        duration: 5000,
      });

      // Refresh employees list before navigating
      setTimeout(() => {
        navigate('/employees');
      }, 500);
    } catch (error: any) {
      console.error('Error adding employee:', error);
      toast({
        title: "Error adding employee",
        description: error.message || error.error || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-3xl font-bold">Add Employee</h1>
          <p className="text-muted-foreground">Create a new employee account</p>
        </div>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Employee Information</CardTitle>
              <CardDescription>Enter the employee's basic details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employeeId">Employee ID *</Label>
                  <Input
                    id="employeeId"
                    value={formData.employeeId}
                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="department">Department *</Label>
                  <Input
                    id="department"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="position">Position *</Label>
                  <Input
                    id="position"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="workLocation">Work Location *</Label>
                  <Input
                    id="workLocation"
                    value={formData.workLocation}
                    onChange={(e) => setFormData({ ...formData, workLocation: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="joinDate">Join Date *</Label>
                  <Input
                    id="joinDate"
                    type="date"
                    value={formData.joinDate}
                    onChange={(e) => setFormData({ ...formData, joinDate: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="reportingManagerId">Reporting Manager</Label>
                  <Select
                    value={formData.reportingManagerId}
                    onValueChange={(value) => setFormData({ ...formData, reportingManagerId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select manager" />
                    </SelectTrigger>
                    <SelectContent>
                      {managers.map((manager) => (
                        <SelectItem key={manager.id} value={manager.id}>
                          {manager.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role *</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value: any) => setFormData({ ...formData, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="hr">HR</SelectItem>
                      <SelectItem value="director">Director</SelectItem>
                      <SelectItem value="ceo">CEO</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <Button type="submit" disabled={loading}>
                  {loading ? "Creating..." : "Create Employee"}
                </Button>
                <Button type="button" variant="outline" onClick={() => navigate('/employees')}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </AppLayout>
  );
}
