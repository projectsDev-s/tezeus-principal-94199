import { useState, useEffect, useMemo } from "react";
import { X, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/contexts/WorkspaceContext";

interface Tag {
  id: string;
  name: string;
  color: string;
  workspace_id?: string | null;
}

interface ContactTagsProps {
  contactId?: string;
  workspaceId?: string | null;
  isDarkMode?: boolean;
  onTagRemoved?: () => void;
}

export function ContactTags({ contactId, workspaceId = null, isDarkMode = false, onTagRemoved }: ContactTagsProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [visibleTagId, setVisibleTagId] = useState<string | null>(null);
  const [hideTimeout, setHideTimeout] = useState<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  const { selectedWorkspace } = useWorkspace();

  const resolvedWorkspaceId = useMemo(
    () => workspaceId ?? selectedWorkspace?.workspace_id ?? null,
    [workspaceId, selectedWorkspace?.workspace_id]
  );

  const handleMouseEnter = (tagId: string) => {
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      setHideTimeout(null);
    }
    setVisibleTagId(tagId);
  };

  const handleMouseLeave = () => {
    const timeout = setTimeout(() => {
      setVisibleTagId(null);
    }, 1000);
    setHideTimeout(timeout);
  };

  const handleNameMouseEnter = () => {
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      setHideTimeout(null);
    }
  };

  const fetchContactTags = async () => {
    if (!contactId) return;
    
    try {
      let query = supabase
        .from('contact_tags')
        .select(`
          id,
          tag_id,
          tags (
            id,
            name,
            color,
            workspace_id
          )
        `)
        .eq('contact_id', contactId);

      if (resolvedWorkspaceId) {
        query = query.eq('tags.workspace_id', resolvedWorkspaceId);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      const contactTags = data
        ?.map(item => item.tags)
        .filter((tag): tag is Tag => Boolean(tag) && (!resolvedWorkspaceId || tag.workspace_id === resolvedWorkspaceId)) || [];
      setTags(contactTags as Tag[]);
    } catch (err) {
      console.error('Error fetching contact tags:', err);
    }
  };

  const removeTag = async (tagId: string) => {
    if (!contactId) return;
    
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('contact_tags')
        .delete()
        .eq('contact_id', contactId)
        .eq('tag_id', tagId);

      if (error) throw error;
      
      setTags(prev => prev.filter(tag => tag.id !== tagId));
      onTagRemoved?.();
    } catch (error: any) {
      console.error('Error removing tag:', error);
      toast({
        title: "Erro",
        description: "Não foi possível remover a tag. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchContactTags();
  }, [contactId, resolvedWorkspaceId]);

  if (!contactId || tags.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {tags.map((tag) => (
        <div
          key={tag.id}
          className="relative cursor-pointer"
          onMouseEnter={() => handleMouseEnter(tag.id)}
          onMouseLeave={handleMouseLeave}
        >
          <Tag 
            className="w-3 h-3 flex-shrink-0" 
            style={{ color: tag.color }} 
            fill={tag.color}
          />
          <span 
            onMouseEnter={handleNameMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={cn(
              "absolute left-3 top-1/2 -translate-y-1/2 -translate-x-1 whitespace-nowrap transition-all duration-300 ease-out px-2 py-0.5 rounded-full z-[9999] flex items-center gap-1",
              visibleTagId === tag.id ? "opacity-100 translate-x-0" : "opacity-0 pointer-events-none"
            )}
            style={{ 
              backgroundColor: 'white',
              borderColor: tag.color,
              color: tag.color,
              border: `2px solid ${tag.color}`
            }}
          >
            {tag.name}
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeTag(tag.id);
              }}
              className="hover:bg-black/10 rounded-full p-0.5 transition-colors flex-shrink-0 pointer-events-auto"
              disabled={isLoading}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}