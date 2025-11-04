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
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) return;

      // Fetch payments with leases, properties, and profiles in a single query using JOIN
      const { data: paymentsData, error } = await supabase
        .from("rent_payments")
        .select(`
          *,
          leases!inner(
            landlord_id,
            tenant_id,
            properties(name),
            profiles:tenant_id(full_name)
          )
        `)
        .eq("leases.landlord_id", user.id)
        .order("due_date", { ascending: false });

      if (error) {
        toast({ title: "Error loading payments", description: error.message, variant: "destructive" });
        return;
      }

      // Format the data to match expected structure
      const formattedPayments = (paymentsData || []).map((payment: any) => ({
        ...payment,
        leases: {
          ...payment.leases,
          profiles: payment.leases.profiles || { full_name: "Unknown" },
        },
      }));

      setPayments(formattedPayments);
    } catch (error: any) {
      console.error("Error loading payments:", error);
      toast({ 
        title: "Error loading payments", 
        description: "Failed to load payments. Please try again.", 
        variant: "destructive" 
      });
    }
  };

  const loadLeases = async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) return;

      // Fetch leases with properties and profiles in a single query using JOIN
      const { data: leasesData, error } = await supabase
        .from("leases")
        .select(`
          id,
          rent_amount,
          tenant_id,
          properties(name),
          profiles:tenant_id(full_name)
        `)
        .eq("landlord_id", user.id)
        .eq("status", "active");

      if (error) throw error;

      // Format the data to match expected structure
      const formattedLeases = (leasesData || []).map((lease: any) => ({
        ...lease,
        profiles: lease.profiles || { full_name: "Unknown" },
      }));

      setLeases(formattedLeases);
    } catch (error: any) {
      console.error("Error loading leases:", error);
      toast({ 
        title: "Error loading leases", 
        description: "Failed to load leases. Please try again.", 
        variant: "destructive" 
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const formData = new FormData(e.currentTarget);

      // Validate and parse amount
      const amount = parseFloat(formData.get("amount") as string);
      if (isNaN(amount) || amount <= 0) {
        toast({ title: "Error", description: "Please provide a valid amount greater than 0", variant: "destructive" });
        return;
      }

      const paymentData = {
        lease_id: formData.get("lease_id") as string,
        amount: amount,
        due_date: formData.get("due_date") as string,
        status: "pending",
        late_fee: 0,
      };

      const { error } = await supabase.from("rent_payments").insert(paymentData);

      if (error) {
        console.error("Error creating payment:", error);
        toast({ title: "Error creating payment", description: "Failed to create payment. Please try again.", variant: "destructive" });
      } else {
        toast({ title: "Payment record created successfully" });
        setOpen(false);
        loadPayments();
        onUpdate();
      }
    } catch (error: any) {
      console.error("Unexpected error creating payment:", error);
      toast({ title: "Error", description: "An unexpected error occurred", variant: "destructive" });
    }
  };

  const markAsPaid = async (id: string) => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) {
        toast({ title: "Error", description: "You must be logged in", variant: "destructive" });
        return;
      }

      const { error } = await supabase
        .from("rent_payments")
        .update({ status: "paid", paid_date: new Date().toISOString() })
        .eq("id", id);

      if (error) {
        console.error("Error updating payment:", error);
        toast({ title: "Error updating payment", description: "Failed to update payment. Please try again.", variant: "destructive" });
      } else {
        toast({ title: "Payment marked as paid" });
        loadPayments();
        onUpdate();
      }
    } catch (error: any) {
      console.error("Unexpected error updating payment:", error);
      toast({ title: "Error", description: "An unexpected error occurred", variant: "destructive" });
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
