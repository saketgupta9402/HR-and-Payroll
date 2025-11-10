import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { format } from "date-fns";
import { Trash2, Edit2, PlusCircle } from "lucide-react";

interface PayrollRun {
  id: string;
  pay_period_start: string;
  pay_period_end: string;
  status: string;
}

interface Employee {
  id: string;
  first_name?: string;
  last_name?: string;
  employee_id?: string;
}

interface Adjustment {
  id: string;
  employee_id: string;
  component_name: string;
  amount: number;
  is_taxable: boolean;
  notes?: string | null;
  employee?: {
    id: string;
    employee_id?: string;
  };
}

export default function PayrollAdjustments() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | undefined>(() => searchParams.get("runId") || undefined);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoadingRuns, setIsLoadingRuns] = useState(false);
  const [isLoadingAdjustments, setIsLoadingAdjustments] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formState, setFormState] = useState({
    employeeId: "",
    componentName: "",
    amount: "",
    isTaxable: true,
    notes: "",
  });

  useEffect(() => {
    loadRuns();
    loadEmployees();
  }, []);

  useEffect(() => {
    if (selectedRunId) {
      loadAdjustments(selectedRunId);
    } else {
      setAdjustments([]);
    }
  }, [selectedRunId]);

  const loadRuns = async () => {
    try {
      setIsLoadingRuns(true);
      const result = await api.getPayrollRuns({ limit: 100 });
      setRuns(result || []);
      if (!selectedRunId && result?.length) {
        setSelectedRunId(result[0].id);
      }
    } catch (error: any) {
      console.error("Failed to fetch payroll runs", error);
      toast({
        title: "Error",
        description: "Unable to load payroll runs",
        variant: "destructive",
      });
    } finally {
      setIsLoadingRuns(false);
    }
  };

  const loadEmployees = async () => {
    try {
      const result = await api.getEmployees();
      setEmployees(result || []);
    } catch (error: any) {
      console.error("Failed to fetch employees", error);
      toast({
        title: "Error",
        description: "Unable to load employees",
        variant: "destructive",
      });
    }
  };

  const loadAdjustments = async (runId: string) => {
    try {
      setIsLoadingAdjustments(true);
      const result = await api.getPayrollRunAdjustments(runId);
      setAdjustments(result || []);
    } catch (error: any) {
      console.error("Failed to fetch payroll adjustments", error);
      toast({
        title: "Error",
        description: "Unable to load payroll adjustments",
        variant: "destructive",
      });
    } finally {
      setIsLoadingAdjustments(false);
    }
  };

  const handleRunChange = (value: string) => {
    setSelectedRunId(value);
    setEditingId(null);
    setFormState({
      employeeId: "",
      componentName: "",
      amount: "",
      isTaxable: true,
      notes: "",
    });
    navigate(`/payroll/adjustments?runId=${value}`);
  };

  const handleEdit = (adjustment: Adjustment) => {
    setEditingId(adjustment.id);
    setFormState({
      employeeId: adjustment.employee_id,
      componentName: adjustment.component_name,
      amount: adjustment.amount.toString(),
      isTaxable: adjustment.is_taxable,
      notes: adjustment.notes || "",
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setFormState({
      employeeId: "",
      componentName: "",
      amount: "",
      isTaxable: true,
      notes: "",
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedRunId) {
      toast({ title: "Select a run", description: "Choose a payroll run first", variant: "destructive" });
      return;
    }

    if (!formState.employeeId || !formState.componentName || !formState.amount) {
      toast({ title: "Missing info", description: "All fields are required", variant: "destructive" });
      return;
    }

    const amountValue = Number(formState.amount);
    if (Number.isNaN(amountValue)) {
      toast({ title: "Invalid amount", description: "Amount must be a number", variant: "destructive" });
      return;
    }

    try {
      setIsSaving(true);
      if (editingId) {
        await api.updatePayrollRunAdjustment(editingId, {
          component_name: formState.componentName,
          amount: amountValue,
          is_taxable: formState.isTaxable,
          notes: formState.notes || undefined,
        });
        toast({ title: "Adjustment updated", description: "Payroll adjustment updated successfully" });
      } else {
        await api.createPayrollRunAdjustment(selectedRunId, {
          employee_id: formState.employeeId,
          component_name: formState.componentName,
          amount: amountValue,
          is_taxable: formState.isTaxable,
          notes: formState.notes || undefined,
        });
        toast({ title: "Adjustment added", description: "Payroll adjustment added successfully" });
      }
      resetForm();
      loadAdjustments(selectedRunId);
    } catch (error: any) {
      console.error("Failed to save payroll adjustment", error);
      toast({
        title: "Error",
        description: error?.message || "Unable to save payroll adjustment",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (adjustmentId: string) => {
    if (!selectedRunId) return;
    try {
      await api.deletePayrollRunAdjustment(adjustmentId);
      toast({ title: "Adjustment removed", description: "Payroll adjustment deleted" });
      loadAdjustments(selectedRunId);
    } catch (error: any) {
      console.error("Failed to delete payroll adjustment", error);
      toast({
        title: "Error",
        description: error?.message || "Unable to delete payroll adjustment",
        variant: "destructive",
      });
    }
  };

  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedRunId),
    [runs, selectedRunId]
  );

  const employeeOptions = useMemo(() => {
    return employees.map((employee) => ({
      value: employee.id,
      label:
        employee.employee_id ||
        [employee.first_name, employee.last_name].filter(Boolean).join(" ") ||
        "Unnamed Employee",
    }));
  }, [employees]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Payroll Adjustments</h1>
            <p className="text-muted-foreground">
              Add one-time earnings or deductions before processing a payroll run.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Select Payroll Run</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="run">Payroll Run</Label>
              <Select
                value={selectedRunId}
                onValueChange={handleRunChange}
                disabled={isLoadingRuns || runs.length === 0}
              >
                <SelectTrigger id="run">
                  <SelectValue placeholder="Select a payroll run" />
                </SelectTrigger>
                <SelectContent>
                  {runs.map((run) => (
                    <SelectItem key={run.id} value={run.id}>
                      {format(new Date(run.pay_period_start), "MMM d")} -{" "}
                      {format(new Date(run.pay_period_end), "MMM d, yyyy")} ({run.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedRun && (
              <div className="flex flex-col justify-center">
                <Badge variant={selectedRun.status === "draft" ? "default" : "secondary"} className="w-fit">
                  Run Status: {selectedRun.status}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit Adjustment" : "Add Adjustment"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" onSubmit={handleSubmit}>
              <div className="md:col-span-1">
                <Label htmlFor="employee">Employee</Label>
                <Select
                  value={formState.employeeId}
                  onValueChange={(value) => setFormState((prev) => ({ ...prev, employeeId: value }))}
                  disabled={!!editingId}
                >
                  <SelectTrigger id="employee">
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employeeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-1">
                <Label htmlFor="componentName">Component Name</Label>
                <Input
                  id="componentName"
                  value={formState.componentName}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, componentName: event.target.value }))
                  }
                  placeholder="Bonus, Conveyance, etc."
                  required
                />
              </div>

              <div className="md:col-span-1">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  value={formState.amount}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, amount: event.target.value }))
                  }
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="md:col-span-1 flex items-center gap-2">
                <Switch
                  id="isTaxable"
                  checked={formState.isTaxable}
                  onCheckedChange={(checked) =>
                    setFormState((prev) => ({ ...prev, isTaxable: checked }))
                  }
                />
                <Label htmlFor="isTaxable">Taxable adjustment</Label>
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Input
                  id="notes"
                  value={formState.notes}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, notes: event.target.value }))
                  }
                />
              </div>

              <div className="md:col-span-3 flex items-center gap-2">
                <Button type="submit" disabled={isSaving || !selectedRunId}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  {editingId ? "Update Adjustment" : "Add Adjustment"}
                </Button>
                {editingId && (
                  <Button type="button" variant="ghost" onClick={resetForm}>
                    Cancel Edit
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Adjustments</CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedRunId ? (
              <div className="text-muted-foreground">Select a payroll run above to view adjustments.</div>
            ) : isLoadingAdjustments ? (
              <div className="text-muted-foreground">Loading adjustments...</div>
            ) : adjustments.length === 0 ? (
              <div className="text-muted-foreground">No adjustments added for this payroll run yet.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Component</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Taxable</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adjustments.map((adjustment) => (
                    <TableRow key={adjustment.id}>
                      <TableCell>
                        {adjustment.employee?.employee_id ||
                          employees.find((emp) => emp.id === adjustment.employee_id)?.employee_id ||
                          "Employee"}
                      </TableCell>
                      <TableCell>{adjustment.component_name}</TableCell>
                      <TableCell>₹{Number(adjustment.amount || 0).toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant={adjustment.is_taxable ? "default" : "secondary"}>
                          {adjustment.is_taxable ? "Taxable" : "Non-taxable"}
                        </Badge>
                      </TableCell>
                      <TableCell>{adjustment.notes || "—"}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleEdit(adjustment)}
                          aria-label="Edit adjustment"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(adjustment.id)}
                          aria-label="Delete adjustment"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}


