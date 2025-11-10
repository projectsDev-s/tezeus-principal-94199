import { useState, useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { useSessionManager } from "@/hooks/useSessionManager";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useWorkspaceStatusCheck } from "@/hooks/useWorkspaceStatusCheck";
import { PipelinesProvider } from "@/contexts/PipelinesContext";

import { Dashboard } from "./Dashboard";
import { Conversas } from "./modules/Conversas";
import { DSVoice } from "./modules/DSVoice";
import { CRMNegocios } from "./modules/CRMNegocios";

import { CRMContatos } from "./modules/CRMContatos";
import { CRMTags } from "./modules/CRMTags";
import { CRMProdutos } from "./modules/CRMProdutos";

import { DSAgente } from "./modules/DSAgente";
import { EditarAgente } from "./modules/EditarAgente";
import { AutomacoesBot } from "./modules/AutomacoesBot";
import { AutomacoesIntegracoes } from "./modules/AutomacoesIntegracoes";
import { AutomacoesFilas } from "./modules/AutomacoesFilas";
import { AutomacoesAPI } from "./modules/AutomacoesAPI";
import { Conexoes } from "./modules/Conexoes";
import { AdministracaoUsuarios } from "./modules/AdministracaoUsuarios";
import { AdministracaoFinanceiro } from "./modules/AdministracaoFinanceiro";
import { AdministracaoConfiguracoes } from "./modules/AdministracaoConfiguracoes";
import { AdministracaoDashboard } from "./modules/AdministracaoDashboard";
import { ParceirosClientes } from "./modules/ParceirosClientes";
import { WorkspaceEmpresas } from "./modules/WorkspaceEmpresas";
import { WorkspaceUsersPage } from "./modules/WorkspaceUsersPage";
import { WorkspaceRelatorios } from "./modules/WorkspaceRelatorios";

export type ModuleType = 
  | "dashboard"
  | "conversas"
  | "ds-voice"
  | "crm-negocios"
  
  | "crm-contatos"
  | "crm-tags"
  | "crm-produtos"
  
  | "automacoes-agente"
  | "automacoes-bot"
  | "automacoes-integracoes"
  | "automacoes-filas"
  | "automacoes-api"
  | "automacoes-webhooks"
  | "conexoes"
  | "workspace-empresas"
  | "workspace-usuarios"
  | "workspace-relatorios"
  | "parceiros-clientes"
  | "administracao-usuarios"
  | "administracao-financeiro"
  | "administracao-configuracoes"
  | "administracao-dashboard"
  | "editar-agente";

