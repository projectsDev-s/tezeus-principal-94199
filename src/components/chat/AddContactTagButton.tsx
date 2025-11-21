import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandGroup, CommandItem } from "@/components/ui/command";
import { useContactTags } from "@/hooks/useContactTags";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface AddContactTagButtonProps {
  contactId: string;
  workspaceId?: string | null;
  isDarkMode?: boolean;
  onTagAdded?: (tag: Tag) => void;
}

export function AddContactTagButton({ contactId, workspaceId = null, isDarkMode = false, onTagAdded }: AddContactTagButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const { 
    availableTags,
    contactTags,
    addTagToContact
  } = useContactTags(contactId, workspaceId);

  // Verificar quais tags já estão atribuídas ao contato
  const assignedTagIds = contactTags.map(tag => tag.id);

  const handleSelectTag = async (tagId: string) => {
    const selectedTag = availableTags.find(tag => tag.id === tagId);
    await addTagToContact(tagId);
    setIsOpen(false);
    if (selectedTag) {
      onTagAdded?.(selectedTag);
    } else {
      onTagAdded?.({
        id: tagId,
        name: '',
        color: '#999999'
      });
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div 
          className="relative flex items-center"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Botão circular com + */}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded-full border border-border hover:bg-accent"
          >
            <Plus className="w-3 h-3" />
          </Button>
          
          {/* Pill hover */}
          {isHovered && (
            <div className="absolute left-8 top-0 flex items-center h-6 px-2 bg-popover border border-dashed border-border rounded-full text-xs text-muted-foreground whitespace-nowrap z-10">
              + Adicionar tag
            </div>
          )}
        </div>
      </PopoverTrigger>
      
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar tags..." />
          <CommandList>
            <CommandGroup>
              {availableTags.map((tag) => {
                const isAssigned = assignedTagIds.includes(tag.id);
                
                return (
                  <CommandItem
                    key={tag.id}
                    onSelect={() => !isAssigned && handleSelectTag(tag.id)}
                    disabled={isAssigned}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: tag.color }}
                      />
                      <span>{tag.name}</span>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}