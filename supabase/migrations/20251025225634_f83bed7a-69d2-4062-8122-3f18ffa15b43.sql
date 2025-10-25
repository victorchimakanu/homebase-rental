-- Enable pgcrypto extension for gen_random_uuid() support
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create messages table for tenant-landlord communication
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  landlord_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL CHECK (char_length(message) <= 500),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for efficient queries
CREATE INDEX idx_messages_landlord_id ON public.messages(landlord_id);
CREATE INDEX idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX idx_messages_property_id ON public.messages(property_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at);

-- Enable Row Level Security
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can insert messages where they are the sender
CREATE POLICY "messages_insert_policy" 
ON public.messages 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = sender_id);

-- Policy: Users can view messages where they are either the sender or the landlord
CREATE POLICY "messages_select_policy" 
ON public.messages 
FOR SELECT 
TO authenticated
USING (auth.uid() = sender_id OR auth.uid() = landlord_id);

-- Policy: Landlords can update messages they receive
-- Note: Application logic must restrict updates to the status column only
CREATE POLICY "messages_update_policy" 
ON public.messages 
FOR UPDATE 
TO authenticated
USING (auth.uid() = landlord_id)
WITH CHECK (auth.uid() = landlord_id);

-- No DELETE policy (implicit deny for all users)