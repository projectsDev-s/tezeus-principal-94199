-- Create quick_funnels table
CREATE TABLE public.quick_funnels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  title TEXT NOT NULL,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Disable RLS (following pattern from other quick_* tables)
ALTER TABLE public.quick_funnels DISABLE ROW LEVEL SECURITY;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_quick_funnels_updated_at
  BEFORE UPDATE ON public.quick_funnels
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();