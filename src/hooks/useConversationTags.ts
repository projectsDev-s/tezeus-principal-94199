import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface Tag {
  id: string;
  name: string;
  color: string;
  workspace_id?: string | null;
}

interface ConversationTag {
  id: string;
  conversation_id: string;
  tag_id: string;
  tag: Tag;
}

export function useConversationTags(conversationId?: string) {
  const [conversationTags, setConversationTags] = useState<ConversationTag[]>([]);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { selectedWorkspace } = useWorkspace();

  const workspaceId = selectedWorkspace?.workspace_id ?? null;

  // Fetch tags already assigned to conversation
  const fetchConversationTags = useCallback(async () => {
    if (!conversationId) return;
    
    try {
      let query = supabase
        .from('conversation_tags')
        .select(`
          id,
          conversation_id,
          tag_id,
          tag:tags(id, name, color, workspace_id)
        `)
        .eq('conversation_id', conversationId);

      if (workspaceId) {
        query = query.eq('tags.workspace_id', workspaceId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const mappedTags: ConversationTag[] = (data || [])
        .filter(item => item.tag && (!workspaceId || item.tag.workspace_id === workspaceId))
        .map(item => ({
          id: item.id,
          conversation_id: item.conversation_id,
          tag_id: item.tag_id,
          tag: {
            id: item.tag.id,
            name: item.tag.name,
            color: item.tag.color,
            workspace_id: item.tag.workspace_id ?? null,
          },
        }));

      setConversationTags(mappedTags);
    } catch (err) {
      console.error('Error fetching conversation tags:', err);
    }
  }, [conversationId, workspaceId]);

  // Fetch all available tags
  const fetchAvailableTags = useCallback(async () => {
    if (!workspaceId) {
      setAvailableTags([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('tags')
        .select('id, name, color, workspace_id')
        .eq('workspace_id', workspaceId)
        .order('name');

      if (error) throw error;
      setAvailableTags(data || []);
    } catch (err) {
      console.error('Error fetching available tags:', err);
    }
  }, [workspaceId]);

  // Add tag to conversation and contact
  const addTagToConversation = async (tagId: string) => {
    if (!conversationId) return false;

    setIsLoading(true);
    try {
      // First, get the conversation to find the contact
      const { data: convData, error: convError } = await supabase
        .from('conversations')
        .select('contact_id')
        .eq('id', conversationId)
        .single();
      
      if (convError) throw convError;
      
      // Add tag to conversation
      const { error: convTagError } = await supabase
        .from('conversation_tags')
        .insert({
          conversation_id: conversationId,
          tag_id: tagId
        });

      if (convTagError) throw convTagError;

      // Add tag to contact (if not already exists)
      if (convData.contact_id) {
        const { error: contactTagError } = await supabase
          .from('contact_tags')
          .upsert({
            contact_id: convData.contact_id,
            tag_id: tagId
          }, {
            onConflict: 'contact_id,tag_id',
            ignoreDuplicates: true
          });

        if (contactTagError) {
          console.warn('Error adding tag to contact (might already exist):', contactTagError);
        }
      }

      await fetchConversationTags();
      
      return true;
    } catch (error: any) {
      console.error('Error adding tag to conversation:', error);
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
    const assignedTagIds = conversationTags.map(ct => ct.tag_id);
    const filtered = availableTags.filter(tag => 
      !assignedTagIds.includes(tag.id) &&
      tag.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return filtered;
  };

  useEffect(() => {
    fetchAvailableTags();
  }, [fetchAvailableTags]);

  useEffect(() => {
    fetchConversationTags();
  }, [fetchConversationTags]);

  return {
    conversationTags,
    availableTags,
    isLoading,
    addTagToConversation,
    getFilteredTags,
    refreshTags: fetchConversationTags,
    fetchContactTags: async (contactId: string) => {
      // Function to refresh contact tags externally
      return await supabase
        .from('contact_tags')
        .select(`
          id,
          tag_id,
          tags (
            id,
            name,
            color
          )
        `)
        .eq('contact_id', contactId);
    }
  };
}