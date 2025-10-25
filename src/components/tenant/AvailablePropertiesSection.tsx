import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Home, MapPin, Building2, ChevronLeft, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import ContactLandlordDialog from "./ContactLandlordDialog";

const PAGE_SIZE = 12;

const AvailablePropertiesSection = () => {
  const [pageIndex, setPageIndex] = useState(0);
  const offset = pageIndex * PAGE_SIZE;

  const { data: properties, isLoading, error } = useQuery({
    queryKey: ["available-properties", offset],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, name, address, unit_number, landlord_id, created_at, rent_amount")
        .eq("status", "available")
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) throw error;
      return data;
    },
  });

  const handlePrevPage = () => {
    setPageIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNextPage = () => {
    setPageIndex((prev) => prev + 1);
  };

  const hasNextPage = properties && properties.length === PAGE_SIZE;
  const hasPrevPage = pageIndex > 0;

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Available Properties</CardTitle>
          <CardDescription>Browse rental properties available for lease</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-destructive">
            Failed to load properties. Please try again later.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Available Properties</CardTitle>
        <CardDescription>Browse rental properties available for lease</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : properties && properties.length > 0 ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {properties.map((property) => (
                <Card key={property.id} className="flex flex-col">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Home className="h-5 w-5" />
                      {property.name}
                    </CardTitle>
                    <CardDescription className="space-y-1">
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span>{property.address}</span>
                      </div>
                      {property.unit_number && (
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 flex-shrink-0" />
                          <span>Unit {property.unit_number}</span>
                        </div>
                      )}
                      <div className="font-semibold text-foreground mt-2">
                        ${property.rent_amount}/month
                      </div>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="mt-auto">
                    <ContactLandlordDialog
                      propertyId={property.id}
                      landlordId={property.landlord_id}
                      propertyName={property.name}
                      trigger={
                        <Button className="w-full">
                          Contact Landlord
                        </Button>
                      }
                    />
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevPage}
                disabled={!hasPrevPage}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {pageIndex + 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={!hasNextPage}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <Home className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No Available Properties</p>
            <p className="text-sm text-muted-foreground mt-1">
              Check back later for new rental listings
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AvailablePropertiesSection;
