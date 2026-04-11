-- 004: Role-based access + notifications + farmer-owner assignment

-- 1. Add role column to users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'petani';

-- Set all existing users as admin (preserve access)
UPDATE public.users SET role = 'admin' WHERE role = 'petani';

-- Index for fast role lookup
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- 2. Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT false,
  link TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id, is_read) WHERE is_read = false;

-- 3. Farmer-Owner assignment table
CREATE TABLE IF NOT EXISTS public.farmer_owners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  owner_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, owner_name)
);

CREATE INDEX IF NOT EXISTS idx_farmer_owners_user_id ON public.farmer_owners(user_id);
CREATE INDEX IF NOT EXISTS idx_farmer_owners_owner_name ON public.farmer_owners(owner_name);
