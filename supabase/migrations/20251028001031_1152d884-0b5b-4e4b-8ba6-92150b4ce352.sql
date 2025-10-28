-- Criar tabela para funis de mensagens rápidas
CREATE TABLE public.quick_funnels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  title TEXT NOT NULL,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.quick_funnels ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS
CREATE POLICY "Usuários podem ver funis do workspace"
  ON public.quick_funnels
  FOR SELECT
  USING (
    is_workspace_member(workspace_id, 'user'::system_profile)
  );

CREATE POLICY "Usuários podem criar funis no workspace"
  ON public.quick_funnels
  FOR INSERT
  WITH CHECK (
    is_workspace_member(workspace_id, 'user'::system_profile)
  );

CREATE POLICY "Usuários podem atualizar funis do workspace"
  ON public.quick_funnels
  FOR UPDATE
  USING (
    is_workspace_member(workspace_id, 'user'::system_profile)
  );

CREATE POLICY "Usuários podem deletar funis do workspace"
  ON public.quick_funnels
  FOR DELETE
  USING (
    is_workspace_member(workspace_id, 'user'::system_profile)
  );

-- Criar trigger para updated_at
CREATE TRIGGER update_quick_funnels_updated_at
  BEFORE UPDATE ON public.quick_funnels
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();