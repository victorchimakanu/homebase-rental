-- Enable RLS on properties table (idempotent)
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists (for idempotency)
DROP POLICY IF EXISTS "properties_available_select" ON public.properties;

-- Create policy to allow authenticated users to view available properties
-- This allows tenants and other authenticated users to browse available properties
-- Existing policies (landlord ownership, tenant leases) remain unchanged and are OR-composed
CREATE POLICY "properties_available_select" 
ON public.properties 
FOR SELECT 
TO authenticated
USING (status = 'available');