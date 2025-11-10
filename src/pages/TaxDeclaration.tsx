import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "react-router-dom";
import { Download } from "lucide-react";

interface TaxComponentDefinition {
  id: string;
  label: string;
  section: string;
  section_group?: string;
  max_limit?: string;
}

interface TaxDeclaration {
  id: string;
  financial_year: string;
  chosen_regime: "old" | "new";
  status: "draft" | "submitted" | "approved" | "rejected";
  remarks?: string;
}

interface TaxDeclarationItem {
  id: string;
  component_id: string;
  declared_amount: string;
  approved_amount?: string;
  proof_url?: string;
  notes?: string;
}

type FormItemState = {
  declaredAmount: string;
  proofUrl: string;
  include: boolean;
};

const getCurrentFinancialYear = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-based
  const startYear = month >= 3 ? year : year - 1; // Financial year starts in April
  return `${startYear}-${startYear + 1}`;
};

const financialYearOptions = () => {
  const startYear = parseInt(getCurrentFinancialYear().split("-")[0], 10);
  return [startYear - 1, startYear, startYear + 1].map((year) => `${year}-${year + 1}`);
};

export default function TaxDeclaration() {
  const { toast } = useToast();
  const [financialYear, setFinancialYear] = useState<string>(getCurrentFinancialYear());
  const [definitions, setDefinitions] = useState<TaxComponentDefinition[]>([]);
  const [declaration, setDeclaration] = useState<TaxDeclaration | null>(null);
  const [items, setItems] = useState<TaxDeclarationItem[]>([]);
  const [formItems, setFormItems] = useState<Record<string, FormItemState>>({});
  const [regime, setRegime] = useState<"old" | "new">("old");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showOnlyMarked, setShowOnlyMarked] = useState(false);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [financialYear]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [defs, declResult] = await Promise.all([
        api.getTaxDefinitions(financialYear),
        api.getMyTaxDeclaration(financialYear),
      ]);
      setDefinitions(defs || []);
      setDeclaration(declResult.declaration);
      setItems(declResult.items || []);
      setRegime(declResult.declaration?.chosen_regime || "old");

      const draftState: Record<string, FormItemState> = {};
      defs?.forEach((def: TaxComponentDefinition) => {
        const existing = (declResult.items || []).find((item: TaxDeclarationItem) => item.component_id === def.id);
        draftState[def.id] = {
          declaredAmount: existing ? (parseFloat(existing.declared_amount).toString() || "0") : "",
          proofUrl: existing?.proof_url || "",
          include: existing ? parseFloat(existing.declared_amount) > 0 : false,
        };
      });
      setFormItems(draftState);
    } catch (error: any) {
      console.error("Failed to load tax declaration data", error);
      toast({
        title: "Error",
        description: error?.message || "Unable to load tax declaration data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredDefinitions = useMemo(() => {
    if (!showOnlyMarked) {
      return definitions;
    }
    return definitions.filter((def) => formItems[def.id]?.include);
  }, [definitions, formItems, showOnlyMarked]);

  const handleToggleInclude = (componentId: string, checked: boolean) => {
    setFormItems((prev) => ({
      ...prev,
      [componentId]: {
        ...prev[componentId],
        include: checked,
        declaredAmount: checked ? prev[componentId]?.declaredAmount || "" : "",
      },
    }));
  };

  const handleAmountChange = (componentId: string, value: string) => {
    setFormItems((prev) => ({
      ...prev,
      [componentId]: {
        ...prev[componentId],
        declaredAmount: value,
        include: true,
      },
    }));
  };

  const handleProofChange = (componentId: string, value: string) => {
    setFormItems((prev) => ({
      ...prev,
      [componentId]: {
        ...prev[componentId],
        proofUrl: value,
      },
    }));
  };

  const buildPayloadItems = () => {
    const payloadItems: Array<{
      component_id: string;
      declared_amount: number;
      proof_url?: string;
    }> = [];
    definitions.forEach((def) => {
      const itemState = formItems[def.id];
      if (!itemState) return;
      const declared = Number(itemState.declaredAmount || 0);
      if (itemState.include && declared > 0) {
        payloadItems.push({
          component_id: def.id,
          declared_amount: declared,
          proof_url: itemState.proofUrl || undefined,
        });
      }
    });
    return payloadItems;
  };

  const handleSave = async (targetStatus: "draft" | "submitted") => {
    if (targetStatus === "submitted" && definitions.length === 0) {
      toast({
        title: "Missing definitions",
        description: "No tax components defined for this financial year.",
        variant: "destructive",
      });
      return;
    }

    const payloadItems = buildPayloadItems();

    if (targetStatus === "submitted" && payloadItems.length === 0) {
      toast({
        title: "No deductions",
        description: "Add at least one tax component before submitting.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);
      await api.saveTaxDeclaration({
        financial_year: financialYear,
        chosen_regime: regime,
        status: targetStatus,
        items: payloadItems,
      });

      toast({
        title: targetStatus === "submitted" ? "Declaration submitted" : "Draft saved",
        description:
          targetStatus === "submitted"
            ? "Your declaration has been submitted for approval."
            : "Your draft was saved successfully.",
      });

      await loadData();
    } catch (error: any) {
      console.error("Failed to save tax declaration", error);
      toast({
        title: "Error",
        description: error?.message || "Unable to save tax declaration",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const statusBadge = (status?: string) => {
    if (!status) return null;
    let variant: "default" | "secondary" | "outline" = "default";
    if (status === "draft") variant = "secondary";
    if (status === "rejected") variant = "outline";
    return <Badge variant={variant}>{status.toUpperCase()}</Badge>;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold">Tax Declaration</h1>
            <p className="text-muted-foreground">
              Declare your tax-saving investments for the selected financial year.
            </p>
          </div>
          <div className="flex items-end gap-3 flex-wrap">
            <Button variant="outline" onClick={() => navigate("/reports/form16")} className="flex-shrink-0">
              <Download className="mr-2 h-4 w-4" />
              Download Form 16
            </Button>
            <div className="space-y-1">
              <Label htmlFor="financialYear">Financial Year</Label>
              <Select
                value={financialYear}
                onValueChange={(value) => setFinancialYear(value)}
                disabled={saving}
              >
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
              <Label htmlFor="regime">Tax Regime</Label>
              <Select
                value={regime}
                onValueChange={(value: "old" | "new") => setRegime(value)}
                disabled={saving || declaration?.status === "approved"}
              >
                <SelectTrigger id="regime" className="w-32">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="old">Old Regime</SelectItem>
                  <SelectItem value="new">New Regime</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Declaration Status</CardTitle>
              {statusBadge(declaration?.status)}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Switch
                id="showOnlyMarked"
                checked={showOnlyMarked}
                onCheckedChange={setShowOnlyMarked}
              />
              <Label htmlFor="showOnlyMarked">Show only components I have declared</Label>
            </div>
            {declaration?.remarks && (
              <div className="bg-muted/40 border border-muted p-3 rounded-md">
                <p className="text-sm font-semibold">Reviewer Remarks</p>
                <p className="text-sm text-muted-foreground">{declaration.remarks}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tax-Saving Components</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="text-muted-foreground">Loading tax components…</div>
            ) : filteredDefinitions.length === 0 ? (
              <div className="text-muted-foreground">No tax components defined for this financial year.</div>
            ) : (
              <div className="space-y-6">
                {filteredDefinitions.map((definition) => {
                  const state = formItems[definition.id] || { declaredAmount: "", proofUrl: "", include: false };
                  const existing = items.find((item) => item.component_id === definition.id);
                  const approvedAmount = existing?.approved_amount
                    ? `Approved: ₹${parseFloat(existing.approved_amount).toFixed(2)}`
                    : undefined;

                  return (
                    <div key={definition.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-semibold">{definition.label}</h3>
                          <p className="text-sm text-muted-foreground">
                            Section {definition.section}
                            {definition.section_group ? ` • Group ${definition.section_group}` : ""}
                            {definition.max_limit ? ` • Max ₹${Number(definition.max_limit).toLocaleString()}` : ""}
                          </p>
                          {approvedAmount && (
                            <p className="text-sm text-emerald-600 mt-1">{approvedAmount}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={state.include}
                            onCheckedChange={(checked) => handleToggleInclude(definition.id, checked)}
                            disabled={declaration?.status === "approved"}
                          />
                          <Label className="text-sm text-muted-foreground">Include</Label>
                        </div>
                      </div>

                      {state.include && (
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Declared Amount (₹)</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={state.declaredAmount}
                              onChange={(event) => handleAmountChange(definition.id, event.target.value)}
                              disabled={declaration?.status === "approved"}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Proof Document URL</Label>
                            <Input
                              type="url"
                              placeholder="https://"
                              value={state.proofUrl}
                              onChange={(event) => handleProofChange(definition.id, event.target.value)}
                              disabled={declaration?.status === "approved"}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => handleSave("draft")}
              disabled={saving || declaration?.status === "approved"}
            >
              Save Draft
            </Button>
            <Button
              onClick={() => handleSave("submitted")}
              disabled={saving || declaration?.status === "approved"}
            >
              Submit for Approval
            </Button>
            {declaration?.status === "approved" && (
              <p className="text-sm text-emerald-600">
                Your declaration has been approved. Reach out to HR if further changes are required.
              </p>
            )}
            {declaration?.status === "rejected" && (
              <div className="space-y-2 w-full">
                <p className="text-sm text-destructive">
                  Your declaration was rejected. Review the remarks above and resubmit once updated.
                </p>
                <Textarea
                  value={declaration.remarks || ""}
                  disabled
                  className="text-sm text-muted-foreground"
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}


