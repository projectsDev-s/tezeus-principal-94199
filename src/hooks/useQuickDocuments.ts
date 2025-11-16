import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/use-toast';

interface QuickDocument {
  id: string;
  title: string;
  file_url: string;
  file_name: string;
  file_type: string;
  file_size?: number;
  caption?: string;
  workspace_id: string;
  created_at: string;
  updated_at: string;
}

export const useQuickDocuments = () => {
  const [documents, setDocuments] = useState<QuickDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const { selectedWorkspace } = useWorkspace();
  const { user } = useAuth();

  const fetchDocuments = async () => {
    if (!selectedWorkspace?.workspace_id || !user) {
      setDocuments([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('quick_documents')
        .select('*')
        .eq('workspace_id', selectedWorkspace.workspace_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error fetching quick documents:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar documentos rápidos',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const createDocument = async (title: string, file: File, caption?: string) => {
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
        .from('quick_documents')
        .insert({
          title,
          file_url: publicUrl,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          caption: caption || null,
          workspace_id: selectedWorkspace.workspace_id,
        })
        .select()
        .single();

      if (error) throw error;

      setDocuments(prev => [data, ...prev]);
      toast({
        title: 'Sucesso',
        description: 'Documento criado com sucesso',
      });
      return data;
    } catch (error) {
      console.error('Error creating document:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao criar documento',
        variant: 'destructive',
      });
    }
  };

  const updateDocument = async (id: string, title: string, file?: File, caption?: string) => {
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
        updateData.file_size = file.size;
      }

      const { data, error } = await supabase
        .from('quick_documents')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setDocuments(prev => prev.map(doc => doc.id === id ? data : doc));
      toast({
        title: 'Sucesso',
        description: 'Documento atualizado com sucesso',
      });
      return data;
    } catch (error) {
      console.error('Error updating document:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar documento',
        variant: 'destructive',
      });
    }
  };

  const deleteDocument = async (id: string) => {
    try {
      const { error } = await supabase
        .from('quick_documents')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setDocuments(prev => prev.filter(doc => doc.id !== id));
      toast({
        title: 'Sucesso',
        description: 'Documento excluído com sucesso',
      });
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao excluir documento',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [selectedWorkspace?.workspace_id, user]);

  return {
    documents,
    loading,
    createDocument,
    updateDocument,
    deleteDocument,
    refetch: fetchDocuments,
  };
};