import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type PendingReimbursement = {
  id: string;
  employee_id: string;
  employee_code?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  category: string;
  amount: string | number;
  description?: string | null;
  receipt_url?: string | null;
  submitted_at: string;
  status: "pending" | "approved" | "rejected" | "paid";
};

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

const resolveReceiptLink = (url?: string | null) => {
  if (!url) {
    return null;
  }
  if (url.startsWith("http")) {
    return url;
  }
  const base = import.meta.env.VITE_API_URL || "http://localhost:4000";
  const normalizedBase = base.replace(/\/+$/, "");
  const normalizedUrl = url.startsWith("/") ? url : `/${url}`;
  return `${normalizedBase}${normalizedUrl}`;
};

const ApproveReimbursements = () => {
  const [selected, setSelected] = useState<PendingReimbursement | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["reimbursements", "pending"],
    queryFn: () => api.reimbursements.pending(),
  });

  const reimbursements = useMemo(
    () => (data?.reimbursements as PendingReimbursement[] | undefined) ?? [],
    [data],
  );

  const reviewMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "approve" | "reject" }) => {
      if (action === "approve") {
        return api.reimbursements.approve(id);
      }
      return api.reimbursements.reject(id);
    },
    onSuccess: (_, variables) => {
      toast.success(`Reimbursement ${variables.action}d`);
      queryClient.invalidateQueries({ queryKey: ["reimbursements", "pending"] });
      setDialogOpen(false);
      setSelected(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update reimbursement");
    },
  });

  const openDialog = (claim: PendingReimbursement) => {
    setSelected(claim);
    setDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Reimbursement Approvals</h1>
          <p className="text-muted-foreground">
            Review and approve employee expense claims for your organization.
          </p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle>Pending Claims</CardTitle>
              <CardDescription>
                {reimbursements.length === 0
                  ? "No reimbursements waiting for review."
                  : `You have ${reimbursements.length} pending reimbursement${
                      reimbursements.length > 1 ? "s" : ""
                    }.`}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["reimbursements", "pending"] })}
            >
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : reimbursements.length === 0 ? (
              <p className="text-sm text-muted-foreground">All caught up! Nothing pending review.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Review</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reimbursements.map((claim) => (
                    <TableRow key={claim.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {[claim.first_name, claim.last_name].filter(Boolean).join(" ") || "Unknown"}
                          </span>
                          {claim.employee_code && (
                            <span className="text-xs text-muted-foreground">{claim.employee_code}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{claim.category}</TableCell>
                      <TableCell>{currencyFormatter.format(Number(claim.amount || 0))}</TableCell>
                      <TableCell>
                        {claim.submitted_at
                          ? new Date(claim.submitted_at).toLocaleString("en-IN")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{claim.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="secondary" size="sm" onClick={() => openDialog(claim)}>
                          Review
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

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && setDialogOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Reimbursement</DialogTitle>
            <DialogDescription>
              {selected
                ? `Submitted on ${new Date(selected.submitted_at).toLocaleString("en-IN")}`
                : "No claim selected"}
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Employee</p>
                <p className="font-medium">
                  {[selected.first_name, selected.last_name].filter(Boolean).join(" ") || "Unknown"}
                  {selected.employee_code ? ` • ${selected.employee_code}` : ""}
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Category</p>
                  <p className="font-medium">{selected.category}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Amount</p>
                  <p className="font-medium">{currencyFormatter.format(Number(selected.amount || 0))}</p>
                </div>
              </div>
              {selected.description && (
                <div>
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p className="font-medium whitespace-pre-wrap">{selected.description}</p>
                </div>
              )}
              {selected.receipt_url && (
                <div>
                  <p className="text-sm text-muted-foreground">Receipt</p>
                  <Button asChild variant="link" className="px-0">
                    <a
                      href={resolveReceiptLink(selected.receipt_url) ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Download receipt
                    </a>
                  </Button>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="pt-4">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={reviewMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!selected || reviewMutation.isPending}
              onClick={() => selected && reviewMutation.mutate({ id: selected.id, action: "reject" })}
            >
              Reject
            </Button>
            <Button
              disabled={!selected || reviewMutation.isPending}
              onClick={() => selected && reviewMutation.mutate({ id: selected.id, action: "approve" })}
            >
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ApproveReimbursements;

