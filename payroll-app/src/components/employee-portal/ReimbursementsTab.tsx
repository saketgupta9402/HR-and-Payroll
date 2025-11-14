import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import {
  REIMBURSEMENT_CATEGORIES,
  REIMBURSEMENT_CATEGORY_LABELS,
  ReimbursementCategoryValue,
} from "@/constants/reimbursements";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

type ReimbursementRecord = {
  id: string;
  category: string;
  category_value?: string;
  category_label?: string;
  amount: string | number;
  description?: string | null;
  receipt_url?: string | null;
  status: "pending" | "approved" | "rejected" | "paid";
  submitted_at: string;
  reviewed_at?: string | null;
};

type FormValues = {
  category: ReimbursementCategoryValue;
  amount: string;
  description: string;
  receipt: File | null;
};

const statusVariants: Record<ReimbursementRecord["status"], string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-rose-100 text-rose-800",
  paid: "bg-blue-100 text-blue-800",
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

export const ReimbursementsTab = () => {
  const queryClient = useQueryClient();
  const form = useForm<FormValues>({
    defaultValues: {
      category: REIMBURSEMENT_CATEGORIES[0].value,
      amount: "",
      description: "",
      receipt: null,
    },
  });

  const { data: reimbursementsResponse, isLoading } = useQuery({
    queryKey: ["reimbursements", "my-claims"],
    queryFn: async () => {
      const response = await api.reimbursements.myClaims();
      return response.reimbursements as ReimbursementRecord[] | undefined;
    },
  });

  const reimbursements = useMemo(
    () => reimbursementsResponse ?? [],
    [reimbursementsResponse],
  );

  const submitMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = new FormData();
      payload.append("category", values.category);
      payload.append("amount", values.amount);
      payload.append("description", values.description || "");
      if (values.receipt) {
        payload.append("receipt", values.receipt);
      }
      return api.reimbursements.submit(payload);
    },
    onSuccess: () => {
      toast.success("Reimbursement submitted");
      form.reset({
        category: REIMBURSEMENT_CATEGORIES[0].value,
        amount: "",
        description: "",
        receipt: null,
      });
      queryClient.invalidateQueries({ queryKey: ["reimbursements", "my-claims"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to submit reimbursement");
    },
  });

  const onSubmit = (values: FormValues) => {
    submitMutation.mutate(values);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Submit Reimbursement</CardTitle>
          <CardDescription>Upload receipts for work-related expenses.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="category"
                  rules={{ required: "Category is required" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {REIMBURSEMENT_CATEGORIES.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="amount"
                  rules={{
                    required: "Amount is required",
                    validate: (value) => (parseFloat(value) > 0 ? true : "Enter a positive amount"),
                  }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount (INR)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea rows={4} placeholder="Add context for this expense" {...field} />
                    </FormControl>
                    <FormDescription>Optional context for reviewers.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="receipt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Receipt</FormLabel>
                    <FormControl>
                      <Input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          field.onChange(file);
                        }}
                      />
                    </FormControl>
                    <FormDescription>Upload a PDF or image (max 10 MB).</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={submitMutation.isPending}>
                {submitMutation.isPending ? "Submitting..." : "Submit Claim"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Submission History</CardTitle>
          <CardDescription>Track the review status of your claims.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : reimbursements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reimbursement claims yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Receipt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reimbursements.map((claim) => {
                  const amountValue = Number(claim.amount || 0);
                  const submittedDate = claim.submitted_at
                    ? new Date(claim.submitted_at).toLocaleString("en-IN")
                    : "-";
                  const receiptLink = resolveReceiptLink(claim.receipt_url);
                  const categoryLabel =
                    claim.category_label ||
                    REIMBURSEMENT_CATEGORY_LABELS[claim.category_value || claim.category] ||
                    claim.category ||
                    "Other";
                  return (
                    <TableRow key={claim.id}>
                      <TableCell className="font-medium">{categoryLabel}</TableCell>
                      <TableCell>{currencyFormatter.format(amountValue)}</TableCell>
                      <TableCell>
                        <Badge className={statusVariants[claim.status]}>{claim.status}</Badge>
                      </TableCell>
                      <TableCell>{submittedDate}</TableCell>
                      <TableCell>
                        {receiptLink ? (
                          <Button variant="link" asChild className="px-0">
                            <a href={receiptLink} target="_blank" rel="noopener noreferrer">
                              View Receipt
                            </a>
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

