import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import AvailablePropertiesSection from "./AvailablePropertiesSection";

interface Lease {
  id: string;
  start_date: string;
  end_date: string;
  rent_amount: number;
  deposit_amount: number;
  payment_due_day: number;
  status: string;
  properties: {
    name: string;
    address: string;
    unit_number: string;
  };
}

interface Payment {
  id: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  late_fee: number;
  status: string;
  notes: string | null;
}

const TenantDashboard = () => {
  const [lease, setLease] = useState<Lease | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);

  useEffect(() => {
    loadTenantData();
  }, []);

  const loadTenantData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: leaseData } = await supabase
      .from("leases")
      .select("*, properties(*)")
      .eq("tenant_id", user.id)
      .eq("status", "active")
      .single();

    if (leaseData) {
      setLease(leaseData);

      const { data: paymentsData } = await supabase
        .from("rent_payments")
        .select("*")
        .eq("lease_id", leaseData.id)
        .order("due_date", { ascending: false });

      setPayments(paymentsData || []);
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
    <div className="space-y-6">
      <AvailablePropertiesSection />
      
      {lease ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Your Lease</CardTitle>
              <CardDescription>Active lease agreement details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Property</p>
                  <p className="font-medium">{lease.properties.name}</p>
                  <p className="text-sm">{lease.properties.address}</p>
                  {lease.properties.unit_number && (
                    <p className="text-sm">Unit {lease.properties.unit_number}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Lease Period</p>
                  <p className="font-medium">
                    {format(new Date(lease.start_date), "MMM d, yyyy")} -{" "}
                    {format(new Date(lease.end_date), "MMM d, yyyy")}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Monthly Rent</p>
                  <p className="font-medium text-2xl">${lease.rent_amount}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Payment Due</p>
                  <p className="font-medium">Day {lease.payment_due_day} of each month</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
              <CardDescription>Your rent payment records</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Late Fee</TableHead>
                    <TableHead>Paid Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>{format(new Date(payment.due_date), "MMM d, yyyy")}</TableCell>
                      <TableCell>${payment.amount}</TableCell>
                      <TableCell>{payment.late_fee > 0 ? `$${payment.late_fee}` : "-"}</TableCell>
                      <TableCell>
                        {payment.paid_date ? format(new Date(payment.paid_date), "MMM d, yyyy") : "-"}
                      </TableCell>
                      <TableCell>{getStatusBadge(payment.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No Active Lease</CardTitle>
            <CardDescription>
              You don't have an active lease at the moment. Contact your landlord for more information.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
};

export default TenantDashboard;
