import { Badge } from "@/components/ui/badge";
import { Tag, ArrowRightLeft, Shuffle, FolderKanban, Database } from "lucide-react";

interface ActionBadge {
  type: 'tag' | 'queue' | 'connection' | 'pipeline' | 'generic';
  text: string;
  params: Record<string, string>;
}

function parseActions(text: string): { normalText: string; actions: ActionBadge[] } {
  // Regex melhorado para detectar [ADD_ACTION]: até o final da linha ou próxima ação
  const actionRegex = /\[ADD_ACTION\]:\s*(.+?)(?=\n\[ADD_ACTION\]|\n\n|$)/gs;
  
  const actions: ActionBadge[] = [];
  let normalText = text;
  
  // Extrair todas as ações
  let match;
  while ((match = actionRegex.exec(text)) !== null) {
    const actionText = match[0];
    const paramsText = match[1];
    
    // Parse dos parâmetros (melhorado para capturar UUIDs e valores complexos)
    const params: Record<string, string> = {};
    const paramRegex = /\[([^\]]+?):\s*([^\]]+?)\](?=,|\s*$)/g;
    let paramMatch;
    while ((paramMatch = paramRegex.exec(paramsText)) !== null) {
      params[paramMatch[1].trim()] = paramMatch[2].trim();
    }
    
    // Determinar tipo da ação
    let type: ActionBadge['type'] = 'generic';
    if (params.tag_name) type = 'tag';
    else if (params.fila_id) type = 'queue';
    else if (params.conection_id) type = 'connection';
    else if (params.pipeline_id) type = 'pipeline';
    
    actions.push({ type, text: actionText, params });
    
    // Remover da string para deixar só o texto normal
    normalText = normalText.replace(actionText, '').trim();
  }
  
  return { normalText, actions };
}

function ActionBadgeItem({ action }: { action: ActionBadge }) {
  const getIcon = () => {
    switch (action.type) {
      case 'tag': return <Tag className="w-3 h-3" />;
      case 'queue': return <ArrowRightLeft className="w-3 h-3" />;
      case 'connection': return <Shuffle className="w-3 h-3" />;
      case 'pipeline': return <FolderKanban className="w-3 h-3" />;
      default: return <Database className="w-3 h-3" />;
    }
  };
  
  const getLabel = () => {
    switch (action.type) {
      case 'tag': return `Tag: ${action.params.tag_name || 'N/A'}`;
      case 'queue': return `Fila: ${action.params.fila_id || 'N/A'}`;
      case 'connection': return `Conexão: ${action.params.conection_name || 'N/A'}`;
      case 'pipeline': return `Pipeline: ${action.params.pipeline_id || 'N/A'} | Coluna: ${action.params.coluna_id || 'N/A'}`;
      default: return 'Ação Genérica';
    }
  };
  
  const getVariant = (): "default" | "secondary" | "destructive" | "outline" => {
    switch (action.type) {
      case 'tag': return 'default';
      case 'queue': return 'secondary';
      case 'connection': return 'outline';
      case 'pipeline': return 'default';
      default: return 'outline';
    }
  };
  
  return (
    <Badge variant={getVariant()} className="gap-1.5 px-2 py-1">
      {getIcon()}
      <span className="text-xs">{getLabel()}</span>
    </Badge>
  );
}

export function ActionPreviewDisplay({ value }: { value: string }) {
  const { normalText, actions } = parseActions(value);
  
  return (
    <div className="space-y-4">
      {/* Texto normal do prompt */}
      {normalText && (
        <div className="text-sm text-foreground whitespace-pre-wrap">
          {normalText}
        </div>
      )}
      
      {/* Ações configuradas */}
      {actions.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">
            AÇÕES CONFIGURADAS:
          </div>
          <div className="flex flex-wrap gap-2">
            {actions.map((action, idx) => (
              <ActionBadgeItem key={idx} action={action} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
