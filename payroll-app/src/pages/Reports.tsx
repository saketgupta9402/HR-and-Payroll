import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ArrowLeft, FileText, Download, Building2 } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const Reports = () => {
  const navigate = useNavigate();
  const [selectedCycleId, setSelectedCycleId] = useState<string>("");
  const [statutoryMonth, setStatutoryMonth] = useState<number>(new Date().getMonth() + 1);
  const [statutoryYear, setStatutoryYear] = useState<number>(new Date().getFullYear());
  const [tdsSummary, setTdsSummary] = useState<any>(null);
  const [showTdsDialog, setShowTdsDialog] = useState(false);
  const [isLoadingStatutory, setIsLoadingStatutory] = useState<string | null>(null);

  // Fetch payroll cycles
  const { data: cyclesData, isLoading: cyclesLoading } = useQuery({
    queryKey: ["payroll-cycles"],
    queryFn: () => api.dashboard.cycles(),
  });

  const cycles = cyclesData?.cycles || [];

  const reportTypes = [
    {
      title: "Payroll Register",
      description: "Detailed payroll summary for a specific period",
      icon: FileText,
      key: "payroll-register",
    },
    {
      title: "PF Report",
      description: "Provident Fund contribution report",
      icon: FileText,
      key: "pf-report",
    },
    {
      title: "ESI Report",
      description: "Employee State Insurance contribution report",
      icon: FileText,
      key: "esi-report",
    },
    {
      title: "TDS Report",
      description: "Tax Deducted at Source summary",
      icon: FileText,
      key: "tds-report",
    },
  ];

  const handleGeneratePayrollRegister = async () => {
    if (!selectedCycleId) {
      toast.error("Please select a payroll cycle");
      return;
    }

    try {
      await api.reports.getPayrollRegister(selectedCycleId);
      toast.success("Report downloaded!");
    } catch (error: any) {
      toast.error(error.message || "Failed to download report");
    }
  };

  const handleDownloadPFECR = async () => {
    if (!statutoryMonth || !statutoryYear) {
      toast.error("Please select month and year");
      return;
    }

    setIsLoadingStatutory("pf-ecr");
    try {
      await api.reports.downloadPFECR(statutoryMonth, statutoryYear);
      toast.success("PF ECR downloaded!");
    } catch (error: any) {
      toast.error(error.message || "Failed to download PF ECR");
    } finally {
      setIsLoadingStatutory(null);
    }
  };

  const handleDownloadESIReturn = async () => {
    if (!statutoryMonth || !statutoryYear) {
      toast.error("Please select month and year");
      return;
    }

    setIsLoadingStatutory("esi-return");
    try {
      await api.reports.downloadESIReturn(statutoryMonth, statutoryYear);
      toast.success("ESI Return downloaded!");
    } catch (error: any) {
      toast.error(error.message || "Failed to download ESI Return");
    } finally {
      setIsLoadingStatutory(null);
    }
  };

  const handleViewTDSSummary = async () => {
    if (!statutoryMonth || !statutoryYear) {
      toast.error("Please select month and year");
      return;
    }

    setIsLoadingStatutory("tds-summary");
    try {
      const summary = await api.reports.getTDSSummary(statutoryMonth, statutoryYear);
      setTdsSummary(summary);
      setShowTdsDialog(true);
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch TDS summary");
    } finally {
      setIsLoadingStatutory(null);
    }
  };

  const formatCycleLabel = (cycle: { month: number; year: number }) => {
    const monthName = new Date(2000, cycle.month - 1).toLocaleString('en-IN', { month: 'long' });
    return `${monthName} ${cycle.year}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate("/dashboard")} className="mb-2">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Reports & Analytics</h1>
            <p className="text-muted-foreground">Generate and download compliance reports</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Cycle Selector */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <Label htmlFor="cycle-select">Select Payroll Cycle</Label>
              <Select
                value={selectedCycleId}
                onValueChange={setSelectedCycleId}
                disabled={cyclesLoading}
              >
                <SelectTrigger id="cycle-select">
                  <SelectValue placeholder={cyclesLoading ? "Loading cycles..." : "Select a payroll cycle"} />
                </SelectTrigger>
                <SelectContent>
                  {cycles.map((cycle: { id: string; month: number; year: number }) => (
                    <SelectItem key={cycle.id} value={cycle.id}>
                      {formatCycleLabel(cycle)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Report Cards */}
        <div className="grid gap-6 md:grid-cols-2">
          {reportTypes.map((report) => (
            <Card key={report.key} className="shadow-md hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <report.icon className="mr-2 h-5 w-5 text-primary" />
                  {report.title}
                </CardTitle>
                <CardDescription>{report.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  className="w-full" 
                  variant="outline"
                  onClick={() => {
                    if (report.key === "payroll-register") {
                      handleGeneratePayrollRegister();
                    } else {
                      // TODO: Implement other report generation
                      toast.info(`${report.title} generation will be implemented soon`);
                    }
                  }}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Generate Report
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Statutory Reports Section */}
        <Card className="mt-8 border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Building2 className="mr-2 h-5 w-5 text-primary" />
              Statutory Downloads
            </CardTitle>
            <CardDescription>
              Download compliant government reports for Indian Payroll compliance
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Month/Year Selector */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="statutory-month">Month</Label>
                <Input
                  id="statutory-month"
                  type="number"
                  min="1"
                  max="12"
                  value={statutoryMonth}
                  onChange={(e) => setStatutoryMonth(parseInt(e.target.value) || 1)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="statutory-year">Year</Label>
                <Input
                  id="statutory-year"
                  type="number"
                  min="2000"
                  max="2100"
                  value={statutoryYear}
                  onChange={(e) => setStatutoryYear(parseInt(e.target.value) || new Date().getFullYear())}
                />
              </div>
            </div>

            {/* Statutory Report Buttons */}
            <div className="grid gap-4 md:grid-cols-3">
              <Button
                variant="outline"
                className="w-full"
                onClick={handleDownloadPFECR}
                disabled={isLoadingStatutory !== null}
              >
                {isLoadingStatutory === "pf-ecr" ? (
                  "Downloading..."
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Download PF ECR
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                className="w-full"
                onClick={handleDownloadESIReturn}
                disabled={isLoadingStatutory !== null}
              >
                {isLoadingStatutory === "esi-return" ? (
                  "Downloading..."
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Download ESI Return
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                className="w-full"
                onClick={handleViewTDSSummary}
                disabled={isLoadingStatutory !== null}
              >
                {isLoadingStatutory === "tds-summary" ? (
                  "Loading..."
                ) : (
                  <>
                    <FileText className="mr-2 h-4 w-4" />
                    View TDS Summary
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* TDS Summary Dialog */}
      <Dialog open={showTdsDialog} onOpenChange={setShowTdsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>TDS Summary - {String(statutoryMonth).padStart(2, '0')}/{statutoryYear}</DialogTitle>
            <DialogDescription>
              Tax Deducted at Source summary for the selected period
            </DialogDescription>
          </DialogHeader>
          {tdsSummary && (
            <div className="space-y-4 mt-4">
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total TDS</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">₹{tdsSummary.total_tds.toLocaleString('en-IN')}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Employees</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{tdsSummary.total_employees}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Pay Date</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{new Date(tdsSummary.period.pay_date).toLocaleDateString('en-IN')}</p>
                  </CardContent>
                </Card>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Organization Details</h3>
                <div className="text-sm space-y-1">
                  <p><strong>Name:</strong> {tdsSummary.organization.name}</p>
                  <p><strong>PAN:</strong> {tdsSummary.organization.pan || 'N/A'}</p>
                  <p><strong>TAN:</strong> {tdsSummary.organization.tan || 'N/A'}</p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">TDS by Section</h3>
                {Object.values(tdsSummary.by_section).map((section: any) => (
                  <Card key={section.section} className="mb-2">
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium">Section {section.section}</p>
                          <p className="text-sm text-muted-foreground">{section.description}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">₹{section.total_amount.toLocaleString('en-IN')}</p>
                          <p className="text-sm text-muted-foreground">{section.employee_count} employees</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div>
                <h3 className="font-semibold mb-2">Employee Details</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Employee ID</th>
                        <th className="text-left p-2">Name</th>
                        <th className="text-left p-2">PAN</th>
                        <th className="text-right p-2">Gross Pay</th>
                        <th className="text-right p-2">TDS Deducted</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tdsSummary.employees.map((emp: any, idx: number) => (
                        <tr key={idx} className="border-b">
                          <td className="p-2">{emp.employee_id}</td>
                          <td className="p-2">{emp.name}</td>
                          <td className="p-2">{emp.pan || 'N/A'}</td>
                          <td className="p-2 text-right">₹{emp.gross_pay.toLocaleString('en-IN')}</td>
                          <td className="p-2 text-right">₹{emp.tds_deducted.toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Reports;
