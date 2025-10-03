import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { useToast } from '@/hooks/use-toast';

export interface ContactObservation {
  id: string;
  content: string;
  file_name?: string;
  file_url?: string;
  file_type?: string;
  created_at: string;
  created_by?: string;
}

export const useContactObservations = (contactId: string) => {
  const [observations, setObservations] = useState<ContactObservation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const { workspaces } = useWorkspaces();
  const currentWorkspace = workspaces?.[0]; // Usar o primeiro workspace por enquanto
  const { toast } = useToast();

  const fetchObservations = async () => {
    if (!contactId || !currentWorkspace?.workspace_id) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('contact_observations')
        .select('*')
        .eq('contact_id', contactId)
        .eq('workspace_id', currentWorkspace.workspace_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setObservations(data || []);
    } catch (error) {
      console.error('Erro ao buscar observações:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as observações",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const addObservation = async (content: string, file?: File) => {
    if (!contactId || !currentWorkspace?.workspace_id || !content.trim()) return;

    setIsUploading(true);
    try {
      // Obter o usuário atual do localStorage
      const currentUserStr = localStorage.getItem('currentUser');
      if (!currentUserStr) {
        throw new Error('Usuário não autenticado');
      }
      const currentUser = JSON.parse(currentUserStr);
      
      let fileData: { name?: string; url?: string; type?: string } = {};

      // Upload file if provided
      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${contactId}-${Date.now()}.${fileExt}`;
        const filePath = `observations/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('workspace-media')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('workspace-media')
          .getPublicUrl(filePath);

        fileData = {
          name: file.name,
          url: publicUrl,
          type: file.type
        };
      }

      // Insert observation
      const { data, error } = await supabase
        .from('contact_observations')
        .insert({
          contact_id: contactId,
          workspace_id: currentWorkspace.workspace_id,
          content: content.trim(),
          file_name: fileData.name,
          file_url: fileData.url,
          file_type: fileData.type,
          created_by: currentUser.id
        })
        .select()
        .single();

      if (error) {
        console.error('Erro detalhado ao inserir observação:', error);
        throw error;
      }

      setObservations(prev => [data, ...prev]);
      
      toast({
        title: "Sucesso",
        description: "Observação adicionada com sucesso"
      });

      return true;
    } catch (error) {
      console.error('Erro ao adicionar observação:', error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar a observação",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsUploading(false);
    }
  };

  const updateObservation = async (id: string, content: string) => {
    if (!contactId || !currentWorkspace?.workspace_id || !content.trim()) return false;

    try {
      const { error } = await supabase
        .from('contact_observations')
        .update({ content: content.trim(), updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('workspace_id', currentWorkspace.workspace_id);

      if (error) throw error;

      setObservations(prev => 
        prev.map(obs => obs.id === id ? { ...obs, content: content.trim() } : obs)
      );

      toast({
        title: "Sucesso",
        description: "Observação atualizada com sucesso"
      });

      return true;
    } catch (error) {
      console.error('Erro ao atualizar observação:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a observação",
        variant: "destructive"
      });
      return false;
    }
  };

  const deleteObservation = async (id: string) => {
    if (!contactId || !currentWorkspace?.workspace_id) return false;

    try {
      const { error } = await supabase
        .from('contact_observations')
        .delete()
        .eq('id', id)
        .eq('workspace_id', currentWorkspace.workspace_id);

      if (error) throw error;

      setObservations(prev => prev.filter(obs => obs.id !== id));

      toast({
        title: "Sucesso",
        description: "Observação excluída com sucesso"
      });

      return true;
    } catch (error) {
      console.error('Erro ao excluir observação:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir a observação",
        variant: "destructive"
      });
      return false;
    }
  };

  const downloadFile = (fileUrl: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getFileIcon = (fileType?: string) => {
    if (!fileType) return '📄';
    
    if (fileType.startsWith('image/')) return '🖼️';
    if (fileType.startsWith('video/')) return '🎥';
    if (fileType.startsWith('audio/')) return '🎵';
    if (fileType.includes('pdf')) return '📋';
    if (fileType.includes('word') || fileType.includes('document')) return '📝';
    if (fileType.includes('sheet') || fileType.includes('excel')) return '📊';
    if (fileType.includes('presentation') || fileType.includes('powerpoint')) return '📈';
    
    return '📄';
  };

  useEffect(() => {
    fetchObservations();
  }, [contactId, currentWorkspace?.workspace_id]);

  return {
    observations,
    isLoading,
    isUploading,
    addObservation,
    updateObservation,
    deleteObservation,
    downloadFile,
    getFileIcon,
    refetch: fetchObservations
  };
};