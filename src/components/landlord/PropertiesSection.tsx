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

interface Property {
  id: string;
  name: string;
  address: string;
  unit_number: string | null;
  rent_amount: number;
  deposit_amount: number | null;
  status: string;
}

const PropertiesSection = ({ onUpdate }: { onUpdate: () => void }) => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [open, setOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadProperties();
  }, []);

  const loadProperties = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("properties")
      .select("*")
      .eq("landlord_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error loading properties", description: error.message, variant: "destructive" });
    } else {
      setProperties(data || []);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const propertyData = {
      landlord_id: user.id,
      name: formData.get("name") as string,
      address: formData.get("address") as string,
      unit_number: formData.get("unit_number") as string || null,
      rent_amount: parseFloat(formData.get("rent_amount") as string),
      deposit_amount: parseFloat(formData.get("deposit_amount") as string) || null,
      status: formData.get("status") as string,
    };

    if (editingProperty) {
      const { error } = await supabase
        .from("properties")
        .update(propertyData)
        .eq("id", editingProperty.id);

      if (error) {
        toast({ title: "Error updating property", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Property updated successfully" });
        setOpen(false);
        setEditingProperty(null);
        loadProperties();
        onUpdate();
      }
    } else {
      const { error } = await supabase.from("properties").insert(propertyData);

      if (error) {
        toast({ title: "Error creating property", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Property created successfully" });
        setOpen(false);
        loadProperties();
        onUpdate();
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this property?")) return;

    const { error } = await supabase.from("properties").delete().eq("id", id);

    if (error) {
      toast({ title: "Error deleting property", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Property deleted successfully" });
      loadProperties();
      onUpdate();
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Properties</CardTitle>
          <CardDescription>Manage your rental properties and units</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditingProperty(null); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Property
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingProperty ? "Edit Property" : "Add New Property"}</DialogTitle>
              <DialogDescription>Enter the property details below</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Property Name</Label>
                <Input id="name" name="name" required defaultValue={editingProperty?.name} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input id="address" name="address" required defaultValue={editingProperty?.address} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit_number">Unit Number (optional)</Label>
                <Input id="unit_number" name="unit_number" defaultValue={editingProperty?.unit_number || ""} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rent_amount">Monthly Rent</Label>
                  <Input id="rent_amount" name="rent_amount" type="number" step="0.01" required defaultValue={editingProperty?.rent_amount} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deposit_amount">Deposit Amount</Label>
                  <Input id="deposit_amount" name="deposit_amount" type="number" step="0.01" defaultValue={editingProperty?.deposit_amount || ""} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select name="status" defaultValue={editingProperty?.status || "available"}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="occupied">Occupied</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full">
                {editingProperty ? "Update Property" : "Create Property"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Rent</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {properties.map((property) => (
              <TableRow key={property.id}>
                <TableCell className="font-medium">{property.name}</TableCell>
                <TableCell>{property.address}</TableCell>
                <TableCell>{property.unit_number || "-"}</TableCell>
                <TableCell>${property.rent_amount}</TableCell>
                <TableCell>
                  <Badge variant={property.status === "available" ? "default" : property.status === "occupied" ? "secondary" : "outline"}>
                    {property.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setEditingProperty(property); setOpen(true); }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(property.id)}
                  >
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

export default PropertiesSection;
