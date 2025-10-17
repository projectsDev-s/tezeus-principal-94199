import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspaceHeaders } from '@/lib/workspaceHeaders';
import { useToast } from '@/hooks/use-toast';
import { PipelineColumn } from './usePipelines';

export function usePipelineColumns(pipelineId: string | null) {
  const [columns, setColumns] = useState<PipelineColumn[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { getHeaders } = useWorkspaceHeaders();
  const { toast } = useToast();

  const fetchColumns = async () => {
    if (!pipelineId) {
      setColumns([]);
      return;
    }

    try {
      setIsLoading(true);
      const headers = getHeaders();
      
      const { data, error } = await supabase.functions.invoke(`pipeline-management/columns?pipeline_id=${pipelineId}`, {
        method: 'GET',
        headers
      });

      if (error) throw error;
      setColumns(data || []);
    } catch (error) {
      console.error('Error fetching columns:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar colunas",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createColumn = async (name: string, color: string) => {
    if (!pipelineId) return;

    try {
      const headers = getHeaders();
      
      const { data, error } = await supabase.functions.invoke('pipeline-management/columns', {
        method: 'POST',
        headers,
        body: { 
          pipeline_id: pipelineId,
          name,
          color 
        }
      });

      if (error) throw error;

      setColumns(prev => [...prev, data]);
      
      toast({
        title: "Sucesso",
        description: "Coluna criada com sucesso",
      });

      return data;
    } catch (error) {
      console.error('Error creating column:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar coluna",
        variant: "destructive",
      });
      throw error;
    }
  };

  useEffect(() => {
    fetchColumns();
  }, [pipelineId]);

  return {
    columns,
    isLoading,
    fetchColumns,
    createColumn,
  };
}