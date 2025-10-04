import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Tag {
  id: string;
  name: string;
  color: string;
}

export function useContactTags(contactId?: string) {
  const [contactTags, setContactTags] = useState<Tag[]>([]);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Fetch tags already assigned to contact
  const fetchContactTags = async () => {
    if (!contactId) return;
    
    try {
      const { data, error } = await supabase
        .from('contact_tags')
        .select(`
          id,
          tag_id,
          tags(id, name, color)
        `)
        .eq('contact_id', contactId);

      if (error) throw error;
      const tags = data?.map(item => item.tags).filter(Boolean) || [];
      setContactTags(tags as Tag[]);
    } catch (err) {
      console.error('Error fetching contact tags:', err);
    }
  };

  // Fetch all available tags
  const fetchAvailableTags = async () => {
    try {
      const { data, error } = await supabase
        .from('tags')
        .select('id, name, color')
        .order('name');

      if (error) throw error;
      setAvailableTags(data || []);
    } catch (err) {
      console.error('Error fetching available tags:', err);
    }
  };

  // Add tag to contact
  const addTagToContact = async (tagId: string) => {
    if (!contactId) return false;

    setIsLoading(true);
    try {
      // Buscar o ID do usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      
      // Buscar system_user_id baseado no email do usuário autenticado
      const { data: systemUser } = await supabase
        .from('system_users')
        .select('id')
        .eq('email', user?.email)
        .maybeSingle();

      const { error } = await supabase
        .from('contact_tags')
        .upsert({
          contact_id: contactId,
          tag_id: tagId,
          created_by: systemUser?.id || null
        }, {
          onConflict: 'contact_id,tag_id',
          ignoreDuplicates: true
        });

      if (error) throw error;

      await fetchContactTags();
      toast({
        title: "Tag adicionada",
        description: "A tag foi adicionada ao contato com sucesso.",
      });
      
      return true;
    } catch (error: any) {
      console.error('Error adding tag to contact:', error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar a tag. Tente novamente.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Get available tags excluding already assigned ones
  const getFilteredTags = (searchTerm: string = '') => {
    const assignedTagIds = contactTags.map(tag => tag.id);
    const filtered = availableTags.filter(tag => 
      !assignedTagIds.includes(tag.id) &&
      tag.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return filtered;
  };

  useEffect(() => {
    fetchAvailableTags();
  }, []);

  useEffect(() => {
    fetchContactTags();
  }, [contactId]);

  return {
    contactTags,
    availableTags,
    isLoading,
    addTagToContact,
    getFilteredTags,
    refreshTags: fetchContactTags
  };
}