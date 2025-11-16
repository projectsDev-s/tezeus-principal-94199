import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/use-toast';

interface QuickMedia {
  id: string;
  title: string;
  file_url: string;
  file_name: string;
  file_type: string;
  caption?: string;
  workspace_id: string;
  created_at: string;
  updated_at: string;
}

export const useQuickMedia = () => {
  const [media, setMedia] = useState<QuickMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const { selectedWorkspace } = useWorkspace();
  const { user } = useAuth();

  const fetchMedia = async () => {
    if (!selectedWorkspace?.workspace_id || !user) {
      setMedia([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('quick_media')
        .select('*')
        .eq('workspace_id', selectedWorkspace.workspace_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMedia(data || []);
    } catch (error) {
      console.error('Error fetching quick media:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar mídias rápidas',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const createMedia = async (title: string, file: File, caption?: string) => {
    if (!selectedWorkspace?.workspace_id || !user) {
      toast({
        title: 'Erro',
        description: 'Usuário não autenticado',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Upload do arquivo
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${selectedWorkspace.workspace_id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('workspace-media')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('workspace-media')
        .getPublicUrl(filePath);

      // Inserir no banco
      const { data, error } = await supabase
        .from('quick_media')
        .insert({
          title,
          file_url: publicUrl,
          file_name: file.name,
          file_type: file.type,
          caption: caption || null,
          workspace_id: selectedWorkspace.workspace_id,
        })
        .select()
        .single();

      if (error) throw error;

      setMedia(prev => [data, ...prev]);
      toast({
        title: 'Sucesso',
        description: 'Mídia criada com sucesso',
      });
      return data;
    } catch (error) {
      console.error('Error creating media:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao criar mídia',
        variant: 'destructive',
      });
    }
  };

  const updateMedia = async (id: string, title: string, file?: File, caption?: string) => {
    try {
      let updateData: any = { title, caption: caption || null };

      if (file && selectedWorkspace?.workspace_id) {
        // Upload novo arquivo se fornecido
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${selectedWorkspace.workspace_id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('workspace-media')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('workspace-media')
          .getPublicUrl(filePath);

        updateData.file_url = publicUrl;
        updateData.file_name = file.name;
        updateData.file_type = file.type;
      }

      const { data, error } = await supabase
        .from('quick_media')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setMedia(prev => prev.map(item => item.id === id ? data : item));
      toast({
        title: 'Sucesso',
        description: 'Mídia atualizada com sucesso',
      });
      return data;
    } catch (error) {
      console.error('Error updating media:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar mídia',
        variant: 'destructive',
      });
    }
  };

  const deleteMedia = async (id: string) => {
    try {
      const { error } = await supabase
        .from('quick_media')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setMedia(prev => prev.filter(item => item.id !== id));
      toast({
        title: 'Sucesso',
        description: 'Mídia excluída com sucesso',
      });
    } catch (error) {
      console.error('Error deleting media:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao excluir mídia',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchMedia();
  }, [selectedWorkspace?.workspace_id, user]);

  return {
    media,
    loading,
    createMedia,
    updateMedia,
    deleteMedia,
    refetch: fetchMedia,
  };
};