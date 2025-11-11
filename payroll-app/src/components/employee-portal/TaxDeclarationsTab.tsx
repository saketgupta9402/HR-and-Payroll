import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
// Import our new API client using a relative path
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// This component no longer needs props, as the backend
// identifies the user from their session cookie.
const getCurrentFinancialYear = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const startYear = month >= 3 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
};

const financialYearOptions = () => {
  const current = parseInt(getCurrentFinancialYear().split("-")[0], 10);
  return [current - 1, current, current + 1].map(
    (start) => `${start}-${start + 1}`
  );
};

const normalizeFinancialYear = (value: string) => {
  if (!value) return value;
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{4})\s*[-/]\s*(\d{2}|\d{4})$/);
  if (!match) {
    return trimmed;
  }
  const startYear = parseInt(match[1], 10);
  let endPart = match[2];
  let endYear =
    endPart.length === 2
      ? Math.floor(startYear / 100) * 100 + parseInt(endPart, 10)
      : parseInt(endPart, 10);

  if (Number.isNaN(endYear) || endYear <= startYear) {
    endYear = startYear + 1;
  }

  return `${startYear}-${endYear}`;
};

export const TaxDeclarationsTab = () => {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    financial_year: getCurrentFinancialYear(),
    section80C: "",
    section80D: "",
    hra: "",
    homeLoanInterest: "",
    otherDeductions: "",
  });
  const [detailDeclaration, setDetailDeclaration] = useState<any | null>(null);

  const { data: declarations, isLoading } = useQuery({
    // Simplified query key
    queryKey: ["my-tax-declarations"],
    queryFn: async () => {
      // Define the expected response shape from our new backend endpoint
      type DeclarationsResponse = {
        declarations: Array<{
          id: string;
          financial_year: string;
          status: string;
          chosen_regime?: string;
          submitted_at?: string;
          declaration_data?: Record<string, number>;
          items?: Array<{
            id: string;
            declaration_id: string;
            declared_amount: string;
            label?: string;
            section?: string;
            section_group?: string;
          }>;
        }>;
      };

      // Call the new API endpoint
      const data = await api.get<DeclarationsResponse>("tax-declarations");
      
      // The backend returns { declarations: [...] }, so we return data.declarations
      return data.declarations;
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // This is the JSON object we will store in the DB
      const declarationData = {
        section80C: Number(formData.section80C) || 0,
        section80D: Number(formData.section80D) || 0,
        hra: Number(formData.hra) || 0,
        homeLoanInterest: Number(formData.homeLoanInterest) || 0,
        otherDeductions: Number(formData.otherDeductions) || 0,
      };

      // This is the payload we send to the API
      const normalizedFY = normalizeFinancialYear(formData.financial_year);

      const payload = {
        financial_year: normalizedFY,
        declaration_data: declarationData,
        status: "draft",
        items: [
          { component_id: "PAYROLL_SECTION_80C", declared_amount: declarationData.section80C },
          { component_id: "PAYROLL_SECTION_80D", declared_amount: declarationData.section80D },
          { component_id: "PAYROLL_SECTION_24B", declared_amount: declarationData.homeLoanInterest },
          { component_id: "PAYROLL_HRA", declared_amount: declarationData.hra },
          { component_id: "PAYROLL_OTHER_DEDUCTIONS", declared_amount: declarationData.otherDeductions },
        ],
      };
      
      // Call our new POST endpoint
      await api.post("tax-declarations", payload);

      toast.success("Tax declaration submitted successfully");
      // Invalidate the query to refetch the list
      queryClient.invalidateQueries({ queryKey: ["my-tax-declarations"] });
      setShowForm(false);
      // Reset the form
      setFormData({
        financial_year: getCurrentFinancialYear(),
        section80C: "",
        section80D: "",
        hra: "",
        homeLoanInterest: "",
        otherDeductions: "",
      });
    } catch (error: any) {
      console.error("Error submitting declaration:", error);
      toast.error(error.message || "Failed to submit declaration");
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return <Skeleton className="h-[400px] w-full" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">Tax Declarations</h3>
          <p className="text-sm text-muted-foreground">
            Create a new declaration or review your previous submissions.
          </p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Declaration
          </Button>
        )}
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Submit Tax Declaration</CardTitle>
            <CardDescription>Enter your investment and deduction details</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="financial_year">Financial Year</Label>
                <Select
                  value={formData.financial_year}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, financial_year: value }))
                  }
                >
                  <SelectTrigger id="financial_year">
                    <SelectValue placeholder="Select financial year" />
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="section80C">Section 80C (LIC, PPF, EPF, etc.)</Label>
                  <Input
                    id="section80C"
                    type="number"
                    placeholder="Amount"
                    value={formData.section80C}
                    onChange={(e) => setFormData({ ...formData, section80C: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="section80D">Section 80D (Medical Insurance)</Label>
                  <Input
                    id="section80D"
                    type="number"
                    placeholder="Amount"
                    value={formData.section80D}
                    onChange={(e) => setFormData({ ...formData, section80D: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="hra">HRA Exemption</Label>
                  <Input
                    id="hra"
                    type="number"
                    placeholder="Amount"
                    value={formData.hra}
                    onChange={(e) => setFormData({ ...formData, hra: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="homeLoanInterest">Home Loan Interest (24b)</Label>
                  <Input
                    id="homeLoanInterest"
                    type="number"
                    placeholder="Amount"
                    value={formData.homeLoanInterest}
                    onChange={(e) => setFormData({ ...formData, homeLoanInterest: e.target.value })}
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="otherDeductions">Other Deductions</Label>
                  <Input
                    id="otherDeductions"
                    type="number"
                    placeholder="Amount"
                    value={formData.otherDeductions}
                    onChange={(e) => setFormData({ ...formData, otherDeductions: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={loading}>
                  {loading ? "Submitting..." : "Submit Declaration"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {declarations && declarations.length > 0 && (
        <div className="space-y-4">
          <h4 className="font-medium">Previous Declarations</h4>
          {declarations.map((declaration: any) => (
            <Card key={declaration.id} className="hover:border-primary transition-colors">
              <CardContent className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      <h5 className="font-semibold">FY {declaration.financial_year}</h5>
                      <Badge variant={declaration.status === "approved" ? "default" : "secondary"}>
                        {declaration.status.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {declaration.submitted_at
                        ? `Saved on ${new Date(declaration.submitted_at).toLocaleDateString("en-IN")}`
                        : "Not submitted yet"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant="outline" className="uppercase">
                      Regime: {declaration.chosen_regime?.toUpperCase() || "OLD"}
                    </Badge>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setDetailDeclaration(declaration)}
                    >
                      View Details
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!showForm && (!declarations || declarations.length === 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="mr-2 h-5 w-5 text-primary" />
              No Declarations Yet
            </CardTitle>
            <CardDescription>Submit your tax-saving investment declarations here</CardDescription>
          </CardHeader>
        </Card>
      )}

      <Dialog open={!!detailDeclaration} onOpenChange={(open) => !open && setDetailDeclaration(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Declaration Details – FY {detailDeclaration?.financial_year}
            </DialogTitle>
            <DialogDescription>
              Status: {detailDeclaration?.status?.toUpperCase()} • Regime:{" "}
              {detailDeclaration?.chosen_regime?.toUpperCase() || "OLD"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="font-medium text-muted-foreground mb-1">Section 80C</p>
                <p>
                  ₹{" "}
                  {Number(
                    detailDeclaration?.declaration_data?.section80C ??
                      detailDeclaration?.declaration_data?.section_80c ??
                      0
                  ).toLocaleString("en-IN")}
                </p>
              </div>
              <div>
                <p className="font-medium text-muted-foreground mb-1">Section 80D</p>
                <p>
                  ₹{" "}
                  {Number(
                    detailDeclaration?.declaration_data?.section80D ??
                      detailDeclaration?.declaration_data?.section_80d ??
                      0
                  ).toLocaleString("en-IN")}
                </p>
              </div>
              <div>
                <p className="font-medium text-muted-foreground mb-1">Home Loan Interest</p>
                <p>
                  ₹{" "}
                  {Number(
                    detailDeclaration?.declaration_data?.homeLoanInterest ??
                      detailDeclaration?.declaration_data?.section_24b ??
                      0
                  ).toLocaleString("en-IN")}
                </p>
              </div>
              <div>
                <p className="font-medium text-muted-foreground mb-1">HRA</p>
                <p>
                  ₹{" "}
                  {Number(
                    detailDeclaration?.declaration_data?.hra ??
                      detailDeclaration?.declaration_data?.hra ??
                      0
                  ).toLocaleString("en-IN")}
                </p>
              </div>
              <div>
                <p className="font-medium text-muted-foreground mb-1">Other Deductions</p>
                <p>
                  ₹{" "}
                  {Number(
                    detailDeclaration?.declaration_data?.otherDeductions ??
                      detailDeclaration?.declaration_data?.other_deductions ??
                      0
                  ).toLocaleString("en-IN")}
                </p>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2">Component Breakdown</h4>
              {detailDeclaration?.items && detailDeclaration.items.length > 0 ? (
                <div className="border rounded-md divide-y">
                  {detailDeclaration.items.map((item: any) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between px-3 py-2"
                    >
                      <div>
                        <p className="font-medium">{item.label || `Section ${item.section}`}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.section_group
                            ? `Section ${item.section} • Group ${item.section_group}`
                            : `Section ${item.section}`}
                        </p>
                      </div>
                      <p>
                        ₹{" "}
                        {Number(item.declared_amount || 0).toLocaleString("en-IN", {
                          maximumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">
                  No individual components were provided for this declaration.
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

