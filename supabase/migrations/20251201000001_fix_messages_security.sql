-- Fix Messages Table Security Issues
-- Addresses issue #143: Insufficient access control in update policy

-- Drop the existing insecure update policy
DROP POLICY IF EXISTS "messages_update_policy" ON public.messages;

-- Create a new, more restrictive update policy that only allows status updates
-- Use a CHECK constraint to enforce column-level restrictions
CREATE POLICY "messages_update_policy_status_only" 
ON public.messages 
FOR UPDATE 
TO authenticated
USING (auth.uid() = landlord_id)
WITH CHECK (
  auth.uid() = landlord_id AND
  -- Ensure only status can be updated by checking unchanged fields
  property_id = (SELECT property_id FROM public.messages WHERE id = messages.id) AND
  landlord_id = (SELECT landlord_id FROM public.messages WHERE id = messages.id) AND
  sender_id = (SELECT sender_id FROM public.messages WHERE id = messages.id) AND
  message = (SELECT message FROM public.messages WHERE id = messages.id) AND
  created_at = (SELECT created_at FROM public.messages WHERE id = messages.id)
);

-- Add constraint to ensure sender and landlord are different users
ALTER TABLE public.messages
ADD CONSTRAINT messages_sender_not_landlord CHECK (sender_id != landlord_id);

-- Add constraint to ensure property belongs to landlord
-- This is enforced at insert time via a function
CREATE OR REPLACE FUNCTION public.validate_message_property()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify that the property belongs to the specified landlord
  IF NOT EXISTS (
    SELECT 1 FROM public.properties
    WHERE id = NEW.property_id AND landlord_id = NEW.landlord_id
  ) THEN
    RAISE EXCEPTION 'Property does not belong to the specified landlord';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_message_property_trigger
BEFORE INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.validate_message_property();

COMMENT ON POLICY "messages_update_policy_status_only" ON public.messages IS
  'Landlords can only update the status column of messages they receive. All other columns are protected from modification.';
