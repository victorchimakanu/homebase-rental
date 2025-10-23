import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Payment {
  id: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  late_fee: number;
  status: string;
  leases: {
    properties: { name: string };
    profiles: { full_name: string };
  };
}

interface Lease {
  id: string;
  rent_amount: number;
  properties: { name: string };
  profiles: { full_name: string };
}

const PaymentsSection = ({ onUpdate }: { onUpdate: () => void }) => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadPayments();
    loadLeases();
  }, []);

  const loadPayments = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: paymentsData, error } = await supabase
      .from("rent_payments")
      .select("*, leases!inner(landlord_id, tenant_id, properties(name))")
      .eq("leases.landlord_id", user.id)
      .order("due_date", { ascending: false });

    if (error) {
      toast({ title: "Error loading payments", description: error.message, variant: "destructive" });
      return;
    }

    // Fetch tenant profiles separately
    const paymentsWithProfiles = await Promise.all(
      (paymentsData || []).map(async (payment) => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", payment.leases.tenant_id)
          .single();

        return {
          ...payment,
          leases: {
            ...payment.leases,
            profiles: profile || { full_name: "Unknown" },
          },
        };
      })
    );

    setPayments(paymentsWithProfiles);
  };

  const loadLeases = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: leasesData } = await supabase
      .from("leases")
      .select("id, rent_amount, tenant_id, properties(name)")
      .eq("landlord_id", user.id)
      .eq("status", "active");

    // Fetch tenant profiles separately
    const leasesWithProfiles = await Promise.all(
      (leasesData || []).map(async (lease) => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", lease.tenant_id)
          .single();

        return {
          ...lease,
          profiles: profile || { full_name: "Unknown" },
        };
      })
    );

    setLeases(leasesWithProfiles);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const paymentData = {
      lease_id: formData.get("lease_id") as string,
      amount: parseFloat(formData.get("amount") as string),
      due_date: formData.get("due_date") as string,
      status: "pending",
      late_fee: 0,
    };

    const { error } = await supabase.from("rent_payments").insert(paymentData);

    if (error) {
      toast({ title: "Error creating payment", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Payment record created successfully" });
      setOpen(false);
      loadPayments();
      onUpdate();
    }
  };

  const markAsPaid = async (id: string) => {
    const { error } = await supabase
      .from("rent_payments")
      .update({ status: "paid", paid_date: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      toast({ title: "Error updating payment", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Payment marked as paid" });
      loadPayments();
      onUpdate();
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      paid: "default",
      pending: "secondary",
      overdue: "destructive",
      partial: "outline",
    };
    return <Badge variant={variants[status] || "default"}>{status}</Badge>;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Rent Payments</CardTitle>
          <CardDescription>Track rent payments and late fees</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Payment
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Payment Record</DialogTitle>
              <DialogDescription>Enter the payment details below</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="lease_id">Lease</Label>
                <Select name="lease_id" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select lease" />
                  </SelectTrigger>
                  <SelectContent>
                    {leases.map((lease) => (
                      <SelectItem key={lease.id} value={lease.id}>
                        {lease.properties.name} - {lease.profiles.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input id="amount" name="amount" type="number" step="0.01" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="due_date">Due Date</Label>
                <Input id="due_date" name="due_date" type="date" required />
              </div>
              <Button type="submit" className="w-full">Create Payment Record</Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Property</TableHead>
              <TableHead>Tenant</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Late Fee</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell className="font-medium">{payment.leases.properties.name}</TableCell>
                <TableCell>{payment.leases.profiles.full_name}</TableCell>
                <TableCell>{format(new Date(payment.due_date), "MMM d, yyyy")}</TableCell>
                <TableCell>${payment.amount}</TableCell>
                <TableCell>{payment.late_fee > 0 ? `$${payment.late_fee}` : "-"}</TableCell>
                <TableCell>{getStatusBadge(payment.status)}</TableCell>
                <TableCell className="text-right">
                  {payment.status !== "paid" && (
                    <Button variant="ghost" size="sm" onClick={() => markAsPaid(payment.id)}>
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default PaymentsSection;
