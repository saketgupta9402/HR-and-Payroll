import { useMemo, useRef, useState } from "react";
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

const TAX_COMPONENTS = [
  {
    key: "section80C",
    code: "PAYROLL_SECTION_80C",
    label: "Section 80C (LIC, PPF, EPF, etc.)",
    placeholder: "Amount",
  },
  {
    key: "section80D",
    code: "PAYROLL_SECTION_80D",
    label: "Section 80D (Medical Insurance)",
    placeholder: "Amount",
  },
  {
    key: "hra",
    code: "PAYROLL_HRA",
    label: "HRA Exemption",
    placeholder: "Amount",
  },
  {
    key: "homeLoanInterest",
    code: "PAYROLL_SECTION_24B",
    label: "Home Loan Interest (24B)",
    placeholder: "Amount",
  },
  {
    key: "otherDeductions",
    code: "PAYROLL_OTHER_DEDUCTIONS",
    label: "Other Deductions",
    placeholder: "Amount",
  },
] as const;

type ComponentKey = (typeof TAX_COMPONENTS)[number]["key"];

const createProofUrlState = () =>
  TAX_COMPONENTS.reduce(
    (acc, component) => {
      acc[component.key] = "";
      return acc;
    },
    {} as Record<ComponentKey, string>
  );

const createProofUploadState = () =>
  TAX_COMPONENTS.reduce(
    (acc, component) => {
      acc[component.key] = false;
      return acc;
    },
    {} as Record<ComponentKey, boolean>
  );

const createProofFileNameState = () =>
  TAX_COMPONENTS.reduce(
    (acc, component) => {
      acc[component.key] = "";
      return acc;
    },
    {} as Record<ComponentKey, string>
  );