export function TezeusCRM() {
  // Monitor de sessão global
  useSessionManager();
  
  // Monitorar status do workspace
  useWorkspaceStatusCheck();
  
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const { userRole } = useAuth();
  const { selectedWorkspace } = useWorkspace();
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      return savedTheme === 'dark' || savedTheme === 'dark-blue';
    }
    return false;
  });
  const [colorPreset, setColorPreset] = useState<'dark' | 'dark-blue'>(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      return savedTheme === 'dark-blue' ? 'dark-blue' : 'dark';
    }
    return 'dark';
  });
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  // Handle dark mode and preset changes
  useEffect(() => {
    const updateTheme = (isDark: boolean, preset: 'dark' | 'dark-blue') => {
      const root = document.documentElement;
      
      // Remove todas as classes de tema
      root.classList.remove('dark', 'dark-blue');
      
      if (isDark) {
        // Adiciona a classe do preset escolhido
        root.classList.add(preset);
        localStorage.setItem('theme', preset);
      } else {
        // Modo claro
        localStorage.setItem('theme', 'light');
      }
    };
    
    updateTheme(isDarkMode, colorPreset);
  }, [isDarkMode, colorPreset]);

  // Helper para construir rotas baseado no role
  const getRoutePath = (path: string) => {
    // Remover barra inicial se houver
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    
    if (userRole === 'master' && selectedWorkspace) {
      return `/workspace/${selectedWorkspace.workspace_id}${cleanPath}`;
    }
    return cleanPath;
  };

  // Convert URL path to module type
  const getModuleFromPath = (pathname: string): ModuleType => {
    // Remover prefixo /workspace/:workspaceId se existir
    let path = pathname;
    const workspaceMatch = pathname.match(/^\/workspace\/[^/]+\/(.+)/);
    if (workspaceMatch) {
      path = `/${workspaceMatch[1]}`;
    }
    
    path = path.substring(1); // Remove leading slash
    if (!path || path === "dashboard") return "dashboard";
    if (path.startsWith("editar-agente/")) return "editar-agente";
    if (path.includes("/usuarios")) return "workspace-usuarios";
    
    return path as ModuleType;
  };

  const activeModule = getModuleFromPath(location.pathname);
  const editingAgentId = params.agentId || null;

  // Handle conversation selection from location state (notificações)
  useEffect(() => {
    const conversationIdFromState = (location.state as any)?.selectedConversationId;
    
    if (conversationIdFromState && conversationIdFromState !== selectedConversationId) {
      console.log('📍 TezeusCRM: Recebeu conversa via state:', conversationIdFromState);
      setSelectedConversationId(conversationIdFromState);
      
      // ✅ Limpar o state após processar para permitir navegação livre
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, selectedConversationId, navigate, location.pathname]);

  // Listener para navegação via toast
  useEffect(() => {
    const handleNavigateToConversation = (event: CustomEvent) => {
      const conversationId = event.detail;
      setSelectedConversationId(conversationId);
      navigate(getRoutePath('/conversas'));
    };

    window.addEventListener('navigate-to-conversation', handleNavigateToConversation as EventListener);
    return () => {
      window.removeEventListener('navigate-to-conversation', handleNavigateToConversation as EventListener);
    };
  }, [navigate, userRole, selectedWorkspace]);

  const renderModule = () => {
    const moduleProps = { isDarkMode };
    
    switch (activeModule) {
      case "dashboard":
        return <Dashboard {...moduleProps} />;
      case "conversas":
        return <Conversas {...moduleProps} selectedConversationId={selectedConversationId} />;
      case "ds-voice":
        return <DSVoice />;
      case "crm-negocios":
        return <CRMNegocios {...moduleProps} />;
      case "crm-contatos":
        return <CRMContatos />;
      case "crm-tags":
        return <CRMTags />;
      case "crm-produtos":
        return <CRMProdutos />;
      case "automacoes-agente":
        return <DSAgente />;
      case "automacoes-bot":
        return <AutomacoesBot />;
      case "automacoes-integracoes":
        return <AutomacoesIntegracoes />;
      case "automacoes-filas":
        return <AutomacoesFilas />;
      case "automacoes-api":
        return <AutomacoesAPI />;
      case "conexoes":
        return <Conexoes />;
      case "workspace-empresas":
        return <WorkspaceEmpresas />;
      case "workspace-usuarios":
        return <WorkspaceUsersPage />;
      case "workspace-relatorios":
        return <WorkspaceRelatorios />;
      case "parceiros-clientes":
        return <ParceirosClientes />;
      case "administracao-usuarios":
        return <AdministracaoUsuarios />;
      case "administracao-financeiro":
        return <AdministracaoFinanceiro />;
      case "administracao-configuracoes":
        return <AdministracaoConfiguracoes />;
      case "administracao-dashboard":
        return <AdministracaoDashboard />;
      case "editar-agente":
        return editingAgentId ? <EditarAgente agentId={editingAgentId} /> : <Dashboard {...moduleProps} />;
      default:
        return <Dashboard {...moduleProps} />;
    }
  };

  return (
    <PipelinesProvider>
      <div className="min-h-screen flex w-full gap-2 bg-gradient-to-br from-background via-background to-muted">
        <Sidebar 
          activeModule={activeModule}
          onModuleChange={(module) => {
            if (module === 'editar-agente') {
              // Handle editar-agente navigation differently since it needs agentId
              return;
            }
            navigate(getRoutePath(`/${module === 'dashboard' ? 'dashboard' : module}`));
          }}
          isDarkMode={isDarkMode}
          onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
          colorPreset={colorPreset}
          onColorPresetChange={(preset) => setColorPreset(preset)}
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
          onNavigateToConversation={(conversationId) => {
            console.log('🚀 TezeusCRM: Navegando para conversa:', conversationId);
            setSelectedConversationId(conversationId);
            
            // ✅ Usar rota correta baseada no role
            navigate(getRoutePath('/conversas'), { 
              state: { selectedConversationId: conversationId },
              replace: true 
            });
          }}
        />
        <div className={`flex-1 flex flex-col max-h-screen ${activeModule === 'conversas' || activeModule === 'conexoes' ? 'p-4' : ''}`}>
          <main className={`flex-1 overflow-y-auto ${activeModule === 'conversas' || activeModule === 'conexoes' ? 'bg-card text-card-foreground shadow-lg rounded-lg border p-5' : ''}`}>
            {renderModule()}
          </main>
        </div>
      </div>
    </PipelinesProvider>
  );
}