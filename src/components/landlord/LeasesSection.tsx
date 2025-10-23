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
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Lease {
  id: string;
  start_date: string;
  end_date: string;
  rent_amount: number;
  payment_due_day: number;
  status: string;
  properties: { name: string; address: string };
  profiles: { full_name: string; email: string };
}

interface Property {
  id: string;
  name: string;
}

const LeasesSection = ({ onUpdate }: { onUpdate: () => void }) => {
  const [leases, setLeases] = useState<Lease[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [open, setOpen] = useState(false);
  const [tenantEmail, setTenantEmail] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    loadLeases();
    loadProperties();
  }, []);

  const loadLeases = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: leasesData, error } = await supabase
      .from("leases")
      .select("*, properties(name, address)")
      .eq("landlord_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error loading leases", description: error.message, variant: "destructive" });
      return;
    }

    // Fetch tenant profiles separately
    const leasesWithProfiles = await Promise.all(
      (leasesData || []).map(async (lease) => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", lease.tenant_id)
          .single();

        return {
          ...lease,
          profiles: profile || { full_name: "Unknown", email: "" },
        };
      })
    );

    setLeases(leasesWithProfiles);
  };

  const loadProperties = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("properties")
      .select("id, name")
      .eq("landlord_id", user.id);

    setProperties(data || []);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Find tenant by email
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", tenantEmail)
      .single();

    if (!profile) {
      toast({ title: "Error", description: "Tenant not found with this email", variant: "destructive" });
      return;
    }

    const leaseData = {
      landlord_id: user.id,
      property_id: formData.get("property_id") as string,
      tenant_id: profile.id,
      start_date: formData.get("start_date") as string,
      end_date: formData.get("end_date") as string,
      rent_amount: parseFloat(formData.get("rent_amount") as string),
      deposit_amount: parseFloat(formData.get("deposit_amount") as string) || null,
      payment_due_day: parseInt(formData.get("payment_due_day") as string),
      status: formData.get("status") as string,
    };

    const { error } = await supabase.from("leases").insert(leaseData);

    if (error) {
      toast({ title: "Error creating lease", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Lease created successfully" });
      setOpen(false);
      setTenantEmail("");
      loadLeases();
      onUpdate();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this lease?")) return;

    const { error } = await supabase.from("leases").delete().eq("id", id);

    if (error) {
      toast({ title: "Error deleting lease", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Lease deleted successfully" });
      loadLeases();
      onUpdate();
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Leases</CardTitle>
          <CardDescription>Manage lease agreements</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Lease
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Lease</DialogTitle>
              <DialogDescription>Enter the lease details below</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="property_id">Property</Label>
                <Select name="property_id" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select property" />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.map((property) => (
                      <SelectItem key={property.id} value={property.id}>
                        {property.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tenant_email">Tenant Email</Label>
                <Input
                  id="tenant_email"
                  type="email"
                  value={tenantEmail}
                  onChange={(e) => setTenantEmail(e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input id="start_date" name="start_date" type="date" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">End Date</Label>
                  <Input id="end_date" name="end_date" type="date" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rent_amount">Monthly Rent</Label>
                  <Input id="rent_amount" name="rent_amount" type="number" step="0.01" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deposit_amount">Deposit</Label>
                  <Input id="deposit_amount" name="deposit_amount" type="number" step="0.01" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="payment_due_day">Payment Due Day</Label>
                  <Input id="payment_due_day" name="payment_due_day" type="number" min="1" max="31" defaultValue="1" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select name="status" defaultValue="active">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                      <SelectItem value="terminated">Terminated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="submit" className="w-full">Create Lease</Button>
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
              <TableHead>Period</TableHead>
              <TableHead>Rent</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leases.map((lease) => (
              <TableRow key={lease.id}>
                <TableCell className="font-medium">{lease.properties.name}</TableCell>
                <TableCell>{lease.profiles.full_name}</TableCell>
                <TableCell>
                  {format(new Date(lease.start_date), "MMM d, yyyy")} - {format(new Date(lease.end_date), "MMM d, yyyy")}
                </TableCell>
                <TableCell>${lease.rent_amount}</TableCell>
                <TableCell>
                  <Badge variant={lease.status === "active" ? "default" : "secondary"}>{lease.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(lease.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default LeasesSection;
