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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [properties, leases, payments] = await Promise.all([
      supabase.from("properties").select("*", { count: "exact" }).eq("landlord_id", user.id),
      supabase.from("leases").select("*", { count: "exact" }).eq("landlord_id", user.id).eq("status", "active"),
      supabase.from("rent_payments").select("*, leases!inner(landlord_id)").eq("leases.landlord_id", user.id),
    ]);

    const pendingPayments = payments.data?.filter(p => p.status === "pending" || p.status === "overdue").length || 0;
    const totalRevenue = payments.data
      ?.filter(p => p.status === "paid")
      .reduce((sum, p) => sum + Number(p.amount) + Number(p.late_fee), 0) || 0;

    setStats({
      properties: properties.count || 0,
      activeLeases: leases.count || 0,
      pendingPayments,
      totalRevenue,
    });
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
