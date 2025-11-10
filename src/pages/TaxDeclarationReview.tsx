import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { Download } from "lucide-react";

interface DeclarationSummary {
  id: string;
  employee_id: string;
  financial_year: string;
  status: "draft" | "submitted" | "approved" | "rejected";
  chosen_regime: "old" | "new";
  remarks?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
}

interface DeclarationItem {
  id: string;
  declaration_id: string;
  component_id: string;
  declared_amount: string;
  approved_amount?: string;
  label: string;
  section: string;
  section_group?: string;
}

const getCurrentFinancialYear = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const startYear = month >= 3 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
};

const financialYearOptions = () => {
  const startYear = parseInt(getCurrentFinancialYear().split("-")[0], 10);
  return [startYear - 1, startYear, startYear + 1].map((year) => `${year}-${year + 1}`);
};

export default function TaxDeclarationReview() {
  const { toast } = useToast();
  const [financialYear, setFinancialYear] = useState<string>(getCurrentFinancialYear());
  const [statusFilter, setStatusFilter] = useState<string>("submitted");
  const [declarations, setDeclarations] = useState<DeclarationSummary[]>([]);
  const [items, setItems] = useState<DeclarationItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [approvedValues, setApprovedValues] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => {
    loadDeclarations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [financialYear, statusFilter]);

  useEffect(() => {
    if (selectedId) {
      const selected = items.filter((item) => item.declaration_id === selectedId);
      const approved: Record<string, string> = {};
      selected.forEach((item) => {
        approved[item.id] = item.approved_amount ?? item.declared_amount ?? "0";
      });
      setApprovedValues(approved);
      const declaration = declarations.find((decl) => decl.id === selectedId);
      setRemarks(declaration?.remarks || "");
    } else {
      setApprovedValues({});
      setRemarks("");
    }
  }, [selectedId, items, declarations]);

  const loadDeclarations = async () => {
    try {
      setLoading(true);
      const result = await api.getTaxDeclarations({
        financial_year: financialYear,
        status: statusFilter || undefined,
      });
      setDeclarations(result.declarations || []);
      setItems(result.items || []);
      if (result.declarations?.length) {
        setSelectedId(result.declarations[0].id);
      } else {
        setSelectedId(null);
      }
    } catch (error: any) {
      console.error("Failed to fetch tax declarations", error);
      toast({
        title: "Error",
        description: error?.message || "Unable to load tax declarations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedDeclaration = useMemo(
    () => declarations.find((decl) => decl.id === selectedId) || null,
    [declarations, selectedId]
  );

  const selectedItems = useMemo(
    () => items.filter((item) => item.declaration_id === selectedId),
    [items, selectedId]
  );

  const handleApproveAmountChange = (itemId: string, value: string) => {
    setApprovedValues((prev) => ({
      ...prev,
      [itemId]: value,
    }));
  };

  const handleReview = async (decision: "approved" | "rejected") => {
    if (!selectedId) return;

    if (decision === "approved" && selectedItems.length === 0) {
      toast({
        title: "No items",
        description: "Cannot approve a declaration without any tax components.",
        variant: "destructive",
      });
      return;
    }

    try {
      setReviewing(true);
      await api.reviewTaxDeclaration(selectedId, {
        status: decision,
        remarks: remarks || undefined,
        items:
          decision === "approved"
            ? selectedItems.map((item) => ({
                id: item.id,
                approved_amount: Number(approvedValues[item.id] || 0),
              }))
            : undefined,
      });

      toast({
        title: decision === "approved" ? "Declaration approved" : "Declaration rejected",
        description:
          decision === "approved"
            ? "The declaration has been approved successfully."
            : "The declaration has been rejected.",
      });

      await loadDeclarations();
    } catch (error: any) {
      console.error("Failed to review tax declaration", error);
      toast({
        title: "Error",
        description: error?.message || "Unable to record your decision",
        variant: "destructive",
      });
    } finally {
      setReviewing(false);
    }
  };

  const handleDownloadForm16 = async () => {
    if (!selectedDeclaration) return;
    try {
      setReviewing(true);
      const blob = await api.downloadForm16(financialYear, selectedDeclaration.employee_id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const namePart =
        [selectedDeclaration.first_name, selectedDeclaration.last_name].filter(Boolean).join("-") ||
        selectedDeclaration.employee_id;
      link.download = `Form16-${namePart || "employee"}-${financialYear}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast({
        title: "Form 16 downloaded",
        description: "Form 16 has been generated for the selected employee.",
      });
    } catch (error: any) {
      console.error("Failed to download Form 16", error);
      toast({
        title: "Download failed",
        description: error?.message || "Unable to download Form 16.",
        variant: "destructive",
      });
    } finally {
      setReviewing(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Tax Declaration Review</h1>
            <p className="text-muted-foreground">
              Review, approve, or reject employee tax declarations for the selected financial year.
            </p>
          </div>
          <div className="flex gap-4">
            <div className="space-y-1">
              <Label htmlFor="financialYear">Financial Year</Label>
              <Select value={financialYear} onValueChange={setFinancialYear} disabled={reviewing}>
                <SelectTrigger id="financialYear" className="w-40">
                  <SelectValue placeholder="Select FY" />
                </SelectTrigger>
                <SelectContent>
                  {financialYearOptions().map((fy) => (
                    <SelectItem key={fy} value={fy}>
                      {fy}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="statusFilter">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter} disabled={reviewing}>
                <SelectTrigger id="statusFilter" className="w-40">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Declarations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[65vh] overflow-y-auto">
              {loading ? (
                <div className="text-muted-foreground">Loading declarations…</div>
              ) : declarations.length === 0 ? (
                <div className="text-muted-foreground">No declarations found for this filter.</div>
              ) : (
                declarations.map((declaration) => {
                  const name =
                    [declaration.first_name, declaration.last_name].filter(Boolean).join(" ") ||
                    declaration.email ||
                    "Employee";
                  const isSelected = declaration.id === selectedId;
                  return (
                    <button
                      key={declaration.id}
                      onClick={() => setSelectedId(declaration.id)}
                      className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                        isSelected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{name}</span>
                        <Badge variant={declaration.status === "submitted" ? "default" : "secondary"}>
                          {declaration.status.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{declaration.email}</p>
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Declaration Details</CardTitle>
                {selectedDeclaration && (
                  <Badge variant="outline">Regime: {selectedDeclaration.chosen_regime.toUpperCase()}</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {!selectedDeclaration ? (
                <div className="text-muted-foreground">Select an employee declaration to review.</div>
              ) : (
                <>
                  <div className="space-y-3">
                    <Label>Reviewer Remarks</Label>
                    <Textarea
                      placeholder="Provide remarks for the employee (visible after review)"
                      value={remarks}
                      onChange={(event) => setRemarks(event.target.value)}
                      disabled={reviewing}
                    />
                  </div>

                  <div className="space-y-4">
                    {selectedItems.length === 0 ? (
                      <div className="text-muted-foreground text-sm">
                        This declaration does not have any tax components listed.
                      </div>
                    ) : (
                      selectedItems.map((item) => (
                        <div key={item.id} className="border rounded-lg p-4 space-y-2">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <h3 className="text-base font-semibold">{item.label}</h3>
                              <p className="text-xs text-muted-foreground">
                                Section {item.section}
                                {item.section_group ? ` • Group ${item.section_group}` : ""}
                              </p>
                              <p className="text-sm text-muted-foreground mt-1">
                                Declared: ₹{Number(item.declared_amount || 0).toLocaleString()}
                              </p>
                            </div>
                            {selectedDeclaration.status !== "approved" && (
                              <Input
                                className="w-32"
                                type="number"
                                min="0"
                                step="0.01"
                                value={approvedValues[item.id] || ""}
                                onChange={(event) => handleApproveAmountChange(item.id, event.target.value)}
                                disabled={reviewing || statusFilter === "approved"}
                              />
                            )}
                          </div>
                          {selectedDeclaration.status === "approved" && item.approved_amount && (
                            <p className="text-sm text-emerald-600">
                              Approved: ₹{Number(item.approved_amount).toLocaleString()}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      variant="secondary"
                      onClick={handleDownloadForm16}
                      disabled={reviewing || !selectedDeclaration}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download Form 16
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleReview("rejected")}
                      disabled={reviewing || !selectedId}
                    >
                      Reject
                    </Button>
                    <Button
                      onClick={() => handleReview("approved")}
                      disabled={reviewing || !selectedId}
                    >
                      Approve
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}


