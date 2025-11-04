import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, FileText, DollarSign } from "lucide-react";
import PropertiesSection from "./PropertiesSection";
import LeasesSection from "./LeasesSection";
import PaymentsSection from "./PaymentsSection";

const LandlordDashboard = () => {
  const [stats, setStats] = useState({
    properties: 0,
    activeLeases: 0,
    pendingPayments: 0,
    totalRevenue: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) return;

      const [properties, leases, payments] = await Promise.all([
        supabase.from("properties").select("*", { count: "exact" }).eq("landlord_id", user.id),
        supabase.from("leases").select("*", { count: "exact" }).eq("landlord_id", user.id).eq("status", "active"),
        // Fetch only necessary fields and filter at database level
        supabase.from("rent_payments")
          .select("amount, late_fee, status, leases!inner(landlord_id)")
          .eq("leases.landlord_id", user.id),
      ]);

      if (properties.error) throw properties.error;
      if (leases.error) throw leases.error;
      if (payments.error) throw payments.error;

      // Use single reduce for better performance
      const paymentStats = (payments.data || []).reduce(
        (acc, p) => {
          if (p.status === "pending" || p.status === "overdue") {
            acc.pendingPayments++;
          } else if (p.status === "paid") {
            acc.totalRevenue += Number(p.amount) + Number(p.late_fee);
          }
          return acc;
        },
        { pendingPayments: 0, totalRevenue: 0 }
      );

      setStats({
        properties: properties.count || 0,
        activeLeases: leases.count || 0,
        pendingPayments: paymentStats.pendingPayments,
        totalRevenue: paymentStats.totalRevenue,
      });
    } catch (error: any) {
      console.error("Error loading stats:", error);
      // Silently fail for stats - user can still use the dashboard
      setStats({
        properties: 0,
        activeLeases: 0,
        pendingPayments: 0,
        totalRevenue: 0,
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Properties</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.properties}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Leases</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeLeases}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingPayments}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalRevenue.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      <PropertiesSection onUpdate={loadStats} />
      <LeasesSection onUpdate={loadStats} />
      <PaymentsSection onUpdate={loadStats} />
    </div>
  );
};

export default LandlordDashboard;
