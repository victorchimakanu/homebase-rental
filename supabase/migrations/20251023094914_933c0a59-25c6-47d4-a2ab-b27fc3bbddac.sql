-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('landlord', 'tenant');

-- Create user roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create properties/units table
CREATE TABLE public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  unit_number TEXT,
  rent_amount NUMERIC(10, 2) NOT NULL,
  deposit_amount NUMERIC(10, 2),
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

-- Create leases table
CREATE TABLE public.leases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  tenant_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  landlord_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  rent_amount NUMERIC(10, 2) NOT NULL,
  deposit_amount NUMERIC(10, 2),
  payment_due_day INTEGER NOT NULL DEFAULT 1 CHECK (payment_due_day BETWEEN 1 AND 31),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'terminated')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.leases ENABLE ROW LEVEL SECURITY;

-- Create rent payments table
CREATE TABLE public.rent_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID REFERENCES public.leases(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  due_date DATE NOT NULL,
  paid_date DATE,
  late_fee NUMERIC(10, 2) DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'partial')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.rent_payments ENABLE ROW LEVEL SECURITY;

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_leases_updated_at BEFORE UPDATE ON public.leases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rent_payments_updated_at BEFORE UPDATE ON public.rent_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    NEW.email
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own role during signup"
  ON public.user_roles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Landlords can view tenant profiles"
  ON public.profiles FOR SELECT
  USING (
    public.has_role(auth.uid(), 'landlord') AND
    EXISTS (
      SELECT 1 FROM public.leases
      WHERE leases.tenant_id = profiles.id
        AND leases.landlord_id = auth.uid()
    )
  );

-- RLS Policies for properties
CREATE POLICY "Landlords can view their own properties"
  ON public.properties FOR SELECT
  USING (public.has_role(auth.uid(), 'landlord') AND landlord_id = auth.uid());

CREATE POLICY "Landlords can insert their own properties"
  ON public.properties FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'landlord') AND landlord_id = auth.uid());

CREATE POLICY "Landlords can update their own properties"
  ON public.properties FOR UPDATE
  USING (public.has_role(auth.uid(), 'landlord') AND landlord_id = auth.uid());

CREATE POLICY "Landlords can delete their own properties"
  ON public.properties FOR DELETE
  USING (public.has_role(auth.uid(), 'landlord') AND landlord_id = auth.uid());

CREATE POLICY "Tenants can view their leased properties"
  ON public.properties FOR SELECT
  USING (
    public.has_role(auth.uid(), 'tenant') AND
    EXISTS (
      SELECT 1 FROM public.leases
      WHERE leases.property_id = properties.id
        AND leases.tenant_id = auth.uid()
        AND leases.status = 'active'
    )
  );

-- RLS Policies for leases
CREATE POLICY "Landlords can view their leases"
  ON public.leases FOR SELECT
  USING (public.has_role(auth.uid(), 'landlord') AND landlord_id = auth.uid());

CREATE POLICY "Landlords can create leases"
  ON public.leases FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'landlord') AND landlord_id = auth.uid());

CREATE POLICY "Landlords can update their leases"
  ON public.leases FOR UPDATE
  USING (public.has_role(auth.uid(), 'landlord') AND landlord_id = auth.uid());

CREATE POLICY "Landlords can delete their leases"
  ON public.leases FOR DELETE
  USING (public.has_role(auth.uid(), 'landlord') AND landlord_id = auth.uid());

CREATE POLICY "Tenants can view their own leases"
  ON public.leases FOR SELECT
  USING (public.has_role(auth.uid(), 'tenant') AND tenant_id = auth.uid());

-- RLS Policies for rent_payments
CREATE POLICY "Landlords can view payments for their leases"
  ON public.rent_payments FOR SELECT
  USING (
    public.has_role(auth.uid(), 'landlord') AND
    EXISTS (
      SELECT 1 FROM public.leases
      WHERE leases.id = rent_payments.lease_id
        AND leases.landlord_id = auth.uid()
    )
  );

CREATE POLICY "Landlords can create payments"
  ON public.rent_payments FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'landlord') AND
    EXISTS (
      SELECT 1 FROM public.leases
      WHERE leases.id = lease_id
        AND leases.landlord_id = auth.uid()
    )
  );

CREATE POLICY "Landlords can update payments"
  ON public.rent_payments FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'landlord') AND
    EXISTS (
      SELECT 1 FROM public.leases
      WHERE leases.id = rent_payments.lease_id
        AND leases.landlord_id = auth.uid()
    )
  );

CREATE POLICY "Tenants can view their own payments"
  ON public.rent_payments FOR SELECT
  USING (
    public.has_role(auth.uid(), 'tenant') AND
    EXISTS (
      SELECT 1 FROM public.leases
      WHERE leases.id = rent_payments.lease_id
        AND leases.tenant_id = auth.uid()
    )
  );