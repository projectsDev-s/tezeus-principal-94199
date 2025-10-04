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
      
      // Query base para buscar tags com contagem de contatos
      let query = supabase
        .from('tags')
        .select(`
          id, 
          name, 
          color, 
          created_at,
          contact_tags!inner(
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

      // Filtro por usuário que atribuiu a tag
      if (userId) {
        query = query.eq('contact_tags.created_by', userId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Processar dados para contar contatos únicos por tag
      const tagsMap = new Map<string, { id: string; name: string; color: string; contacts: Set<string> }>();
      
      data?.forEach((item: any) => {
        if (!tagsMap.has(item.id)) {
          tagsMap.set(item.id, {
            id: item.id,
            name: item.name,
            color: item.color,
            contacts: new Set()
          });
        }
        
        // Adicionar contatos únicos
        item.contact_tags?.forEach((ct: any) => {
          if (ct.contact_id) {
            tagsMap.get(item.id)?.contacts.add(ct.contact_id);
          }
        });
      });

      // Converter para array com contagem
      const processedTags = Array.from(tagsMap.values()).map(tag => ({
        id: tag.id,
        name: tag.name,
        color: tag.color,
        contact_count: tag.contacts.size
      }));

      setTags(processedTags);
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