import { Search, Download, Share2, Save, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Workspace } from '@/contexts/WorkspaceContext';

interface ReportHeaderProps {
  workspaces: Workspace[];
  selectedWorkspace: string;
  onWorkspaceChange: (value: string) => void;
  viewMode: 'list' | 'bi' | 'kpis' | 'funnel';
  onViewModeChange: (mode: 'list' | 'bi' | 'kpis' | 'funnel') => void;
  onExport: () => void;
}

export function ReportHeader({
  workspaces,
  selectedWorkspace,
  onWorkspaceChange,
  viewMode,
  onViewModeChange,
  onExport
}: ReportHeaderProps) {
  return (
    <div className="bg-card border-b border-border p-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-4 flex-1">
        <Select value={selectedWorkspace} onValueChange={onWorkspaceChange}>
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="Selecione o Workspace" />
          </SelectTrigger>
          <SelectContent>
            {workspaces.map((ws) => (
              <SelectItem key={ws.workspace_id} value={ws.workspace_id}>
                {ws.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex bg-muted rounded-lg p-1">
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => onViewModeChange('list')}
          >
            Lista
          </Button>
          <Button
            variant={viewMode === 'bi' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => onViewModeChange('bi')}
          >
            BI
          </Button>
          <Button
            variant={viewMode === 'kpis' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => onViewModeChange('kpis')}
          >
            KPIs
          </Button>
          <Button
            variant={viewMode === 'funnel' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => onViewModeChange('funnel')}
          >
            Funil
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative w-64">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pesquisar..." className="pl-8" />
        </div>
        
        <Button variant="outline" size="icon" title="Salvar Vista">
          <Save className="h-4 w-4" />
        </Button>
        
        <Button variant="outline" size="icon" onClick={onExport} title="Exportar CSV">
          <Download className="h-4 w-4" />
        </Button>
        
        <Button variant="outline" size="icon" title="Compartilhar">
          <Share2 className="h-4 w-4" />
        </Button>
        
        <Button variant="outline" size="icon" title="Configurações">
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}


