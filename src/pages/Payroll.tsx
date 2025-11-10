import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Plus, Calendar, Download, AlertCircle, DollarSign, SlidersHorizontal } from "lucide-react";
import { api } from "@/lib/api";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

interface PayrollRun {
  id: string;
  pay_period_start: string;
  pay_period_end: string;
  pay_date: string;
  status: string;
  total_employees: number;
  total_amount_cents: number;
  created_at: string;
}

export default function Payroll() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRuns();
  }, []);

  const fetchRuns = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/payroll/runs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setRuns(data || []);
      }
    } catch (error: any) {
      console.error('Error fetching payroll runs:', error);
      toast({
        title: "Error",
        description: "Failed to load payroll runs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = async (runId: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/payroll/runs/${runId}/process`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        toast({
          title: "Success",
          description: "Payroll run processed successfully",
        });
        fetchRuns();
      } else {
        throw new Error('Failed to process');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to process payroll run",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'processing': return 'bg-yellow-500';
      case 'rolled_back': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Payroll</h1>
            <p className="text-muted-foreground">Manage payroll runs and exports</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/payroll/adjustments")}>
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              Adjustments
            </Button>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Payroll Run
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Runs</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{runs.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {runs.filter(r => r.status === 'completed').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {runs.filter(r => r.status === 'draft' || r.status === 'processing').length}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Payroll Runs</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : runs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No payroll runs found
              </div>
            ) : (
              <div className="space-y-4">
                {runs.map((run) => (
                  <div key={run.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">
                          {format(new Date(run.pay_period_start), 'MMM d')} - {format(new Date(run.pay_period_end), 'MMM d, yyyy')}
                        </h3>
                        <Badge className={getStatusColor(run.status)}>
                          {run.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Pay Date: {format(new Date(run.pay_date), 'MMM d, yyyy')} • 
                        {run.total_employees} employees • 
                        ${((run.total_amount_cents || 0) / 100).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {run.status === 'draft' && (
                        <Button size="sm" onClick={() => handleProcess(run.id)}>
                          Process
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => navigate(`/payroll/adjustments?runId=${run.id}`)}>
                        Adjustments
                      </Button>
                      <Button size="sm" variant="ghost">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

