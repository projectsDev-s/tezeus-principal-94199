import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useConversationTags } from "@/hooks/useConversationTags";
import { cn } from "@/lib/utils";

interface AddTagButtonProps {
  conversationId: string;
  isDarkMode?: boolean;
  onTagAdded?: () => void;
}

export function AddTagButton({ conversationId, isDarkMode = false, onTagAdded }: AddTagButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const { 
    availableTags,
    conversationTags,
    addTagToConversation, 
    isLoading 
  } = useConversationTags(conversationId);

  // Verificar quais tags já estão atribuídas à conversa
  const assignedTagIds = conversationTags.map(ct => ct.tag_id);


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
          
          {/* Pill hover - Imagem 2 */}
          {isHovered && (
            <div className="absolute left-8 top-0 flex items-center h-6 px-2 bg-popover border border-dashed border-border rounded-full text-xs text-muted-foreground whitespace-nowrap z-10">
              + Adicionar tag
            </div>
          )}
        </div>
      </PopoverTrigger>
      
      <PopoverContent 
        className="w-64 p-0" 
        align="start"
      >
        <Command>
          <CommandInput placeholder="Buscar tags..." />
          <CommandList>
            <CommandEmpty>Nenhuma tag encontrada.</CommandEmpty>
            <CommandGroup>
              {availableTags.map((tag) => {
                const isAssigned = assignedTagIds.includes(tag.id);
                return (
                  <CommandItem
                    key={tag.id}
                    disabled={isAssigned}
                    onSelect={async () => {
                      if (!isAssigned) {
                        const success = await addTagToConversation(tag.id);
                        if (success) {
                          setIsOpen(false);
                          onTagAdded?.();
                        }
                      }
                    }}
                  >
                    <Badge
                      variant="outline"
                      style={{ 
                        backgroundColor: tag.color,
                        borderColor: tag.color,
                        color: 'white'
                      }}
                      className={cn(
                        "text-xs px-3 py-1 rounded-full font-medium border-0 w-full justify-start",
                        isAssigned && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      {tag.name}
                      {isAssigned && <span className="ml-2 text-xs opacity-80">(já atribuída)</span>}
                    </Badge>
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