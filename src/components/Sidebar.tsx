import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, ChevronLeft, MoreVertical } from "lucide-react";
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
import { 
  LayoutDashboard, 
  MessageCircle, 
  Users, 
  FolderOpen, 
  Settings, 
  Zap, 
  Link,
  Shield,
  DollarSign,
  Target,
  Package,
  Calendar,
  CheckSquare,
  MessageSquare,
  Bot,
  BrainCircuit,
  GitBranch,
  Bell,
  User,
  LogOut,
  Handshake,
  FileText,
  Building2,
  BarChart3,
  AudioLines
} from "lucide-react";


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

export function Sidebar({ activeModule, onModuleChange, isDarkMode, onToggleDarkMode, isCollapsed, onToggleCollapse, onNavigateToConversation }: SidebarProps) {
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [impersonateOpen, setImpersonateOpen] = useState(false);

  // Hooks para notificações e autenticação
  const { 
    notifications, 
    totalUnread, 
    getAvatarInitials, 
    getAvatarColor, 
    formatTimestamp 
  } = useNotifications();
  
  const { markAsRead } = useWhatsAppConversations();
  const { user, userRole, hasRole, logout } = useAuth();
  const { workspaces, isLoading } = useWorkspaces();
  const { selectedWorkspace, setSelectedWorkspace } = useWorkspace();
  const { customization } = useSystemCustomizationContext();

  // Auto-select first workspace for master users
  useEffect(() => {
    if (userRole === 'master' && !selectedWorkspace && workspaces.length > 0 && !isLoading) {
      setSelectedWorkspace(workspaces[0]);
    }
  }, [userRole, selectedWorkspace, workspaces, isLoading, setSelectedWorkspace]);

  // Garantir que o grupo "administracao" fique expandido quando os módulos de administração estiverem ativos
  useEffect(() => {
    if (activeModule === "administracao-financeiro" || activeModule === "administracao-usuarios" || activeModule === "administracao-configuracoes" || activeModule === "administracao-dashboard" || activeModule === "automacoes-agente" || activeModule === "automacoes-filas") {
      setExpandedGroups(prev => 
        prev.includes("administracao") ? prev : [...prev, "administracao"]
      );
    }
  }, [activeModule]);

  const menuItems: (MenuItem & { group?: string })[] = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: <LayoutDashboard className="w-5 h-5" />
    },
    {
      id: "conversas",
      label: "Conversas",
      icon: <MessageCircle className="w-5 h-5" />
    },
    {
      id: "ds-voice",
      label: "Mensagens Rápidas",
      icon: <AudioLines className="w-5 h-5" />
    },
    {
      id: "workspace-empresas",
      label: "Empresas",
      icon: <Building2 className="w-5 h-5" />,
      group: "workspace"
    },
    {
      id: "workspace-relatorios",
      label: "Relatórios",
      icon: <BarChart3 className="w-5 h-5" />,
      group: "workspace"
    },
    {
      id: "crm-negocios",
      label: "Negócios",
      icon: <DollarSign className="w-5 h-5" />,
      group: "crm"
    },
    {
      id: "crm-contatos",
      label: "Contatos",
      icon: <Users className="w-5 h-5" />,
      group: "crm"
    },
    {
      id: "crm-tags",
      label: "Tags",
      icon: <Target className="w-5 h-5" />,
      group: "crm"
    },
    {
      id: "crm-produtos",
      label: "Produtos Comerciais",
      icon: <Package className="w-5 h-5" />,
      group: "crm"
    },
    {
      id: "automacoes-agente",
      label: "DS Agente",
      icon: <BrainCircuit className="w-5 h-5" />,
      group: "administracao"
    },
    {
      id: "automacoes-filas",
      label: "Filas",
      icon: <Users className="w-5 h-5" />,
      group: "administracao"
    },
    {
      id: "parceiros-clientes",
      label: "Clientes",
      icon: <Users className="w-5 h-5" />,
      group: "parceiros"
    },
    {
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
    },
    {
      id: "administracao-configuracoes",
      label: "Configurações",
      icon: <Settings className="w-5 h-5" />,
      group: "administracao"
    }
  ];

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => 
      prev.includes(group) 
        ? prev.filter(g => g !== group)
        : [...prev, group]
    );
  };

  const renderMenuItem = (item: MenuItem & { group?: string }) => {
    const isActive = activeModule === item.id;
    
    const menuButton = (
      <button
        key={item.id}
        onClick={() => onModuleChange(item.id)}
        className={cn(
          "w-full flex items-center rounded-md transition-colors relative",
          isCollapsed ? "justify-center p-3" : "gap-3 px-4 py-3",
          item.group && !isCollapsed && "pl-8",
          isActive 
            ? "bg-sidebar-active text-sidebar-active-foreground hover:bg-sidebar-active"
            : "hover:bg-sidebar-accent text-sidebar-foreground"
        )}
      >
        {item.icon}
        {!isCollapsed && <span className="text-sm font-medium">{item.label}</span>}
      </button>
    );

    if (isCollapsed) {
      return (
        <TooltipProvider key={item.id}>
          <Tooltip>
            <TooltipTrigger asChild>
              {menuButton}
            </TooltipTrigger>
            <TooltipContent side="right" className="ml-2">
              <p>{item.label}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return menuButton;
  };

  const renderGroup = (groupName: string, label: string, items: (MenuItem & { group?: string })[]) => {
    const isExpanded = expandedGroups.includes(groupName);
    
    if (isCollapsed) {
      // No modo colapsado, mostrar apenas os ícones dos itens do grupo
      return (
        <div key={groupName} className="space-y-1">
          {items.map(renderMenuItem)}
        </div>
      );
    }
    
    return (
      <div key={groupName}>
        <button
          onClick={() => toggleGroup(groupName)}
          className="w-full flex items-center gap-2 px-4 py-2 text-sm font-medium hover:bg-sidebar-accent rounded-md text-sidebar-foreground"
        >
          {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          <span>{label}</span>
        </button>
        {isExpanded && (
          <div className="space-y-1">
            {items.map(renderMenuItem)}
          </div>
        )}
      </div>
    );
  };

  const ungroupedItems = menuItems.filter(item => !item.group);
  const workspaceItems = menuItems.filter(item => item.group === "workspace");
  const crmItems = menuItems.filter(item => item.group === "crm");
  const parceirosItems = menuItems.filter(item => item.group === "parceiros");
  const administracaoItems = menuItems.filter(item => item.group === "administracao");

  const handleNotificationClick = (conversationId: string) => {
    console.log('🔔 Sidebar - Clique na notificação:', conversationId);
    setIsNotificationOpen(false);
    
    // ✅ CORREÇÃO 1: Navegar PRIMEIRO, depois marcar como lida
    if (onNavigateToConversation) {
      console.log('🚀 Navegando para conversa:', conversationId);
      onNavigateToConversation(conversationId);
      
      // Marcar como lida após uma pequena pausa para garantir que a navegação aconteceu
      setTimeout(() => {
        console.log('✅ Marcando conversa como lida:', conversationId);
        markAsRead(conversationId);
      }, 500);
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

  return (
    <div 
      data-sidebar
      className={cn(
        "rounded-lg shadow-md m-2 flex flex-col max-h-[calc(100vh-1rem)] transition-all duration-300 relative bg-sidebar border border-sidebar-border",
        isCollapsed ? "w-20" : "w-64"
      )}
    >
      {/* Logo */}
      <div 
        className={cn(
          "flex-shrink-0 flex items-center justify-between border-b",
          isCollapsed ? "p-3" : "p-6"
        )}
      >
        {/* Logo ou Texto */}
        {customization.logo_url ? (
          <img 
            src={customization.logo_url} 
            alt="Logo do Sistema" 
            className={cn(
              "object-contain transition-all duration-300",
              isCollapsed ? "h-8" : "h-10"
            )}
          />
        ) : (
          <h1 
            className={cn(
              "font-bold transition-all duration-300 text-sidebar-foreground",
              isCollapsed ? "text-lg" : "text-2xl"
            )}
          >
            {isCollapsed ? "T" : "TEZEUS"}
          </h1>
        )}
        
        {/* Botão de colapso */}
        <button
          onClick={onToggleCollapse}
          className={cn(
            "p-1 hover:bg-accent rounded-md transition-transform duration-300 text-muted-foreground",
            isCollapsed && "rotate-180"
          )}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {ungroupedItems.map(renderMenuItem)}
        
        {renderGroup("crm", "CRM", crmItems)}
        {hasRole(['master', 'admin', 'mentor_master', 'gestor']) && renderGroup("workspace", "Workspace", workspaceItems)}
        
        {hasRole(['master', 'admin']) && renderGroup("administracao", "Administração", administracaoItems)}
      </nav>

      {/* Action Icons */}
      <div className={cn("flex-shrink-0", isCollapsed ? "p-3" : "p-4")}>
        <div className={cn(
          "flex items-center",
          isCollapsed ? "flex-col gap-2" : "gap-2 justify-between"
        )}>
          {/* Botão de notificações com tooltip */}
          <TooltipProvider>
            <Tooltip>
              {totalUnread > 0 ? (
                <Popover open={isNotificationOpen} onOpenChange={setIsNotificationOpen}>
                  <PopoverTrigger asChild>
                    <TooltipTrigger asChild>
                      <button className="p-2 hover:bg-accent rounded-md relative">
                        <Bell className="w-5 h-5 text-muted-foreground" />
                        <Badge 
                          variant="destructive" 
                          className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center text-xs bg-destructive text-destructive-foreground border-0"
                        >
                          {totalUnread > 99 ? '99+' : totalUnread}
                        </Badge>
                      </button>
                    </TooltipTrigger>
                  </PopoverTrigger>
                  <PopoverContent side="right" align="start" className="p-0 w-auto">
                    <NotificationTooltip
                      notifications={notifications}
                      totalUnread={totalUnread}
                      getAvatarInitials={getAvatarInitials}
                      getAvatarColor={getAvatarColor}
                      formatTimestamp={formatTimestamp}
                      onNotificationClick={handleNotificationClick}
                      onMarkAllAsRead={handleMarkAllAsRead}
                      onMarkContactAsRead={handleMarkContactAsRead}
                    />
                  </PopoverContent>
                </Popover>
              ) : (
                <TooltipTrigger asChild>
                  <button className="p-2 hover:bg-accent rounded-md relative">
                    <Bell className="w-5 h-5 text-muted-foreground" />
                  </button>
                </TooltipTrigger>
              )}
              {isCollapsed && (
                <TooltipContent side="right">
                  <p>Notificações</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="p-2 hover:bg-accent rounded-md">
                  <MessageCircle className="w-5 h-5 text-muted-foreground" />
                </button>
              </TooltipTrigger>
              {isCollapsed && (
                <TooltipContent side="right">
                  <p>Mensagens</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
          
          
        </div>
      </div>

      {/* User Info */}
      <div 
        className={cn("flex-shrink-0 rounded-t-lg bg-muted border-t", isCollapsed ? "p-3" : "p-4")} 
      >
        <div className={cn(
          "flex items-center",
          isCollapsed ? "justify-center" : "gap-3"
        )}>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm font-medium text-primary">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
              </TooltipTrigger>
              {isCollapsed && (
                <TooltipContent side="right">
                  <p>{user?.name}</p>
                  <p className="text-xs">{user?.email}</p>
                  <p className="text-xs font-medium capitalize">{userRole}</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
          
          {!isCollapsed && (
            <>
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
                  {hasRole(['master']) && (
                    <DropdownMenuItem onClick={() => setImpersonateOpen(true)}>
                      <Building2 className="w-4 h-4 mr-2" />
                      Personificar empresa
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
      
      <ImpersonateWorkspaceModal 
        open={impersonateOpen} 
        onOpenChange={setImpersonateOpen} 
      />
    </div>
  );
}
