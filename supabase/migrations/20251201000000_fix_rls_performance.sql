-- Fix RLS Performance Issues and Security Concerns
-- This migration addresses N+1 query patterns and security issues in RLS policies

-- 1. Add CHECK constraint for lease date validation
ALTER TABLE public.leases
ADD CONSTRAINT leases_dates_check CHECK (end_date > start_date);

-- 2. Add CHECK constraint to prevent amount being negative
ALTER TABLE public.rent_payments
ADD CONSTRAINT rent_payments_amount_check CHECK (amount > 0);

ALTER TABLE public.rent_payments
ADD CONSTRAINT rent_payments_late_fee_check CHECK (late_fee >= 0);

-- 3. Create indexes to improve RLS policy performance
CREATE INDEX IF NOT EXISTS idx_leases_tenant_id ON public.leases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leases_landlord_id ON public.leases(landlord_id);
CREATE INDEX IF NOT EXISTS idx_leases_property_id ON public.leases(property_id);
CREATE INDEX IF NOT EXISTS idx_rent_payments_lease_id ON public.rent_payments(lease_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_properties_landlord_id ON public.properties(landlord_id);
CREATE INDEX IF NOT EXISTS idx_properties_status ON public.properties(status) WHERE status = 'available';

-- 4. Add error handling to handle_new_user trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    INSERT INTO public.profiles (id, full_name, email)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
      NEW.email
    );
  EXCEPTION WHEN OTHERS THEN
    -- Log the error but don't prevent user creation
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

-- 5. Restrict user_roles insert policy to prevent privilege escalation
-- Drop and recreate with better validation
DROP POLICY IF EXISTS "Users can insert their own role during signup" ON public.user_roles;

CREATE POLICY "Users can insert their own role during signup"
  ON public.user_roles FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    -- Limit to one role per user
    NOT EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_roles.user_id = auth.uid()
    )
  );

-- 6. Add comment explaining RLS performance considerations
COMMENT ON FUNCTION public.has_role IS 
  'Security definer function to check user role. Uses STABLE to allow query planner to cache results within a single query execution.';

COMMENT ON POLICY "Landlords can view tenant profiles" ON public.profiles IS
  'Uses EXISTS subquery - PostgreSQL should optimize this with semi-join. Consider materializing leases if performance degrades.';
