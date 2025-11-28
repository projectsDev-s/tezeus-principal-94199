import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, MoreVertical, ArrowLeft, LayoutDashboard, MessageCircle, Users, FolderOpen, Settings, Zap, Link, Shield, DollarSign, Target, Package, Calendar, CheckSquare, MessageSquare, Bot, BrainCircuit, GitBranch, Bell, User, LogOut, Handshake, FileText, Building2, BarChart3, AudioLines } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ModuleType } from "./TezeusCRM";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { NotificationTooltip } from "@/components/NotificationTooltip";
import { useRealtimeNotifications } from "@/components/RealtimeNotificationProvider";
import { useNotifications } from "@/hooks/useNotifications";
import { useWhatsAppConversations } from "@/hooks/useWhatsAppConversations";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { ImpersonateWorkspaceModal } from "@/components/modals/ImpersonateWorkspaceModal";
import { MeuPerfilModal } from "@/components/modals/MeuPerfilModal";
import { useSystemCustomizationContext } from "@/contexts/SystemCustomizationContext";
import { useCargoPermissions } from "@/hooks/useCargoPermissions";

interface SidebarProps {
  activeModule: ModuleType;
  onModuleChange: (module: ModuleType) => void;
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
  isCollapsed,
  onToggleCollapse,
  onNavigateToConversation
}: SidebarProps) {
  const navigate = useNavigate();
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [shouldLoadNotifications, setShouldLoadNotifications] = useState(false);
  const [isPerfilModalOpen, setIsPerfilModalOpen] = useState(false);

  // Hooks para notificações - usando o provider compartilhado
  const {
    notifications,
    totalUnread
  } = useRealtimeNotifications();
  
  // Funções do hook original
  const { 
    markContactAsRead,
    markAllAsRead,
    getAvatarInitials,
    getAvatarColor,
    formatTimestamp
  } = useNotifications();
  
  
  useEffect(() => {
    console.log('🔔 [Sidebar] Dados de notificação ATUALIZADOS:', {
      totalUnread,
      num_notifications: notifications.length,
      timestamp: new Date().toISOString(),
      notifications: notifications.map((n: any) => ({
        contact: n.contactName,
        content: n.content
      }))
    });
  }, [notifications, totalUnread]);
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

  const menuItems: (MenuItem & {
    group?: string;
  })[] = [{
    id: "dashboard",
    label: "Relatórios",
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
    label: "Minha Empresa",
    icon: <Building2 className="w-5 h-5" />
  }, {
    id: "crm-negocios",
    label: "Pipeline",
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
    label: "Produtos",
    icon: <Package className="w-5 h-5" />,
    group: "crm"
  }, {
    id: "automacoes-filas",
    label: "Filas",
    icon: <Users className="w-5 h-5" />,
    group: "administracao"
  }, {
    id: "administracao-google-agenda",
    label: "Google Agenda",
    icon: <Calendar className="w-5 h-5" />,
    group: "administracao"
  }, {
    id: "administracao-acoes",
    label: "Configuração de Ações",
    icon: <Settings className="w-5 h-5" />,
    group: "administracao"
  }];

  const renderMenuItem = (item: MenuItem & {
    group?: string;
  }) => {
    const isActive = activeModule === item.id;

    const menuButton = (
      <button
        key={item.id}
        onClick={() => onModuleChange(item.id)}
        className={cn(
          "w-full flex items-center transition-all relative group border border-transparent outline-none",
          isCollapsed ? "justify-center p-2" : "gap-2 px-3 py-1.5",
          "text-sm font-medium rounded-none", // Excel-like typography
          isActive 
            ? "bg-[#FEF3C7] border-gray-300 text-black font-bold shadow-sm z-10" // Active look: yellow background, bold black text
            : "text-gray-700 hover:bg-[#e1e1e1] hover:border-gray-300 hover:z-10" // Hover look
        )}
      >
        {React.cloneElement(item.icon as React.ReactElement, {
          className: cn(
            "transition-all duration-300",
            isCollapsed ? "w-4 h-4" : "w-3.5 h-3.5",
            isActive ? "text-black" : "text-gray-500 group-hover:text-gray-700"
          )
        })}
        {!isCollapsed && <span className="truncate">{item.label}</span>}
      </button>
    );

    if (isCollapsed) {
      return (
        <TooltipProvider key={item.id}>
          <Tooltip>
            <TooltipTrigger asChild>
              {menuButton}
            </TooltipTrigger>
            <TooltipContent side="right" className="ml-2 text-xs">
              <p>{item.label}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    return menuButton;
  };

  const handleNotificationClick = (conversationId: string) => {
    console.log('🔔 Sidebar - Clique na notificação:', conversationId);
    setIsNotificationOpen(false);

    if (onNavigateToConversation) {
      onNavigateToConversation(conversationId);
      setTimeout(() => {
        markContactAsRead(conversationId);
      }, 300);
    }
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead();
    setIsNotificationOpen(false);
  };

  const handleMarkContactAsRead = (conversationId: string) => {
    markContactAsRead(conversationId);
  };

  return (
    <div 
      data-sidebar 
      className={cn(
        "flex flex-col m-2 shadow-sm font-sans text-xs transition-all duration-300 ease-in-out relative",
        "bg-[#f0f0f0] border border-gray-300", // Excel-like background and border
        isCollapsed ? "w-12" : "w-52" // Compact widths
      )}
    >
      {/* Title Bar (Logo) */}
      <div className={cn(
        "flex-shrink-0 flex items-center bg-primary text-primary-foreground h-8 transition-all duration-300",
        isCollapsed ? "justify-center px-0" : "justify-between px-2"
      )}>
        {/* Logo ou Texto */}
        {customization.logo_url ? (
          <img 
            src={customization.logo_url} 
            alt="Logo" 
            className={cn(
              "object-contain transition-all duration-300", 
              isCollapsed ? "h-5 w-5" : "h-5"
            )} 
          />
        ) : (
           <h1 className={cn(
             "font-bold transition-all duration-300 truncate", 
             isCollapsed ? "text-xs" : "text-[16px]"
           )}>
            {isCollapsed ? "T" : "TEZEUS"}
          </h1>
        )}
        
        {/* Botão de colapso */}
        <button 
          onClick={onToggleCollapse} 
          className={cn(
            "p-0.5 hover:bg-primary-foreground/20 rounded transition-all duration-300 text-primary-foreground",
            isCollapsed && "rotate-180"
          )}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Workspace Info */}
      {selectedWorkspace && (
        <div className={cn(
          "flex-shrink-0 border-b border-gray-300 bg-white/50 transition-all duration-300",
          isCollapsed ? 'p-1 flex justify-center' : 'px-2 py-1.5'
        )}>
          <div className="flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-medium text-gray-800 truncate leading-tight">
                  {selectedWorkspace.name}
                </p>
                {selectedWorkspace.cnpj && (
                  <p className="text-[9px] text-gray-500 truncate leading-tight">
                    {selectedWorkspace.cnpj}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto">
        {menuItems.filter(item => {
          if (item.id === 'dashboard') return canView('dashboard-item');
          if (item.id === 'conversas') return canView('conversas-item');
          if (item.id === 'ds-voice') return true;
          if (item.id === 'workspace-empresas') return hasRole(['master', 'admin']);
          if (item.id === 'crm-negocios') return canView('crm-negocios-item');
          if (item.id === 'crm-contatos') return canView('crm-contatos-item');
          if (item.id === 'crm-tags') return canView('crm-tags-item');
          if (item.id === 'crm-produtos') return canView('crm-produtos-item');
          if (item.group === 'administracao') return hasRole(['master', 'admin']);
          return true;
        }).map(renderMenuItem)}
      </nav>

      {/* Action Icons */}
      <div className={cn("flex-shrink-0 border-t border-gray-300 bg-[#e6e6e6]", isCollapsed ? "p-1" : "p-2")}>
        <div className={cn("flex items-center", isCollapsed ? "flex-col gap-2" : "gap-2 justify-end")}>
          <TooltipProvider>
            <Tooltip>
              {totalUnread > 0 ? (
                <Popover open={isNotificationOpen} onOpenChange={setIsNotificationOpen}>
                  <PopoverTrigger asChild>
                     <TooltipTrigger asChild>
                       <button className="p-1 hover:bg-gray-300 rounded relative transition-all duration-200">
                         <Bell className="w-4 h-4 text-gray-600" />
                         <Badge 
                           variant="destructive" 
                           className="absolute -top-1 -right-1 w-3.5 h-3.5 p-0 flex items-center justify-center text-[9px] border-0"
                         >
                           {totalUnread > 99 ? '99' : totalUnread}
                         </Badge>
                      </button>
                    </TooltipTrigger>
                  </PopoverTrigger>
                  <PopoverContent side="right" align="start" className="p-0 w-auto rounded-none border-[#d4d4d4]">
                    <NotificationTooltip notifications={notifications} totalUnread={totalUnread} getAvatarInitials={getAvatarInitials} getAvatarColor={getAvatarColor} formatTimestamp={formatTimestamp} onNotificationClick={handleNotificationClick} onMarkAllAsRead={handleMarkAllAsRead} onMarkContactAsRead={handleMarkContactAsRead} />
                  </PopoverContent>
                </Popover>
              ) : (
                <TooltipTrigger asChild>
                  <button className="p-1 hover:bg-gray-300 rounded relative">
                    <Bell className="w-4 h-4 text-gray-600" />
                  </button>
                </TooltipTrigger>
              )}
              {isCollapsed && <TooltipContent side="right"><p>Notificações</p></TooltipContent>}
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* User Info */}
      <div className={cn("flex-shrink-0 border-t border-gray-300 bg-white", isCollapsed ? "p-1" : "p-2")}>
        <div className={cn("flex items-center", isCollapsed ? "justify-center" : "gap-2")}>
          {isCollapsed ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 border border-gray-300">
                  <User className="w-4 h-4 text-gray-600" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="z-50 bg-white border border-gray-300 shadow-md" side="right" align="end">
                {hasRole(['master']) && selectedWorkspace && (
                  <DropdownMenuItem onClick={handleBackToMasterDashboard} className="text-xs">
                    <ArrowLeft className="w-3 h-3 mr-2" />
                    Central Tezeus
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => setIsPerfilModalOpen(true)} className="text-xs">
                  <User className="w-3 h-3 mr-2" />
                  Meu Perfil
                </DropdownMenuItem>
                <DropdownMenuItem onClick={logout} className="text-xs text-red-600 focus:text-red-600">
                  <LogOut className="w-3 h-3 mr-2" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center border border-gray-300 flex-shrink-0">
                <User className="w-4 h-4 text-gray-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-800 truncate">{user?.name}</div>
                <div className="text-[10px] text-gray-500 truncate">{user?.email}</div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-1 hover:bg-gray-100 rounded text-gray-500">
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="z-50 bg-white border border-gray-300 shadow-md" align="end">
                  {hasRole(['master']) && selectedWorkspace && (
                    <DropdownMenuItem onClick={handleBackToMasterDashboard} className="text-xs">
                      <ArrowLeft className="w-3 h-3 mr-2" />
                      Central Tezeus
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => setIsPerfilModalOpen(true)} className="text-xs">
                    <User className="w-3 h-3 mr-2" />
                    Meu Perfil
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={logout} className="text-xs text-red-600 focus:text-red-600">
                    <LogOut className="w-3 h-3 mr-2" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>

      {/* Modal Meu Perfil */}
      <MeuPerfilModal 
        isOpen={isPerfilModalOpen} 
        onClose={() => setIsPerfilModalOpen(false)} 
      />
    </div>
  );
}
