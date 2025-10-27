import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

export interface ActionBadge {
  id: string;
  type: string;
  label: string;
  data: Record<string, any>;
  position: number;
}

interface PromptEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export interface PromptEditorRef {
  getCursorPosition: () => number;
  insertText: (text: string) => void;
}

// Função para extrair tags e texto puro do conteúdo
function parseContent(content: string): { tags: Array<{ match: string; display: string; position: number; data?: Record<string, string> }> } {
  const tags: Array<{ match: string; display: string; position: number; data?: Record<string, string> }> = [];
  
  // Regex que captura [ADD_ACTION]: seguido de TUDO até encontrar o ;
  const actionPattern = /\[ADD_ACTION\]:[^;]*;/g;
  const simpleActionPattern = /\[Adicionar Tag:\s*[^\]]+\]|\[Transferir Fila:\s*[^\]]+\]|\[Transferir Conexão:\s*[^\]]+\]|\[Criar Card CRM:\s*[^\]]+\]|\[Transferir para Coluna:\s*[^\]]+\]/g;
  
  let match;
  
  // Processar padrões complexos [ADD_ACTION]: [tag name: ...], [tag id: ...], [contact id: ...];
  while ((match = actionPattern.exec(content)) !== null) {
    const fullMatch = match[0].trim();
    const startPos = match.index!;
    
    // Extrair todos os pares [chave: valor] da ação
    const paramMatches = fullMatch.match(/\[[^\]]+\]/g);
    const data: Record<string, string> = {};
    
    if (paramMatches) {
      paramMatches.forEach(param => {
        // Remover [ e ] para obter "chave: valor"
        const paramText = param.replace(/[\[\]]/g, '');
        const colonIndex = paramText.indexOf(':');
        
        if (colonIndex > 0) {
          const key = paramText.substring(0, colonIndex).trim();
          const value = paramText.substring(colonIndex + 1).trim();
          data[key] = value;
        }
      });
    }
    
    // Extrair primeira propriedade para display
    const firstPropMatch = fullMatch.match(/\[([^\]]+)\]/);
    const displayText = firstPropMatch ? firstPropMatch[1].substring(0, 30) : 'Action';
    
    tags.push({
      match: fullMatch,
      display: displayText,
      position: startPos,
      data: Object.keys(data).length > 0 ? data : undefined
    });
  }
  
  // Processar padrões simples
  while ((match = simpleActionPattern.exec(content)) !== null) {
    const fullMatch = match[0];
    
    tags.push({
      match: fullMatch,
      display: fullMatch,
      position: match.index!
    });
  }
  
  // Ordenar por posição
  tags.sort((a, b) => a.position - b.position);
  
  return { tags };
}

export const PromptEditor = forwardRef<PromptEditorRef, PromptEditorProps>(({
  value,
  onChange,
  placeholder,
  className,
}, ref) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  const getCursorPosition = (): number => {
    if (!textareaRef.current) return 0;
    return textareaRef.current.selectionStart;
  };

  const insertText = (text: string) => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentValue = textarea.value;

    // Inserir texto na posição do cursor
    const newValue = currentValue.substring(0, start) + text + currentValue.substring(end);
    
    onChange(newValue);

    // Mover cursor para depois do texto inserido
    setTimeout(() => {
      if (textareaRef.current) {
        const newPosition = start + text.length;
        textareaRef.current.setSelectionRange(newPosition, newPosition);
        textareaRef.current.focus();
      }
    }, 0);
  };

  useImperativeHandle(ref, () => ({
    getCursorPosition,
    insertText,
  }));

  // Parsear conteúdo para extrair tags
  const parsed = parseContent(value);
  const hasTags = parsed.tags.length > 0;

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className={cn(
          "w-full min-h-[400px] p-4 rounded-md border border-input bg-background",
          "font-mono text-sm resize-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "placeholder:text-muted-foreground",
          "relative z-0",
          className
        )}
      />
      
      {/* Overlay com tags renderizadas - apenas visual, não afeta o textarea */}
      {hasTags && (
        <div 
          className="absolute inset-0 p-4 pointer-events-none z-10 font-mono text-sm whitespace-pre-wrap break-words overflow-hidden"
          style={{ 
            color: 'transparent',
            WebkitTextFillColor: 'transparent',
            textShadow: '0 0 0 rgba(0,0,0,0)'
          }}
        >
          {(() => {
            let lastIndex = 0;
            const elements: React.ReactNode[] = [];
            
            parsed.tags.forEach((tag, idx) => {
              // Adicionar texto antes da tag
              if (tag.position > lastIndex) {
                const beforeText = value.substring(lastIndex, tag.position);
                if (beforeText) {
                  elements.push(<span key={`text-${idx}`}>{beforeText}</span>);
                }
              }
              
              // Adicionar badge estilo "Imagem 2" - roxo claro com bordas arredondadas
              // Mostrar TODA a tag completa SEM truncar
              const finalDisplay = tag.match;
              
              elements.push(
                <span
                  key={`tag-${idx}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    backgroundColor: 'rgba(147, 51, 234, 0.1)',
                    border: '1px solid rgba(147, 51, 234, 0.3)',
                    borderRadius: '12px',
                    padding: '2px 8px',
                    margin: '0 2px',
                    color: 'rgb(147, 51, 234)',
                    fontSize: '11px',
                    fontWeight: '500',
                    lineHeight: '1.5',
                    verticalAlign: 'baseline',
                    maxWidth: '100%',
                    wordBreak: 'break-word'
                  }}
                >
                  {finalDisplay}
                  <X className="w-3 h-3" style={{ cursor: 'pointer', flexShrink: 0 }} />
                </span>
              );
              
              lastIndex = tag.position + tag.match.length;
            });
            
            // Adicionar texto restante
            if (lastIndex < value.length) {
              const remainingText = value.substring(lastIndex);
              if (remainingText) {
                elements.push(<span key="text-end">{remainingText}</span>);
              }
            }
            
            return elements;
          })()}
        </div>
      )}
    </div>
  );
});
