import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Download } from "lucide-react";

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

const REVIEW_ROLES = ["hr", "director", "ceo", "admin", "accountant"];

export default function Form16() {
  const { toast } = useToast();
  const { userRole } = useAuth();
  const [financialYear, setFinancialYear] = useState<string>(getCurrentFinancialYear());
  const [employeeId, setEmployeeId] = useState<string>("");
  const [isDownloading, setIsDownloading] = useState(false);

  const canDownloadForOthers = userRole ? REVIEW_ROLES.includes(userRole) : false;

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      const blob = await api.downloadForm16(financialYear, canDownloadForOthers && employeeId ? employeeId : undefined);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Form16-${financialYear}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast({
        title: "Download started",
        description: "Form 16 has been downloaded.",
      });
    } catch (error: any) {
      console.error("Failed to download Form 16", error);
      toast({
        title: "Download failed",
        description: error?.message || "Unable to download Form 16.",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Form 16</h1>
          <p className="text-muted-foreground">
            Generate and download the Form 16 (Part B) summary for the selected financial year.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Download Options</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="financialYear">Financial Year</Label>
              <Select value={financialYear} onValueChange={setFinancialYear} disabled={isDownloading}>
                <SelectTrigger id="financialYear">
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

            {canDownloadForOthers && (
              <div className="space-y-2">
                <Label htmlFor="employeeId">Employee ID (optional)</Label>
                <Input
                  id="employeeId"
                  placeholder="Enter employee UUID"
                  value={employeeId}
                  onChange={(event) => setEmployeeId(event.target.value)}
                  disabled={isDownloading}
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank to download your own Form 16. Provide an employee UUID to download on their behalf.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Button onClick={handleDownload} disabled={isDownloading}>
          <Download className="mr-2 h-4 w-4" />
          {isDownloading ? "Generating…" : "Download Form 16"}
        </Button>
      </div>
    </AppLayout>
  );
}


