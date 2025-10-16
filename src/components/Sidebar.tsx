import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight, ChevronLeft, MoreVertical, ArrowLeft } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ModuleType } from "./TezeusCRM";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { NotificationTooltip } from "@/components/NotificationTooltip";
import { useNotifications } from "@/hooks/useNotifications";
import { useWhatsAppConversations } from "@/hooks/useWhatsAppConversations";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { ImpersonateWorkspaceModal } from "@/components/modals/ImpersonateWorkspaceModal";
import { useSystemCustomizationContext } from "@/contexts/SystemCustomizationContext";
import { useCargoPermissions } from "@/hooks/useCargoPermissions";
import { LayoutDashboard, MessageCircle, Users, FolderOpen, Settings, Zap, Link, Shield, DollarSign, Target, Package, Calendar, CheckSquare, MessageSquare, Bot, BrainCircuit, GitBranch, Bell, User, LogOut, Handshake, FileText, Building2, BarChart3, AudioLines } from "lucide-react";
interface SidebarProps {
  activeModule: ModuleType;
  onModuleChange: (module: ModuleType) => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onNavigateToConversation?: (conversationId: string) => void;
}
interface MenuItem {
  id: ModuleType;
  label: string;
  icon: React.ReactNode;
  children?: MenuItem[];
}
export function Sidebar({
  activeModule,
  onModuleChange,
  isDarkMode,
  onToggleDarkMode,
  isCollapsed,
  onToggleCollapse,
  onNavigateToConversation
}: SidebarProps) {
  const navigate = useNavigate();
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [shouldLoadNotifications, setShouldLoadNotifications] = useState(false);

  // Hooks para notificações - só carrega quando abrir o popover
  const {
    notifications,
    totalUnread,
    getAvatarInitials,
    getAvatarColor,
    formatTimestamp
  } = useNotifications();
  const {
    markAsRead
  } = useWhatsAppConversations();
  const {
    user,
    userRole,
    hasRole,
    logout
  } = useAuth();
  const { canView, canViewAnyIn } = useCargoPermissions();
  // Usar workspaces do contexto (que já tem cache)
  const {
    selectedWorkspace,
    setSelectedWorkspace,
    workspaces,
    isLoadingWorkspaces: isLoading
  } = useWorkspace();
  const {
    customization
  } = useSystemCustomizationContext();

  // 🔍 Debug workspace visibility
  useEffect(() => {
    console.log('🔍 Sidebar Debug:', {
      userRole,
      hasRoleMaster: hasRole(['master']),
      selectedWorkspace: selectedWorkspace?.name || 'null',
      selectedWorkspaceId: selectedWorkspace?.workspace_id || 'null',
      isCollapsed,
      shouldShowWorkspace: !hasRole(['master']) && !!selectedWorkspace,
      renderTimestamp: new Date().toISOString()
    });
  }, [userRole, selectedWorkspace, isCollapsed]);

  const handleBackToMasterDashboard = () => {
    // Limpar workspace selecionado
    setSelectedWorkspace(null);
    localStorage.removeItem('selectedWorkspace');
    // Redirecionar para dashboard master
    navigate('/master-dashboard');
  };

  // Auto-select first workspace for master users
  useEffect(() => {
    if (userRole === 'master' && !selectedWorkspace && workspaces.length > 0 && !isLoading) {
      setSelectedWorkspace(workspaces[0]);
    }
  }, [userRole, selectedWorkspace, workspaces, isLoading, setSelectedWorkspace]);

  // ✅ CORREÇÃO: Listener para forçar atualização das notificações em tempo real
  useEffect(() => {
    const handleConversationRead = () => {
      console.log('🔔 Sidebar: Detectada leitura de conversa, forçando atualização');
      // O hook useNotifications já vai reagir automaticamente
    };

    const handleNewMessage = () => {
      console.log('🔔 Sidebar: Nova mensagem detectada, forçando atualização');
      // O hook useNotifications já vai reagir automaticamente
    };

    window.addEventListener('conversation-read', handleConversationRead);
    window.addEventListener('new-contact-message', handleNewMessage);

    return () => {
      window.removeEventListener('conversation-read', handleConversationRead);
      window.removeEventListener('new-contact-message', handleNewMessage);
    };
  }, []);

  // Garantir que o grupo "administracao" fique expandido quando os módulos de administração estiverem ativos
  useEffect(() => {
    if (activeModule === "administracao-financeiro" || activeModule === "administracao-usuarios" || activeModule === "administracao-configuracoes" || activeModule === "administracao-dashboard" || activeModule === "automacoes-agente" || activeModule === "automacoes-filas") {
      setExpandedGroups(prev => prev.includes("administracao") ? prev : [...prev, "administracao"]);
    }
  }, [activeModule]);
  const menuItems: (MenuItem & {
    group?: string;
  })[] = [{
    id: "dashboard",
    label: "Dashboard",
    icon: <LayoutDashboard className="w-5 h-5" />
  }, {
    id: "conversas",
    label: "Conversas",
    icon: <MessageCircle className="w-5 h-5" />
  }, {
    id: "ds-voice",
    label: "Mensagens Rápidas",
    icon: <AudioLines className="w-5 h-5" />
  }, {
    id: "workspace-empresas",
    label: "Empresas",
    icon: <Building2 className="w-5 h-5" />,
    group: "workspace"
  }, {
    id: "workspace-relatorios",
    label: "Relatórios",
    icon: <BarChart3 className="w-5 h-5" />,
    group: "workspace"
  }, {
    id: "crm-negocios",
    label: "Negócios",
    icon: <DollarSign className="w-5 h-5" />,
    group: "crm"
  }, {
    id: "crm-contatos",
    label: "Contatos",
    icon: <Users className="w-5 h-5" />,
    group: "crm"
  }, {
    id: "crm-tags",
    label: "Tags",
    icon: <Target className="w-5 h-5" />,
    group: "crm"
  }, {
    id: "crm-produtos",
    label: "Produtos Comerciais",
    icon: <Package className="w-5 h-5" />,
    group: "crm"
  }, {
    id: "automacoes-agente",
    label: "DS Agente",
    icon: <BrainCircuit className="w-5 h-5" />,
    group: "administracao"
  }, {
    id: "automacoes-filas",
    label: "Filas",
    icon: <Users className="w-5 h-5" />,
    group: "administracao"
  }, {
    id: "parceiros-clientes",
    label: "Clientes",
    icon: <Users className="w-5 h-5" />,
    group: "parceiros"
  }, {
    id: "administracao-usuarios",
    label: "Usuários",
    icon: <Users className="w-5 h-5" />,
    group: "administracao"
  },
  // {
  //  id: "administracao-financeiro",
  // label: "Financeiro",
  // icon: <DollarSign className="w-5 h-5" />,
  //group: "administracao"
  //  },
  {
    id: "administracao-dashboard",
    label: "Dashboard",
    icon: <Settings className="w-5 h-5" />,
    group: "administracao"
  }, {
    id: "administracao-configuracoes",
    label: "Configurações",
    icon: <Settings className="w-5 h-5" />,
    group: "administracao"
  }];
  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]);
  };
  const renderMenuItem = (item: MenuItem & {
    group?: string;
  }) => {
    const isActive = activeModule === item.id;

    // Ícone com tamanho dinâmico
    const iconElement = React.cloneElement(item.icon as React.ReactElement, {
      className: cn("transition-all duration-300", isCollapsed ? "w-5 h-5" : "w-5 h-5")
    });
    const menuButton = <button key={item.id} onClick={() => onModuleChange(item.id)} className={cn("w-full flex items-center rounded-md transition-colors relative", isCollapsed ? "justify-center p-3" : "gap-3 px-4 py-3", item.group && !isCollapsed && "pl-8", isActive ? "bg-sidebar-active text-sidebar-active-foreground hover:bg-sidebar-active" : "hover:bg-sidebar-accent text-sidebar-foreground")}>
        {iconElement}
        {!isCollapsed && <span className="text-sm font-medium">{item.label}</span>}
      </button>;
    if (isCollapsed) {
      return <TooltipProvider key={item.id}>
          <Tooltip>
            <TooltipTrigger asChild>
              {menuButton}
            </TooltipTrigger>
            <TooltipContent side="right" className="ml-2">
              <p>{item.label}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>;
    }
    return menuButton;
  };
  const renderGroup = (groupName: string, label: string, items: (MenuItem & {
    group?: string;
  })[]) => {
    const isExpanded = expandedGroups.includes(groupName);

    // No modo colapsado, mostrar nome + setinha
    if (isCollapsed) {
      return <TooltipProvider key={groupName}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={() => {
              onToggleCollapse(); // Expandir sidebar
              setExpandedGroups(prev => prev.includes(groupName) ? prev : [...prev, groupName]); // Expandir grupo
            }} className="w-full flex flex-col items-center p-2 rounded-md hover:bg-sidebar-accent text-sidebar-foreground transition-colors">
                {/* Setinha */}
                <ChevronRight className="w-4 h-4 mb-1" />
                
                {/* Nome do grupo em texto pequeno */}
                <span className="text-[10px] font-medium text-center leading-tight">
                  {label}
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="ml-2">
              <p>{label}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>;
    }

    // Modo expandido - comportamento normal
    return <div key={groupName}>
        <button onClick={() => toggleGroup(groupName)} className="w-full flex items-center gap-2 px-4 py-2 text-sm font-medium hover:bg-sidebar-accent rounded-md text-sidebar-foreground">
          {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          <span>{label}</span>
        </button>
        {isExpanded && <div className="space-y-1">
            {items.map(renderMenuItem)}
          </div>}
      </div>;
  };
  const ungroupedItems = menuItems.filter(item => !item.group);
  const workspaceItems = menuItems.filter(item => item.group === "workspace");
  const crmItems = menuItems.filter(item => item.group === "crm");
  const parceirosItems = menuItems.filter(item => item.group === "parceiros");
  const administracaoItems = menuItems.filter(item => item.group === "administracao");
  const handleNotificationClick = (conversationId: string) => {
    console.log('🔔 Sidebar - Clique na notificação:', conversationId);
    setIsNotificationOpen(false);

    // ✅ Navegar usando location.state em vez de URL params
    if (onNavigateToConversation) {
      console.log('🚀 Navegando para conversa via state:', conversationId);
      onNavigateToConversation(conversationId);
      
      // Marcar como lida após navegação
      setTimeout(() => {
        console.log('✅ Marcando conversa como lida:', conversationId);
        markAsRead(conversationId);
      }, 300);
    }
  };
  const handleMarkAllAsRead = () => {
    // Marcar todas as conversas como lidas
    notifications.forEach(notification => {
      markAsRead(notification.conversationId);
    });
    setIsNotificationOpen(false);
  };
  const handleMarkContactAsRead = (conversationId: string) => {
    markAsRead(conversationId);
  };
  return <div data-sidebar className={cn("rounded-lg shadow-md m-2 flex flex-col max-h-[calc(100vh-1rem)] transition-all duration-300 ease-in-out relative bg-sidebar border border-sidebar-border", isCollapsed ? "w-28" : "w-64")}>
      {/* Logo */}
      <div className={cn("flex-shrink-0 border-b", isCollapsed ? "p-3 flex flex-col items-center gap-2" : "p-6 flex items-center justify-between")}>
        {/* Logo ou Texto */}
        {customization.logo_url ? <img src={customization.logo_url} alt="Logo do Sistema" className={cn("object-contain transition-all duration-300", isCollapsed ? "h-8 w-8" : "h-10")} /> : <h1 className={cn("font-bold transition-all duration-300 text-sidebar-foreground", isCollapsed ? "text-lg" : "text-2xl")}>
            {isCollapsed ? "T" : "TEZEUS"}
          </h1>}
        
        {/* Botão de colapso */}
        <button onClick={onToggleCollapse} className={cn("p-1 hover:bg-accent rounded-md transition-transform duration-300 text-muted-foreground", isCollapsed && "rotate-180")}>
          <ChevronLeft className="w-5 h-5" />
        </button>
      </div>

      {/* Workspace Info - Sempre visível para admin/user (mesmo colapsado) */}
      {!hasRole(['master']) && selectedWorkspace && (
        <div className={cn(
          "flex-shrink-0 bg-muted/50 border-b border-sidebar-border",
          isCollapsed ? "px-2 py-2" : "px-4 py-3"
        )}>
          {isCollapsed ? (
            // Versão mini: só ícone
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex justify-center">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="ml-2">
                  <div>
                    <p className="font-medium">{selectedWorkspace.name}</p>
                    {selectedWorkspace.cnpj && (
                      <p className="text-xs text-muted-foreground">{selectedWorkspace.cnpj}</p>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            // Versão completa: nome + CNPJ
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">
                  {selectedWorkspace.name}
                </p>
                {selectedWorkspace.cnpj && (
                  <p className="text-[10px] text-muted-foreground truncate">
                    {selectedWorkspace.cnpj}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {ungroupedItems.filter(item => {
          // Dashboard - sempre visível
          if (item.id === 'dashboard') return canView('dashboard-item');
          // Conversas - sempre visível
          if (item.id === 'conversas') return canView('conversas-item');
          // DS Voice - sempre visível
          if (item.id === 'ds-voice') return true;
          return true;
        }).map(renderMenuItem)}
        
        {canViewAnyIn(['crm-negocios-item', 'crm-contatos-item', 'crm-tags-item', 'crm-produtos-item']) && 
          renderGroup("crm", "CRM", crmItems.filter(item => {
            if (item.id === 'crm-negocios') return canView('crm-negocios-item');
            if (item.id === 'crm-contatos') return canView('crm-contatos-item');
            if (item.id === 'crm-tags') return canView('crm-tags-item');
            if (item.id === 'crm-produtos') return canView('crm-produtos-item');
            return false;
          }))}
        
        {(hasRole(['master', 'admin', 'mentor_master', 'gestor']) || canViewAnyIn(['workspace-empresas', 'workspace-relatorios'])) && 
          renderGroup("workspace", "Workspace", workspaceItems.filter(item => {
            if (item.id === 'workspace-empresas') return canView('workspace-empresas');
            if (item.id === 'workspace-relatorios') return canView('workspace-relatorios');
            return hasRole(['master', 'admin', 'mentor_master', 'gestor']);
          }))}
        
        {hasRole(['master', 'admin']) && renderGroup("administracao", "Administração", administracaoItems)}
      </nav>

      {/* Action Icons */}
      <div className={cn("flex-shrink-0", isCollapsed ? "p-3" : "p-4")}>
        <div className={cn("flex items-center", isCollapsed ? "flex-col gap-2" : "gap-2 justify-between")}>
          {/* Botão de notificações com tooltip */}
          <TooltipProvider>
            <Tooltip>
              {totalUnread > 0 ? <Popover open={isNotificationOpen} onOpenChange={setIsNotificationOpen}>
                  <PopoverTrigger asChild>
                    <TooltipTrigger asChild>
                      <button className="p-2 hover:bg-accent rounded-md relative">
              <Bell className={cn(isCollapsed ? "w-5 h-5" : "w-5 h-5", "text-muted-foreground")} />
                        <Badge variant="destructive" className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center text-xs bg-destructive text-destructive-foreground border-0">
                          {totalUnread > 99 ? '99+' : totalUnread}
                        </Badge>
                      </button>
                    </TooltipTrigger>
                  </PopoverTrigger>
                  <PopoverContent side="right" align="start" className="p-0 w-auto">
                    <NotificationTooltip notifications={notifications} totalUnread={totalUnread} getAvatarInitials={getAvatarInitials} getAvatarColor={getAvatarColor} formatTimestamp={formatTimestamp} onNotificationClick={handleNotificationClick} onMarkAllAsRead={handleMarkAllAsRead} onMarkContactAsRead={handleMarkContactAsRead} />
                  </PopoverContent>
                </Popover> : <TooltipTrigger asChild>
                  <button className="p-2 hover:bg-accent rounded-md relative">
                    <Bell className={cn(isCollapsed ? "w-6 h-6" : "w-5 h-5", "text-muted-foreground")} />
                  </button>
                </TooltipTrigger>}
              {isCollapsed && <TooltipContent side="right">
                  <p>Notificações</p>
                </TooltipContent>}
            </Tooltip>
          </TooltipProvider>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                
              </TooltipTrigger>
              {isCollapsed && <TooltipContent side="right">
                  <p>Mensagens</p>
                </TooltipContent>}
            </Tooltip>
          </TooltipProvider>
          
          
        </div>
      </div>

      {/* User Info */}
      <div className={cn("flex-shrink-0 rounded-t-lg bg-muted border-t", isCollapsed ? "p-3" : "p-4")}>
        <div className={cn("flex items-center", isCollapsed ? "justify-center" : "gap-3")}>
          {isCollapsed ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-8 h-8 bg-muted rounded-full flex items-center justify-center hover:bg-accent transition-colors">
                  <User className="w-5 h-5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="z-50 bg-background" side="right" align="end">
                {hasRole(['master']) && selectedWorkspace && (
                  <DropdownMenuItem onClick={handleBackToMasterDashboard}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Dashboard Master
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={logout} className="text-destructive">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground truncate">{user?.name}</div>
                <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
                <div className="text-xs text-primary font-medium capitalize">{userRole}</div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-1 hover:bg-accent rounded-md">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="z-50 bg-background" align="end">
                  {hasRole(['master']) && selectedWorkspace && (
                    <DropdownMenuItem onClick={handleBackToMasterDashboard}>
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Dashboard Master
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={logout} className="text-destructive">
                    <LogOut className="w-4 h-4 mr-2" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>
    </div>;
}