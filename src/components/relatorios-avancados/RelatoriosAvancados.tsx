import { useState, useEffect } from 'react';
import { Workspace } from '@/contexts/WorkspaceContext';
import { ReportHeader } from './ReportHeader';
import { QueryBuilderSidebar } from './QueryBuilderSidebar';
import { ListaView } from './ListaView';
import { BIView } from './BIView';
import { KPIsView } from './KPIsView';
import { FunilView } from './FunilView';

// Mock Data Generation
const generateMockData = (count: number) => {
  const statuses = ['won', 'lost', 'open'];
  const pipelines = ['Vendas', 'Suporte', 'Onboarding'];
  const responsibles = ['Ana Silva', 'João Pedro', 'Maria Oliveira'];

  return Array.from({ length: count }).map((_, i) => ({
    id: i,
    title: `Negócio ${i + 1}`,
    status: statuses[Math.floor(Math.random() * statuses.length)],
    pipeline: pipelines[Math.floor(Math.random() * pipelines.length)],
    responsible: responsibles[Math.floor(Math.random() * responsibles.length)],
    value: Math.floor(Math.random() * 10000) + 1000,
    createdAt: new Date(Date.now() - Math.floor(Math.random() * 10000000000)).toISOString(),
  }));
};

interface RelatoriosAvancadosProps {
  workspaces?: Workspace[];
}

export function RelatoriosAvancados({ workspaces = [] }: RelatoriosAvancadosProps) {
  // State
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>('');
  const [viewMode, setViewMode] = useState<'list' | 'bi' | 'kpis' | 'funnel'>('list');
  const [data, setData] = useState<any[]>([]);

  // Mock Fetch Data
  useEffect(() => {
    // Simulate API call
    const mockData = generateMockData(50);
    setData(mockData);

    // Mock workspaces if needed (though usually passed from parent)
    // Ideally this component receives workspaces or fetches them.
    // For now we assume parent passes them or we fetch.
    // But since I need to fit it into MasterDashboard, I'll rely on props or context there.
    // However, to make this standalone-ish as requested:
  }, [selectedWorkspace]);

  const handleExport = () => {
    console.log('Exporting CSV...');
    // Implementation for CSV export
    const csvContent = "data:text/csv;charset=utf-8," 
        + "Title,Status,Value,Responsible\n"
        + data.map(e => `${e.title},${e.status},${e.value},${e.responsible}`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "relatorio.csv");
    document.body.appendChild(link);
    link.click();
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header is usually handled by parent or integrated here. 
          The prompt asked for a header *inside* the module structure. 
      */}
      
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <QueryBuilderSidebar />

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
            <ReportHeader
                workspaces={workspaces}
                selectedWorkspace={selectedWorkspace}
                onWorkspaceChange={setSelectedWorkspace}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                onExport={handleExport}
            />

          <main className="flex-1 overflow-auto p-6">
            {viewMode === 'list' && <ListaView data={data} />}
            {/* {viewMode === 'bi' && <BIView data={data} />} */}
            {viewMode === 'bi' && <div className="p-4 text-center text-muted-foreground">Visualização de BI em manutenção (Recharts)</div>}
            {viewMode === 'kpis' && <KPIsView data={data} />}
            {/* {viewMode === 'funnel' && <FunilView data={data} />} */}
            {viewMode === 'funnel' && <div className="p-4 text-center text-muted-foreground">Visualização de Funil em manutenção (Recharts)</div>}
          </main>
        </div>
      </div>
    </div>
  );
}

