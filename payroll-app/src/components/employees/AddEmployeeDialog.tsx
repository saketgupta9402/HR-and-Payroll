import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
// Import our API client (using the correct path alias)
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface AddEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // tenantId is no longer needed
}

// Initial state for resetting the form
const initialState = {
  employee_code: "",
  full_name: "",
  email: "",
  phone: "",
  date_of_joining: "",
  date_of_birth: "",
  department: "",
  designation: "",
  status: "active" as const,
  pan_number: "",
  aadhaar_number: "",
  bank_account_number: "",
  bank_ifsc: "",
  bank_name: "",
};

export const AddEmployeeDialog = ({ open, onOpenChange }: AddEmployeeDialogProps) => {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState(initialState);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // --- THIS IS THE FIX ---
      // Use the structured api.employees.create() method,
      // which calls the correct "/api/employees" endpoint.
      await api.employees.create(formData);
      // ---------------------

      toast.success("Employee added successfully!");
      queryClient.invalidateQueries({ queryKey: ["employees"] }); // Invalidate the employee list
      onOpenChange(false);
      
      // Reset form
      setFormData(initialState);

    } catch (error: any) {
      console.error("Error adding employee:", error);
      // The backend will send a specific error message for duplicates
      toast.error(error.message || "Failed to add employee");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        setFormData(initialState); // Reset form if dialog is closed
      }
      onOpenChange(isOpen);
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Employee</DialogTitle>
          <DialogDescription>
            Fill in the employee details below. Required fields are marked with *
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Basic Info */}
            <div className="space-y-2">
              <Label htmlFor="employee_code">
                Employee Code <span className="text-destructive">*</span>
              </Label>
              <Input
                id="employee_code"
                value={formData.employee_code}
                onChange={(e) => setFormData({ ...formData, employee_code: e.target.value })}
                required
                placeholder="EMP001"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="full_name">
                Full Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                required
                placeholder="John Doe"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                placeholder="john@company.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+91 98765 43210"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date_of_joining">
                Date of Joining <span className="text-destructive">*</span>
              </Label>
              <Input
                id="date_of_joining"
                type="date"
                value={formData.date_of_joining}
                onChange={(e) => setFormData({ ...formData, date_of_joining: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date_of_birth">Date of Birth</Label>
              <Input
                id="date_of_birth"
                type="date"
                value={formData.date_of_birth}
                onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                placeholder="Engineering"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="designation">Designation</Label>
              <Input
                id="designation"
                value={formData.designation}
                onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                placeholder="Software Engineer"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: any) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="on_leave">On Leave</SelectItem>
                  <SelectItem value="terminated">Terminated</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pan_number">PAN Number</Label>
              <Input
                id="pan_number"
                value={formData.pan_number}
                onChange={(e) => setFormData({ ...formData, pan_number: e.target.value.toUpperCase() })}
                placeholder="ABCDE1234F"
                maxLength={10}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="aadhaar_number">Aadhaar Number</Label>
              <Input
                id="aadhaar_number"
                value={formData.aadhaar_number}
                onChange={(e) => setFormData({ ...formData, aadhaar_number: e.target.value })}
                placeholder="1234 5678 9012"
                maxLength={12}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bank_name">Bank Name</Label>
              <Input
                id="bank_name"
                value={formData.bank_name}
                onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                placeholder="HDFC Bank"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bank_account_number">Bank Account Number</Label>
              <Input
                id="bank_account_number"
                value={formData.bank_account_number}
                onChange={(e) => setFormData({ ...formData, bank_account_number: e.target.value })}
                placeholder="123456789012"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bank_ifsc">IFSC Code</Label>
              <Input
                id="bank_ifsc"
                value={formData.bank_ifsc}
                onChange={(e) => setFormData({ ...formData, bank_ifsc: e.target.value.toUpperCase() })}
                placeholder="HDFC0001234"
                maxLength={11}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Employee"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};


