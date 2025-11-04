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
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) return;

      // Fetch leases with properties and profiles in a single query using JOIN
      const { data: leasesData, error } = await supabase
        .from("leases")
        .select(`
          *,
          properties(name, address),
          profiles:tenant_id(full_name, email)
        `)
        .eq("landlord_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        toast({ title: "Error loading leases", description: error.message, variant: "destructive" });
        return;
      }

      // Format the data to match expected structure
      const formattedLeases = (leasesData || []).map((lease: any) => ({
        ...lease,
        profiles: lease.profiles || { full_name: "Unknown", email: "" },
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

  const loadProperties = async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) return;

      const { data, error } = await supabase
        .from("properties")
        .select("id, name")
        .eq("landlord_id", user.id);

      if (error) throw error;
      setProperties(data || []);
    } catch (error: any) {
      console.error("Error loading properties:", error);
      toast({ 
        title: "Error loading properties", 
        description: "Failed to load properties. Please try again.", 
        variant: "destructive" 
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const formData = new FormData(e.currentTarget);
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) {
        toast({ title: "Error", description: "You must be logged in", variant: "destructive" });
        return;
      }

      // Validate tenant email format
      if (!tenantEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tenantEmail)) {
        toast({ title: "Error", description: "Please provide a valid tenant email", variant: "destructive" });
        return;
      }

      // Find tenant by email
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", tenantEmail)
        .single();

      if (profileError || !profile) {
        toast({ title: "Error", description: "Tenant not found with this email", variant: "destructive" });
        return;
      }

      // Validate and parse form data
      const rentAmount = parseFloat(formData.get("rent_amount") as string);
      const depositAmount = formData.get("deposit_amount") ? parseFloat(formData.get("deposit_amount") as string) : null;
      const paymentDueDay = parseInt(formData.get("payment_due_day") as string);
      
      if (isNaN(rentAmount) || rentAmount <= 0) {
        toast({ title: "Error", description: "Please provide a valid rent amount", variant: "destructive" });
        return;
      }
      
      if (depositAmount !== null && (isNaN(depositAmount) || depositAmount < 0)) {
        toast({ title: "Error", description: "Please provide a valid deposit amount", variant: "destructive" });
        return;
      }
      
      if (isNaN(paymentDueDay) || paymentDueDay < 1 || paymentDueDay > 31) {
        toast({ title: "Error", description: "Payment due day must be between 1 and 31", variant: "destructive" });
        return;
      }

      const leaseData = {
        landlord_id: user.id,
        property_id: formData.get("property_id") as string,
        tenant_id: profile.id,
        start_date: formData.get("start_date") as string,
        end_date: formData.get("end_date") as string,
        rent_amount: rentAmount,
        deposit_amount: depositAmount,
        payment_due_day: paymentDueDay,
        status: formData.get("status") as string,
      };

      const { error } = await supabase.from("leases").insert(leaseData);

      if (error) {
        console.error("Error creating lease:", error);
        toast({ title: "Error creating lease", description: "Failed to create lease. Please try again.", variant: "destructive" });
      } else {
        toast({ title: "Lease created successfully" });
        setOpen(false);
        setTenantEmail("");
        loadLeases();
        onUpdate();
      }
    } catch (error: any) {
      console.error("Unexpected error creating lease:", error);
      toast({ title: "Error", description: "An unexpected error occurred", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this lease?")) return;

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) {
        toast({ title: "Error", description: "You must be logged in", variant: "destructive" });
        return;
      }

      const { error } = await supabase.from("leases").delete().eq("id", id);

      if (error) {
        console.error("Error deleting lease:", error);
        toast({ title: "Error deleting lease", description: "Failed to delete lease. Please try again.", variant: "destructive" });
      } else {
        toast({ title: "Lease deleted successfully" });
        loadLeases();
        onUpdate();
      }
    } catch (error: any) {
      console.error("Unexpected error deleting lease:", error);
      toast({ title: "Error", description: "An unexpected error occurred", variant: "destructive" });
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
