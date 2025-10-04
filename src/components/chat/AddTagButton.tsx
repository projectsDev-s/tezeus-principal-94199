import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useConversationTags } from "@/hooks/useConversationTags";
import { cn } from "@/lib/utils";

interface AddTagButtonProps {
  conversationId: string;
  isDarkMode?: boolean;
  onTagAdded?: () => void;
}

export function AddTagButton({ conversationId, isDarkMode = false, onTagAdded }: AddTagButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTagId, setSelectedTagId] = useState<string>("");
  const [isHovered, setIsHovered] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const { 
    availableTags,
    conversationTags,
    addTagToConversation, 
    isLoading 
  } = useConversationTags(conversationId);

  // Verificar quais tags já estão atribuídas à conversa
  const assignedTagIds = conversationTags.map(ct => ct.tag_id);

  // Filtrar tags por busca
  const filteredTags = availableTags.filter(tag => 
    tag.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddTag = async () => {
    if (!selectedTagId) return;
    
    const success = await addTagToConversation(selectedTagId);
    if (success) {
      setIsOpen(false);
      setSelectedTagId("");
      setSearchTerm("");
      onTagAdded?.();
    }
  };

  const handleTagSelect = (tagId: string) => {
    setSelectedTagId(tagId);
  };

  const handleCancel = () => {
    setIsOpen(false);
    setSelectedTagId("");
    setSearchTerm("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel();
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
          
          {/* Pill hover - Imagem 2 */}
          {isHovered && (
            <div className="absolute left-8 top-0 flex items-center h-6 px-2 bg-popover border border-dashed border-border rounded-full text-xs text-muted-foreground whitespace-nowrap z-10">
              + Adicionar tag
            </div>
          )}
        </div>
      </PopoverTrigger>
      
      <PopoverContent 
        className="w-64 p-0 bg-background border border-border shadow-lg z-50" 
        align="start"
        onKeyDown={handleKeyDown}
      >
        <div className="space-y-0">
          {/* Campo de busca */}
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar tags..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-9 text-sm bg-muted/30 border-0 focus:bg-muted/50"
                autoFocus
              />
            </div>
          </div>
          
          {/* Lista de tags disponíveis - Padrão sólido Imagem 1 */}
          <ScrollArea className="max-h-48">
            <div className="p-2 space-y-1">
              {filteredTags.map((tag) => {
                const isAssigned = assignedTagIds.includes(tag.id);
                return (
                  <div 
                    key={tag.id} 
                    className={cn(
                      "relative",
                      isAssigned && "opacity-50"
                    )}
                  >
                    <Badge
                      variant="outline"
                      style={{ 
                        backgroundColor: tag.color,
                        borderColor: tag.color,
                        color: 'white'
                      }}
                      className={cn(
                        "cursor-pointer hover:opacity-80 transition-all text-xs px-3 py-1.5 w-full justify-start rounded-full font-medium border-0",
                        selectedTagId === tag.id && "ring-2 ring-offset-1 ring-primary",
                        isAssigned && "cursor-not-allowed"
                      )}
                      onClick={() => !isAssigned && handleTagSelect(tag.id)}
                    >
                      {tag.name}
                      {isAssigned && <span className="ml-2 text-xs opacity-80">(já atribuída)</span>}
                    </Badge>
                  </div>
                );
              })}
              {filteredTags.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {searchTerm ? "Nenhuma tag encontrada" : "Nenhuma tag disponível"}
                </p>
              )}
            </div>
          </ScrollArea>
          
          {/* Botões */}
          <div className="flex gap-2 p-3 border-t border-border">
            <Button
              variant="outline"
              onClick={handleCancel}
              className="flex-1 h-9"
              size="sm"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAddTag}
              disabled={!selectedTagId || isLoading}
              className="flex-1 h-9"
              size="sm"
            >
              {isLoading ? "Adicionando..." : "Adicionar"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}