const createFileInputState = () =>
  TAX_COMPONENTS.reduce(
    (acc, component) => {
      acc[component.key] = null;
      return acc;
    },
    {} as Record<ComponentKey, HTMLInputElement | null>
  );

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
  const [proofUrls, setProofUrls] = useState<Record<ComponentKey, string>>(createProofUrlState);
  const [uploadingProofs, setUploadingProofs] =
    useState<Record<ComponentKey, boolean>>(createProofUploadState);
  const [proofFileNames, setProofFileNames] =
    useState<Record<ComponentKey, string>>(createProofFileNameState);
  const fileInputsRef = useRef<Record<ComponentKey, HTMLInputElement | null>>(createFileInputState());

  const triggerFileDialog = (componentKey: ComponentKey) => {
    fileInputsRef.current[componentKey]?.click();
  };

  const handleProofUrlChange = (componentKey: ComponentKey, value: string) => {
    setProofUrls((prev) => ({ ...prev, [componentKey]: value }));
    if (!value) {
      setProofFileNames((prev) => ({ ...prev, [componentKey]: "" }));
    }
  };

  const handleProofUpload = async (componentKey: ComponentKey, file: File | null) => {
    if (!file) return;
    setUploadingProofs((prev) => ({ ...prev, [componentKey]: true }));
    try {
      const component = TAX_COMPONENTS.find((entry) => entry.key === componentKey);
      if (!component) {
        throw new Error(`Unknown component: ${componentKey}`);
      }
      const { url, fileName } = await api.uploadTaxProof(
        component.code,
        formData.financial_year,
        file
      );
      const proofLink = url || "";
      setProofUrls((prev) => ({ ...prev, [componentKey]: proofLink }));
      setProofFileNames((prev) => ({
        ...prev,
        [componentKey]: fileName || file.name,
      }));
      toast.success(`${component.label} proof uploaded successfully`);
    } catch (error: any) {
      console.error("Error uploading proof:", error);
      toast.error(error.message || "Failed to upload proof");
    } finally {
      setUploadingProofs((prev) => ({ ...prev, [componentKey]: false }));
      const input = fileInputsRef.current[componentKey];
      if (input) {
        input.value = "";
      }
    }
  };

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
          remarks?: string;
          declaration_data?: Record<string, number>;
          items?: Array<{
            id: string;
            declaration_id: string;
            declared_amount: string;
             approved_amount?: string | null;
            label?: string;
            section?: string;
            section_group?: string;
            proof_url?: string | null;
          }>;
        }>;
      };

      // Call the new API endpoint
      const data = await api.get<DeclarationsResponse>("tax-declarations");
      
      // The backend returns { declarations: [...] }, so we return data.declarations
      return data.declarations;
    },
  });

  const latestDeclaration = useMemo(
    () => (declarations && declarations.length > 0 ? declarations[0] : null),
    [declarations]
  );
  const latestStatusClasses =
    latestDeclaration && latestDeclaration.status !== "draft"
      ? latestDeclaration.status === "approved"
        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : latestDeclaration.status === "rejected"
        ? "border-rose-200 bg-rose-50 text-rose-800"
        : "border-blue-200 bg-blue-50 text-blue-800"
      : "";
  const latestStatusMessage =
    latestDeclaration && latestDeclaration.status !== "draft"
      ? latestDeclaration.status === "approved"
        ? "Your declaration has been approved."
        : latestDeclaration.status === "rejected"
        ? "Your declaration has been rejected. Please review the remarks and resubmit if needed."
        : "Your declaration has been submitted and is awaiting HR review."
      : null;

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
      const payloadItems = TAX_COMPONENTS.map((component) => {
        const amount = Number(formData[component.key as keyof typeof formData]) || 0;
        const proofUrl = (proofUrls[component.key] || "").trim();
        return {
          component_id: component.code,
          declared_amount: amount,
          proof_url: proofUrl || null,
        };
      }).filter((item) => item.declared_amount > 0 || (item.proof_url && item.proof_url.length > 0));

      const payload = {
        financial_year: normalizedFY,
        declaration_data: declarationData,
        status: "submitted",
        items: payloadItems,
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
      setProofUrls(createProofUrlState());
      setProofFileNames(createProofFileNameState());
      setUploadingProofs(createProofUploadState());
    } catch (error: any) {
      console.error("Error submitting declaration:", error);
      toast.error(error.message || "Failed to submit declaration");
    } finally {
      setLoading(false);
    }
  };

  const updateComponentAmount = (componentKey: ComponentKey, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [componentKey]: value,
    }) as typeof prev);
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

      {!showForm && latestDeclaration && latestStatusMessage && (
        <div className={`rounded-lg border p-4 text-sm ${latestStatusClasses}`}>
          <p className="font-semibold">
            Status: {latestDeclaration.status.toUpperCase()}
          </p>
          <p className="mt-1">{latestStatusMessage}</p>
          {latestDeclaration.remarks && (
            <p className="mt-2">
              Reviewer remarks:{" "}
              <span className="font-medium">{latestDeclaration.remarks}</span>
            </p>
          )}
        </div>
      )}

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

              <div className="space-y-6">
                {TAX_COMPONENTS.map((component) => (
                  <div key={component.code} className="space-y-3">
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-end lg:gap-6">
                      <div>
                        <Label htmlFor={component.key}>{component.label}</Label>
                        <Input
                          id={component.key}
                          type="number"
                          placeholder={component.placeholder}
                          value={
                            formData[component.key as keyof typeof formData] as string | number | undefined
                          }
                          onChange={(e) => updateComponentAmount(component.key, e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`${component.key}-proof`} className="text-xs uppercase tracking-wide">
                          Proof URL or Upload
                        </Label>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <Input
                            id={`${component.key}-proof`}
                            placeholder="Paste proof link (Google Drive, OneDrive, etc.)"
                            value={proofUrls[component.key]}
                            onChange={(e) => handleProofUrlChange(component.key, e.target.value)}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => triggerFileDialog(component.key)}
                            disabled={uploadingProofs[component.key]}
                          >
                            {uploadingProofs[component.key]
                              ? "Uploading..."
                              : proofFileNames[component.key]
                              ? "Re-upload"
                              : "Upload Proof"}
                          </Button>
                        </div>
                        <input
                          ref={(el) => {
                            fileInputsRef.current[component.key] = el;
                          }}
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          className="hidden"
                          onChange={(event) =>
                            handleProofUpload(component.key, event.target.files?.[0] || null)
                          }
                        />
                        {proofFileNames[component.key] && (
                          <p className="text-xs text-muted-foreground">
                            Attached file: {proofFileNames[component.key]}
                          </p>
                        )}
                        {proofUrls[component.key] && (
                          <a
                            href={proofUrls[component.key]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary underline underline-offset-2"
                          >
                            View proof
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
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
                      <div className="space-y-1">
                        <p className="font-medium">{item.label || `Section ${item.section}`}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.section_group
                            ? `Section ${item.section} • Group ${item.section_group}`
                            : `Section ${item.section}`}
                        </p>
                        {item.proof_url ? (
                          <a
                            href={item.proof_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary underline underline-offset-2"
                          >
                            View proof
                          </a>
                        ) : (
                          <p className="text-xs text-muted-foreground">No proof uploaded.</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p>
                          ₹{" "}
                          {Number(item.declared_amount || 0).toLocaleString("en-IN", {
                            maximumFractionDigits: 2,
                          })}
                        </p>
                        {item.approved_amount && (
                          <p className="text-xs text-emerald-600">
                            Approved: ₹
                            {Number(item.approved_amount).toLocaleString("en-IN", {
                              maximumFractionDigits: 2,
                            })}
                          </p>
                        )}
                      </div>
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

