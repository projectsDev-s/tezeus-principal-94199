import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { X, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface ContactTagsProps {
  contactId?: string;
  isDarkMode?: boolean;
  onTagRemoved?: () => void;
}

export function ContactTags({ contactId, isDarkMode = false, onTagRemoved }: ContactTagsProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchContactTags = async () => {
    if (!contactId) return;
    
    try {
      const { data, error } = await supabase
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

      if (error) throw error;
      
      const contactTags = data?.map(item => item.tags).filter(Boolean) || [];
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
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchContactTags();
  }, [contactId]);

  if (!contactId || tags.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {tags.map((tag) => (
        <Badge
          key={tag.id}
          variant="outline"
          style={{ 
            backgroundColor: `${tag.color}15`,
            borderColor: tag.color,
            color: tag.color
          }}
          className="group relative text-xs p-1 h-auto rounded-full font-medium flex items-center"
        >
          <Tag 
            className="w-3 h-3 flex-shrink-0" 
            style={{ color: tag.color }} 
            fill={tag.color}
          />
          <span 
            className="absolute left-6 top-1/2 -translate-y-1/2 -translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 whitespace-nowrap transition-all duration-300 ease-out px-2 py-0.5 rounded-full z-[9999] flex items-center gap-1"
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
              className="hover:bg-black/10 rounded-full p-0.5 transition-colors flex-shrink-0"
              disabled={isLoading}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        </Badge>
      ))}
    </div>
  );
}