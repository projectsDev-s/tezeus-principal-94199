import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Tag {
  id: string;
  name: string;
  color: string;
  contact_count?: number;
}

export function useTags(startDate?: Date, endDate?: Date, userId?: string) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTags = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Query base para buscar todas as tags (LEFT JOIN para incluir tags sem contatos)
      let query = supabase
        .from('tags')
        .select(`
          id, 
          name, 
          color, 
          created_at,
          contact_tags(
            id,
            contact_id,
            created_by
          )
        `)
        .order('name');

      // Filtro por período (data de criação da tag)
      if (startDate && endDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        
        query = query
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString());
      } else if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(startDate);
        end.setHours(23, 59, 59, 999);
        
        query = query
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      // Processar dados para contar contatos únicos por tag
      const processedTags = data?.map((item: any) => {
        const contacts = new Set<string>();
        
        // Filtrar por usuário e adicionar contatos únicos
        item.contact_tags?.forEach((ct: any) => {
          // Se há filtro de usuário, verificar se o created_by corresponde
          if (userId && ct.created_by !== userId) {
            return; // Pular este contact_tag
          }
          
          if (ct.contact_id) {
            contacts.add(ct.contact_id);
          }
        });

        return {
          id: item.id,
          name: item.name,
          color: item.color,
          contact_count: contacts.size
        };
      }) || [];

      // Se houver filtro de usuário, remover tags com 0 contatos (não atribuídas pelo usuário)
      const finalTags = userId 
        ? processedTags.filter(tag => tag.contact_count > 0)
        : processedTags;

      setTags(finalTags);
    } catch (err) {
      console.error('Error fetching tags:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar tags');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTags();
  }, [startDate, endDate, userId]);

  return { tags, isLoading, error, refetch: fetchTags };
}