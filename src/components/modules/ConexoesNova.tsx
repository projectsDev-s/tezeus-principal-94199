import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { getRandomConnectionColor, getConnectionColor } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Trash2, Wifi, QrCode, Plus, MoreVertical, Edit3, RefreshCw, Webhook, Star, Bug, ArrowRight, Zap, Cloud } from 'lucide-react';
import { TestWebhookReceptionModal } from "@/components/modals/TestWebhookReceptionModal";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { toast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { evolutionProvider } from '@/services/EvolutionProvider';
import type { Connection, HISTORY_RECOVERY_MAP } from '@/types/evolution';
import { useWorkspaceLimits } from '@/hooks/useWorkspaceLimits';
import { useWorkspaceRole } from '@/hooks/useWorkspaceRole';
import { usePipelinesContext } from '@/contexts/PipelinesContext';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQueues } from '@/hooks/useQueues';
import { useAuth } from '@/hooks/useAuth';

// Helper functions for phone number formatting
const normalizePhoneNumber = (phone: string): string => {
  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly && !digitsOnly.startsWith('55')) {
    return `55${digitsOnly}`;
  }
  return digitsOnly;
};

const formatPhoneNumberDisplay = (phone: string): string => {
  if (!phone) return '-';
  
  const normalized = normalizePhoneNumber(phone);
  if (normalized.length >= 13) {
    const country = normalized.slice(0, 2);
    const area = normalized.slice(2, 4);
    const firstPart = normalized.slice(4, 9);
    const secondPart = normalized.slice(9, 13);
    return `${country} (${area}) ${firstPart}-${secondPart}`;
  }
  
  return phone;
};

interface ConexoesNovaProps {
  workspaceId: string;
}

export function ConexoesNova({ workspaceId }: ConexoesNovaProps) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [workspacePipelines, setWorkspacePipelines] = useState<any[]>([]);
  const [loadingPipelines, setLoadingPipelines] = useState(false);
  
  const { usage, isLoading: isLoadingLimits, refreshLimits } = useWorkspaceLimits(workspaceId);
  const { canCreateConnections } = useWorkspaceRole();
  const navigate = useNavigate();
  const { queues } = useQueues(workspaceId);
  const { userRole } = useAuth();
  const { workspaceId: urlWorkspaceId } = useParams<{ workspaceId: string }>();
  
  // Detectar se está na master-dashboard
  const isInMasterDashboard = window.location.pathname === '/master-dashboard';

  // Helper function to build navigation paths
  const getNavigationPath = (path: string) => {
    if (userRole === 'master') {
      // Para Master, SEMPRE usar o workspaceId da URL atual
      const currentWorkspaceId = urlWorkspaceId || workspaceId;
      
      console.log('🔍 DEBUG getNavigationPath:', {
        userRole,
        urlWorkspaceId,
        propWorkspaceId: workspaceId,
        currentWorkspaceId,
        currentPath: window.location.pathname,
        targetPath: path
      });
      
      if (currentWorkspaceId) {
        const finalPath = `/workspace/${currentWorkspaceId}${path}`;
        console.log('✅ Navegando para:', finalPath);
        return finalPath;
      }
    }
    
    console.log('👤 Navegação direta para:', path);
    return path;
  };

  // Debug: Log usage changes
  useEffect(() => {
    console.log('🟢 ConexoesNova: workspaceId:', workspaceId);
    console.log('🟢 ConexoesNova: usage:', usage);
    console.log('🟢 ConexoesNova: isLoadingLimits:', isLoadingLimits);
  }, [usage, workspaceId, isLoadingLimits]);

  // Função para carregar pipelines do workspace específico
  const loadWorkspacePipelines = async () => {
    if (!workspaceId) return;
    
    try {
      setLoadingPipelines(true);
      
      const userData = localStorage.getItem('currentUser');
      if (!userData) {
        throw new Error('Usuário não encontrado');
      }
      
      const user = JSON.parse(userData);
      const headers = {
        'x-system-user-id': user.id,
        'x-system-user-email': user.email,
        'x-workspace-id': workspaceId
      };

      const { data, error } = await supabase.functions.invoke('pipeline-management/pipelines', {
        method: 'GET',
        headers
      });

      if (error) {
        console.error('❌ Pipeline fetch error:', error);
        throw error;
      }

      setWorkspacePipelines(data || []);
    } catch (error) {
      console.error('❌ Error fetching workspace pipelines:', error);
      setWorkspacePipelines([]);
    } finally {
      setLoadingPipelines(false);
    }
  };

  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingConnection, setEditingConnection] = useState<Connection | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [connectionToDelete, setConnectionToDelete] = useState<Connection | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSettingDefault, setIsSettingDefault] = useState(false);
  
  // Form states
  const [instanceName, setInstanceName] = useState('');
  const [historyRecovery, setHistoryRecovery] = useState('none');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [createCrmCard, setCreateCrmCard] = useState(false);
  const [selectedPipeline, setSelectedPipeline] = useState<string>('');
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [selectedQueueId, setSelectedQueueId] = useState<string>('');
  const [pipelineColumns, setPipelineColumns] = useState<any[]>([]);
  const [loadingColumns, setLoadingColumns] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<'evolution' | 'zapi'>('evolution');
  const [loadingProvider, setLoadingProvider] = useState(false);

  // Load connections on component mount
  useEffect(() => {
    if (workspaceId) {
      console.log('🔄 ConexoesNova: Loading connections and refreshing limits on mount');
      loadConnections();
      refreshLimits(); // Force refresh limits when component mounts
    }
    
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [workspaceId]);

  // Carregar pipelines e provider ativo quando o modal for aberto
  useEffect(() => {
    const loadModalData = async () => {
      if (isCreateModalOpen && workspaceId) {
        loadWorkspacePipelines();
        
        // Buscar provider ativo do workspace
        if (!isEditMode) {
          try {
            setLoadingProvider(true);
            
            console.log('🔍 Buscando provider ativo para workspace:', workspaceId);
            
            const { data, error } = await supabase
              .from('whatsapp_providers')
              .select('*')
              .eq('workspace_id', workspaceId)
              .eq('is_active', true)
              .limit(1);

            console.log('📊 Resultado da busca:', { data, error });

            if (error) {
              console.error('❌ Erro ao buscar provider ativo:', error);
              setSelectedProvider('evolution');
            } else if (data && data.length > 0) {
              const activeProvider = data[0];
              if (activeProvider.provider === 'evolution' || activeProvider.provider === 'zapi') {
                console.log('✅ Provider ativo encontrado:', activeProvider.provider);
                setSelectedProvider(activeProvider.provider as 'evolution' | 'zapi');
              } else {
                console.log('⚠️ Provider inválido, usando Evolution como padrão');
                setSelectedProvider('evolution');
              }
            } else {
              console.log('⚠️ Nenhum provider ativo encontrado, usando Evolution como padrão');
              setSelectedProvider('evolution');
            }
          } catch (error) {
            console.error('❌ Erro ao carregar provider:', error);
            setSelectedProvider('evolution');
          } finally {
            setLoadingProvider(false);
          }
        }
      }
    };
    
    loadModalData();
  }, [isCreateModalOpen, workspaceId, isEditMode]);

  // Carregar colunas quando pipeline for selecionado
  useEffect(() => {
    const loadPipelineColumns = async () => {
      if (!selectedPipeline || !workspaceId) {
        setPipelineColumns([]);
        setSelectedColumn('');
        setLoadingColumns(false);
        return;
      }

      try {
        setLoadingColumns(true);
        
        const { data, error } = await supabase
          .from('pipeline_columns')
          .select('*')
          .eq('pipeline_id', selectedPipeline)
          .order('order_position', { ascending: true });

        if (error) throw error;
        
        console.log('✅ Colunas carregadas:', data);
        setPipelineColumns(data || []);
        
        // Se não estiver editando, selecionar a primeira coluna automaticamente
        if (!selectedColumn && data && data.length > 0) {
          setSelectedColumn(data[0].id);
        }
      } catch (error) {
        console.error('❌ Erro ao carregar colunas:', error);
        setPipelineColumns([]);
      } finally {
        setLoadingColumns(false);
      }
    };

    loadPipelineColumns();
  }, [selectedPipeline, workspaceId]);

  const loadConnections = async () => {
    try {
      // Loading connections
      setIsLoading(true);
      
      const response = await evolutionProvider.listConnections(workspaceId);
      console.log('📋 ConexoesNova received response:', response);
      
      setConnections(response.connections);
      refreshLimits(); // Refresh limits when connections are loaded
    } catch (error) {
      console.warn('Error loading connections:', error);
      // Silently set empty connections array instead of showing error toast
      setConnections([]);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshQRCode = async (connectionId: string) => {
    try {
      setIsRefreshing(true);
      console.log(`🔄 Refreshing QR code for connection ${connectionId}`);
      
      // Buscar conexão para verificar provider
      const connection = connections.find(c => c.id === connectionId);
      
      if (!connection) {
        throw new Error('Conexão não encontrada');
      }

      // Se for Z-API, usar endpoint específico
      if (connection.provider?.provider === 'zapi') {
        console.log('📱 Refreshing Z-API QR code');
        
        const { data, error } = await supabase.functions.invoke('refresh-zapi-qr', {
          body: { connectionId }
        });

        if (error) throw error;

        if (!data.success) {
          throw new Error(data.error || 'Erro ao atualizar QR code');
        }

        // Atualizar conexão local com novo QR
        if (selectedConnection) {
          setSelectedConnection(prev => prev ? { 
            ...prev, 
            qr_code: data.qrCode, 
            status: 'qr' 
          } : null);
        }

        // Recarregar conexões
        await loadConnections();

        toast({
          title: 'QR Code Atualizado',
          description: 'Escaneie o novo QR code Z-API com seu WhatsApp',
        });

        return;
      }

      // Evolution API (comportamento original)
      const response = await evolutionProvider.getQRCode(connectionId);
      
      if (response.qr_code && selectedConnection) {
        // Update the connection with new QR code
        setSelectedConnection(prev => prev ? { ...prev, qr_code: response.qr_code, status: 'qr' } : null);

        toast({
          title: 'QR Code Atualizado',
          description: 'Escaneie o novo QR code com seu WhatsApp',
        });
      }
    } catch (error) {
      console.error('Error refreshing QR code:', error);
      toast({
        title: 'Erro',
        description: `Erro ao atualizar QR Code: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const createInstance = async (retryCount = 0) => {
    if (!instanceName.trim()) {
      toast({
        title: 'Erro',
        description: 'Nome da instância é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    // Check frontend limit before making the request
    if (usage && !usage.canCreateMore) {
      toast({
        title: 'Limite atingido',
        description: `Não é possível criar mais conexões. Limite: ${usage.current}/${usage.limit}`,
        variant: 'destructive',
      });
      return;
    }

    // Check for duplicate instance names
    const existingConnection = connections.find(conn => 
      conn.instance_name.toLowerCase() === instanceName.trim().toLowerCase()
    );
    
    if (existingConnection) {
      toast({
        title: 'Erro',
        description: 'Já existe uma instância com este nome',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsCreating(true);

      // Gera cor aleatória para a nova conexão
      const connectionColor = getRandomConnectionColor();

      // Buscar nome da coluna selecionada
      const selectedColumnData = pipelineColumns.find(col => col.id === selectedColumn);
      
      const connectionData = {
        instanceName: instanceName.trim(),
        historyRecovery: historyRecovery as 'none' | 'week' | 'month' | 'quarter',
        workspaceId,
        autoCreateCrmCard: createCrmCard,
        defaultPipelineId: selectedPipeline || null,
        defaultColumnId: selectedColumn || null,
        defaultColumnName: selectedColumnData?.name || null,
        queueId: selectedQueueId || null,
        phoneNumber: phoneNumber?.trim() || null,
        provider: selectedProvider,
        metadata: {
          border_color: connectionColor
        }
      };

      console.log('📤 Creating connection with data:', {
        ...connectionData,
        selectedColumn,
        selectedPipeline,
        selectedColumnData,
        pipelineColumnsCount: pipelineColumns.length
      });
      
      const connection = await evolutionProvider.createConnection(connectionData);

      // Connection created

      toast({
        title: 'Sucesso',
        description: 'Instância criada com sucesso!',
      });
      
      // Reset form and close modal
      resetModal();
      
      // Reload connections (silently)
      loadConnections();
      refreshLimits(); // Refresh limits after creating connection

      // If connection has QR code, automatically open QR modal
      if (connection.qr_code) {
        console.log('QR Code already available, opening modal');
        setSelectedConnection(connection);
        setIsQRModalOpen(true);
        startPolling(connection.id);
        
        // Show sync notification if history recovery is enabled
        if (historyRecovery !== 'none') {
          const historyLabels = {
            'week': '1 semana',
            'month': '1 mês',
            'quarter': '3 meses'
          };
          
          toast({
            title: 'Sincronização Habilitada',
            description: `Após conectar, o histórico de ${historyLabels[historyRecovery as keyof typeof historyLabels]} será sincronizado automaticamente.`,
            duration: 5000,
          });
        }
      } else {
        // Try to get QR code immediately after creation
        console.log('No QR code in response, trying to get one...');
        connectInstance(connection);
      }

    } catch (error) {
      console.error('❌ Error creating instance:', error);
      
      // Check if it's a CORS or network error and retry up to 3 times
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      const isCorsError = errorMessage.toLowerCase().includes('cors') || 
                         errorMessage.toLowerCase().includes('network') ||
                         errorMessage.toLowerCase().includes('fetch');
      
      if (isCorsError && retryCount < 3) {
        console.log(`🔄 Retrying connection creation (attempt ${retryCount + 1}/3)...`);
        
        // Show retry toast
        toast({
          title: 'Reconectando...',
          description: `Tentativa ${retryCount + 1} de 3. Aguarde...`,
        });
        
        // Wait 2 seconds before retry
        setTimeout(() => {
          createInstance(retryCount + 1);
        }, 2000);
        
        return;
      }
      
      // Show final error message
      toast({
        title: 'Erro',
        description: retryCount > 0 
          ? `Erro após ${retryCount + 1} tentativas: ${errorMessage}`
          : `Erro ao criar instância: ${errorMessage}`,
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const editConnection = async () => {
    if (!editingConnection) return;
    
    setIsLoading(true);
    try {
      // Buscar nome da coluna selecionada
      const selectedColumnData = pipelineColumns.find(col => col.id === selectedColumn);
      
      const updateData = {
        connectionId: editingConnection.id,
        phone_number: phoneNumber?.trim() || null,
        auto_create_crm_card: createCrmCard,
        default_pipeline_id: selectedPipeline || null,
        default_column_id: selectedColumn || null,
        default_column_name: selectedColumnData?.name || null,
        queue_id: selectedQueueId || null,
      };

      console.log('Updating connection with data:', updateData);

      await evolutionProvider.updateConnection(updateData);
      
      toast({
        title: "Sucesso",
        description: "Conexão atualizada com sucesso!",
      });

      // Refresh connections list
      await loadConnections();
      
      // Reset form and close modal
      resetModal();
      
    } catch (error) {
      console.error('Error updating connection:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao atualizar conexão",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetModal = () => {
    setInstanceName('');
    setPhoneNumber('');
    setHistoryRecovery('none');
    setCreateCrmCard(false);
    setSelectedPipeline('');
    setSelectedColumn('');
    setSelectedQueueId('');
    setPipelineColumns([]);
    setLoadingColumns(false);
    setIsEditMode(false);
    setEditingConnection(null);
    setIsCreateModalOpen(false);
    setSelectedProvider('evolution');
  };

  const openEditModal = (connection: Connection) => {
    setEditingConnection(connection);
    setInstanceName(connection.instance_name);
    setPhoneNumber(connection.phone_number || '');
    setHistoryRecovery(connection.history_recovery);
    setCreateCrmCard(connection.auto_create_crm_card || false);
    setSelectedPipeline(connection.default_pipeline_id || '');
    setSelectedColumn(connection.default_column_id || '');
    setSelectedQueueId(connection.queue_id || '');
    setIsEditMode(true);
    setIsCreateModalOpen(true);
  };

  const openDeleteModal = (connection: Connection) => {
    setConnectionToDelete(connection);
    setIsDeleteModalOpen(true);
  };

  const removeConnection = async () => {
    if (!connectionToDelete) return;

    try {
      setIsDisconnecting(true);

      const result = await evolutionProvider.deleteConnection(connectionToDelete.id);

      if (result.success) {
        toast({
          title: "Sucesso",
          description: "Instância excluída com sucesso",
          variant: "default",
        });
      } else {
        toast({
          title: "Erro",
          description: "Erro ao excluir instância",
          variant: "destructive",
        });
      }

      loadConnections(); // Silent reload
      refreshLimits(); // Refresh limits after deleting connection
      setIsDeleteModalOpen(false);
      setConnectionToDelete(null);

    } catch (error) {
      console.error('Error deleting connection:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir conexão",
        variant: "destructive",
      });
    } finally {
      setIsDisconnecting(false);
    }
  };

  const forceResyncHistory = async (connection: Connection) => {
    try {
      toast({
        title: 'Sincronizando...',
        description: 'Iniciando sincronização de histórico',
      });
      
      // Resetar status no banco
      const { error: updateError } = await supabase
        .from('connections')
        .update({ 
          history_sync_status: 'pending',
          history_sync_started_at: null 
        })
        .eq('id', connection.id);
      
      if (updateError) throw updateError;
      
      // Chamar edge function diretamente
      const { data, error: invokeError } = await supabase.functions.invoke('evolution-trigger-history-sync', {
        body: {
          instanceName: connection.instance_name,
          workspaceId: workspaceId,
          historyDays: connection.history_days || 0,
          historyRecovery: connection.history_recovery || 'none'
        }
      });
      
      if (invokeError) throw invokeError;
      
      toast({
        title: 'Sincronização Iniciada',
        description: `${data?.total || 0} mensagens encontradas para processar`,
      });
      
      // Reload connections
      loadConnections();
    } catch (error) {
      console.error('Error forcing resync:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao forçar ressincronização',
        variant: 'destructive',
      });
    }
  };

  const connectInstance = async (connection: Connection) => {
    try {
      setIsConnecting(true);
      setSelectedConnection(connection);
      
      // Verificar qual provider está sendo usado
      const isZAPI = connection.provider?.provider === 'zapi';
      console.log('🔌 Conectando instância:', { 
        instanceName: connection.instance_name, 
        provider: connection.provider?.provider || 'evolution',
        isZAPI 
      });
      
      // Check if connection already has QR code
      if (connection.qr_code) {
        console.log('Using existing QR code:', connection.qr_code);
        
        // If qr_code is a JSON string, parse it and extract base64
        let qrCodeData = connection.qr_code;
        try {
          const parsed = JSON.parse(connection.qr_code);
          if (parsed.base64) {
            qrCodeData = parsed.base64;
          }
        } catch (e) {
          // If it's not JSON, use as is
          console.log('QR code is not JSON, using as is');
        }
        
        setSelectedConnection(prev => prev ? { ...prev, qr_code: qrCodeData, status: 'qr' } : null);
        setIsQRModalOpen(true);
        
        // Start polling for connection status
        startPolling(connection.id);
        return;
      }
      
      // Se for Z-API, buscar QR code do Z-API
      if (isZAPI) {
        console.log('📱 Buscando QR Code do Z-API');
        
        const { data, error } = await supabase.functions.invoke('refresh-zapi-qr', {
          body: { connectionId: connection.id }
        });

        if (error) throw error;
        if (!data?.success) {
          throw new Error(data?.error || 'Erro ao obter QR Code do Z-API');
        }

        if (data.qr_code) {
          setSelectedConnection(prev => prev ? { ...prev, qr_code: data.qr_code, status: 'qr' } : null);
          setIsQRModalOpen(true);
          startPolling(connection.id);
          loadConnections();
        } else {
          throw new Error('QR Code não encontrado na resposta do Z-API');
        }
        
        return;
      }
      
      // Evolution API (comportamento original)
      const response = await evolutionProvider.getQRCode(connection.id);
      
      if (response.qr_code) {
        // Update the connection with QR code
        setSelectedConnection(prev => prev ? { ...prev, qr_code: response.qr_code, status: 'qr' } : null);
        setIsQRModalOpen(true);
        
        // Start polling for connection status
        startPolling(connection.id);
        
        // Reload connections to get updated status (silently)
        loadConnections();
      } else {
        throw new Error('QR Code não encontrado na resposta');
      }

    } catch (error) {
      console.error('Error connecting instance:', error);
      toast({
        title: 'Erro',
        description: `Erro ao conectar instância: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        variant: 'destructive',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const startPolling = (connectionId: string) => {
    if (pollInterval) {
      clearInterval(pollInterval);
    }
    
    console.log(`🔄 Starting polling for connection ${connectionId}`);
    
    // Buscar a conexão para verificar o provider
    const connection = connections.find(c => c.id === connectionId);
    const isZAPI = connection?.provider?.provider === 'zapi';
    
    console.log(`🔌 Polling para provider: ${isZAPI ? 'Z-API' : 'Evolution'}`);
    
    // Rastrear último status notificado para evitar loops
    let lastNotifiedStatus: string | null = null;
    let isInitialCheck = true; // Flag para primeira verificação
    
    // Verificação de status
    const checkStatus = async () => {
      try {
        let connectionStatus;
        
        // Se for Z-API, usar endpoint específico
        if (isZAPI) {
          const { data, error } = await supabase.functions.invoke('check-zapi-status', {
            body: { connectionId }
          });
          
          if (error) throw error;
          if (!data?.success) {
            throw new Error(data?.error || 'Erro ao verificar status Z-API');
          }
          
          // Adaptar resposta Z-API para formato esperado
          connectionStatus = {
            id: connectionId,
            instance_name: connection?.instance_name || '',
            status: data.status || 'disconnected',
            phone_number: data.zapiStatus?.phone || undefined,
          };
        } else {
          // Evolution API (comportamento original)
          connectionStatus = await evolutionProvider.getConnectionStatus(connectionId);
        }
        
        console.log(`📊 Status recebido (${isZAPI ? 'Z-API' : 'Evolution'}):`, connectionStatus);
        
        // Atualizar selectedConnection com o status atual
        if (selectedConnection) {
          setSelectedConnection(prev => prev ? { 
            ...prev, 
            status: connectionStatus.status,
            phone_number: connectionStatus.phone_number || prev.phone_number
          } : null);
        }
        
        // Conectado - notificar apenas uma vez
        if (connectionStatus.status === 'connected' && lastNotifiedStatus !== 'connected') {
          lastNotifiedStatus = 'connected';
          
          // Clear polling
          if (pollInterval) clearInterval(pollInterval);
          setPollInterval(null);
          
          // Close modal and update UI
          setIsQRModalOpen(false);
          setSelectedConnection(null);
          
          // Reload connections (silently)
          await loadConnections();
          
          toast({
            title: '✅ Conectado!',
            description: connectionStatus.phone_number ? 
              `WhatsApp conectado como ${connectionStatus.phone_number}!` : 
              'WhatsApp conectado com sucesso!',
          });
          
          return true; // Indica que conectou
        } 
        
        // Desconectado - NÃO notificar na verificação inicial do modal
        // Só notificar se for uma desconexão que aconteceu durante o processo
        if (connectionStatus.status === 'disconnected' && 
            !isInitialCheck && 
            selectedConnection?.status !== 'qr' && 
            lastNotifiedStatus !== 'disconnected') {
          lastNotifiedStatus = 'disconnected';
          
          // Só desconecta se não estiver aguardando QR
          if (pollInterval) clearInterval(pollInterval);
          setPollInterval(null);
          setIsQRModalOpen(false);
          setSelectedConnection(null);
          
          await loadConnections();
          
          toast({
            title: 'Desconectado',
            description: `Conexão foi desconectada.`,
            variant: "destructive",
          });
          
          return true; // Indica que finalizou
        }
        
        // Após primeira verificação, desabilitar flag
        if (isInitialCheck) {
          isInitialCheck = false;
        }
        
        return false; // Continua polling
      } catch (error) {
        console.error('Error polling connection status:', error);
        
        // Se for erro 404 ou conexão não encontrada, parar polling
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('404') || errorMessage.includes('not found') || errorMessage.includes('Connection not found')) {
          console.log('⚠️ Conexão não encontrada (404), parando polling');
          
          // Limpar polling
          if (pollInterval) clearInterval(pollInterval);
          setPollInterval(null);
          
          // Fechar modal
          setIsQRModalOpen(false);
          setSelectedConnection(null);
          
          // Recarregar lista
          await loadConnections();
          
          toast({
            title: "Erro",
            description: "Conexão não encontrada. A instância pode ter sido deletada.",
            variant: "destructive"
          });
          
          return true; // Para o polling
        }
        
        return false; // Tentar novamente para outros erros
      }
    };
    
    // Primeira verificação imediata
    checkStatus();
    
    // Polling mais rápido (1.5 segundos) para melhor responsividade
    const interval = setInterval(checkStatus, 1500);
    
    setPollInterval(interval);
  };

  const retryConnection = () => {
    if (selectedConnection) {
      connectInstance(selectedConnection);
    }
  };

  const disconnectInstance = async (connection: Connection) => {
    try {
      setIsDisconnecting(true);
      
      // Detectar provider e usar a edge function correta
      const isZapi = connection.provider?.provider === 'zapi';
      
      if (isZapi) {
        console.log('🔌 Desconectando instância Z-API:', connection.instance_name);
        
        const { data, error } = await supabase.functions.invoke('disconnect-zapi', {
          body: { connectionId: connection.id }
        });

        if (error) throw error;

        if (!data.success) {
          throw new Error(data.error || 'Erro ao desconectar Z-API');
        }

        toast({
          title: 'Sucesso',
          description: data.message || 'Instância Z-API desconectada com sucesso!',
        });
      } else {
        console.log('🔌 Desconectando instância Evolution:', connection.instance_name);
        
        // Use the dedicated disconnect function for Evolution
        await evolutionProvider.pauseInstance(connection.id);

        toast({
          title: 'Sucesso',
          description: 'Instância Evolution desconectada com sucesso!',
        });
      }
      
      // Reload connections to show updated status
      loadConnections();

    } catch (error) {
      console.error('Error disconnecting instance:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao desconectar instância',
        variant: 'destructive',
      });
      loadConnections();
    } finally {
      setIsDisconnecting(false);
    }
  };

  const configureWebhook = async (connection: Connection) => {
    try {
      setIsDisconnecting(true); // Reuse loading state
      
      console.log('🔧 Configuring webhook for connection:', connection.instance_name);
      
      const { data, error } = await supabase.functions.invoke('configure-evolution-webhook', {
        body: {
          instance_name: connection.instance_name,
          workspace_id: workspaceId
        }
      });

      if (error) {
        console.error('Error configuring webhook:', error);
        toast({
          title: 'Erro',
          description: 'Erro ao configurar webhook',
          variant: 'destructive',
        });
        return;
      }

      // Webhook configured
      
      toast({
        title: 'Sucesso',
        description: 'Webhook configurado com sucesso! Agora você receberá mensagens.',
      });
      
      // Reload connections to show updated webhook status
      loadConnections();

    } catch (error) {
      console.error('Error configuring webhook:', error);
      toast({
        title: 'Erro',
        description: `Erro ao configurar webhook: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        variant: 'destructive',
      });
    } finally {
      setIsDisconnecting(false);
    }
  };

  const setDefaultConnection = async (connection: Connection) => {
    try {
      setIsSettingDefault(true);
      
      // Get user data for headers (same pattern as EvolutionProvider)
      const userData = localStorage.getItem('currentUser');
      const currentUserData = userData ? JSON.parse(userData) : null;
      
      if (!currentUserData?.id) {
        throw new Error('Usuário não autenticado');
      }

      const headers = {
        'x-system-user-id': currentUserData.id,
        'x-system-user-email': currentUserData.email || '',
        'x-workspace-id': workspaceId
      };
      
      const { data, error } = await supabase.functions.invoke('set-default-instance', {
        body: { connectionId: connection.id },
        headers
      });

      if (error) {
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to set default connection');
      }

      toast({
        title: 'Sucesso',
        description: data.message || `${connection.instance_name} definida como conexão padrão`,
      });
      
      // Reload connections to update UI
      loadConnections();
      
    } catch (error) {
      console.error('Error setting default connection:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao definir conexão padrão',
        variant: 'destructive',
      });
    } finally {
      setIsSettingDefault(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge variant="default" className="bg-green-500">Conectado</Badge>;
      case 'qr':
        return <Badge variant="secondary">QR Code</Badge>;
      case 'connecting':
        return <Badge variant="outline">Conectando</Badge>;
      case 'disconnected':
        return <Badge variant="destructive">Desconectado</Badge>;
      case 'creating':
        return <Badge variant="secondary">Criando</Badge>;
      case 'error':
        return <Badge variant="destructive">Erro</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando conexões...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Conexões WhatsApp</h2>
          <p className="text-muted-foreground">
            Gerencie suas instâncias de WhatsApp
          </p>
        </div>
        
        <div className="flex gap-2">
          <TestWebhookReceptionModal />
        </div>
        
        <Dialog open={isCreateModalOpen} onOpenChange={(open) => {
          if (!open) resetModal();
          setIsCreateModalOpen(open);
        }}>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="inline-block">
                  <DialogTrigger asChild>
                    <Button 
                      disabled={
                        !canCreateConnections(workspaceId) || 
                        !usage?.canCreateMore
                      }
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar Conexão
                    </Button>
                  </DialogTrigger>
                </div>
              </TooltipTrigger>
              {(!canCreateConnections(workspaceId) || !usage?.canCreateMore) && (
                <TooltipContent>
                  <p>
                    {!canCreateConnections(workspaceId) 
                      ? 'Você não tem permissão para criar conexões' 
                      : `Seu Limite de Conexões é ${usage?.limit || 1}`
                    }
                  </p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
          <DialogContent className="max-w-4xl p-0">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">
                {isEditMode ? 'Editar Instância' : 'Adicionar Canal de Atendimento'}
              </h2>
            </div>

            {/* Stepper */}
            <div className="px-6 pt-6">
              <div className="flex items-center justify-center mb-6">
                <div className="flex items-center">
                  {/* Step 1 */}
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                      1
                    </div>
                    <span className="ml-2 text-sm text-foreground">Configuração</span>
                  </div>
                  
                  {/* Connector */}
                  <div className="w-12 h-px bg-border mx-4"></div>
                  
                  {/* Step 2 */}
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full border-2 border-border text-muted-foreground flex items-center justify-center text-sm">
                      2
                    </div>
                    <span className="ml-2 text-sm text-muted-foreground">Finalização</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Form Content - Layout Horizontal */}
            <div className="flex px-6 space-x-8">
              {/* Primeira Coluna */}
              <div className="flex-1 space-y-4">
                {!isEditMode && (
                  <div className="p-3 bg-muted/50 rounded-lg border">
                    <div className="text-sm text-muted-foreground">
                      {usage === null ? (
                        'Carregando limites...'
                      ) : (
                        <>
                          Conexões: {usage.current}/{usage.limit}
                          {usage.current >= usage.limit && (
                            <span className="text-destructive font-medium ml-1">- Limite atingido</span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}

                {!isEditMode && (
                  <div className="p-3 bg-muted/50 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${selectedProvider === 'zapi' ? 'bg-purple-500' : 'bg-blue-500'}`}></div>
                      <span className="text-sm font-medium text-foreground">
                        Provider: {selectedProvider === 'zapi' ? 'Z-API' : 'Evolution API'}
                      </span>
                      {loadingProvider && (
                        <span className="text-xs text-muted-foreground">(carregando...)</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Definido nas configurações do workspace
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="instanceName" className="text-sm font-medium text-foreground">
                    Nome *
                  </Label>
                  <Input
                    id="instanceName"
                    value={instanceName}
                    onChange={(e) => setInstanceName(e.target.value)}
                    placeholder="Digite o nome da instância"
                    disabled={isEditMode}
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phoneNumber" className="text-sm font-medium text-foreground">
                    Número do WhatsApp
                  </Label>
                  <Input
                    id="phoneNumber"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="Ex: 5511999999999"
                    type="tel"
                    className="h-11"
                  />
                  <p className="text-xs text-muted-foreground">
                  Formato: 55 + DDD + número (será normalizado automaticamente)
                </p>
              </div>

              <div className="space-y-2">
                  <Label htmlFor="queue" className="text-sm font-medium text-foreground">
                    Fila (Opcional)
                  </Label>
                  <Select value={selectedQueueId} onValueChange={setSelectedQueueId}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Nenhuma fila" />
                    </SelectTrigger>
                    <SelectContent>
                      {queues.map((queue) => (
                        <SelectItem key={queue.id} value={queue.id}>
                          {queue.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    As novas conversas seguirão as regras da fila selecionada
                  </p>
                </div>
              </div>

              {/* Segunda Coluna */}
              <div className="flex-1 space-y-4">
                {/* Toggle Switches */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium text-foreground">
                        Criar card no CRM automaticamente
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Cria automaticamente um card no pipeline selecionado
                      </p>
                    </div>
                    <Switch checked={createCrmCard} onCheckedChange={setCreateCrmCard} />
                  </div>

                  {createCrmCard && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="pipeline" className="text-sm font-medium text-foreground">
                          Selecionar Pipeline
                        </Label>
                        {loadingPipelines ? (
                          <div className="flex items-center gap-2 p-3 border border-border rounded-md bg-muted/30">
                            <span className="text-sm text-muted-foreground">
                              Carregando pipelines...
                            </span>
                          </div>
                        ) : workspacePipelines.length > 0 ? (
                          <Select value={selectedPipeline} onValueChange={setSelectedPipeline}>
                            <SelectTrigger className="h-11">
                              <SelectValue placeholder="Selecionar Pipeline" />
                            </SelectTrigger>
                            <SelectContent>
                              {workspacePipelines.map((pipeline) => (
                                <SelectItem key={pipeline.id} value={pipeline.id}>
                                  {pipeline.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="flex items-center gap-2 p-3 border border-border rounded-md bg-muted/30">
                            <span className="text-sm text-muted-foreground flex-1">
                              Nenhum pipeline encontrado para esta empresa
                            </span>
                            {!isInMasterDashboard && (
                              <Button
                                asChild
                                variant="outline"
                                size="sm"
                                className="gap-1"
                              >
                                <Link to={getNavigationPath('/crm-negocios')}>
                                  Criar Pipeline
                                  <ArrowRight className="h-3 w-3" />
                                </Link>
                              </Button>
                            )}
                          </div>
                        )}
                      </div>

                      {selectedPipeline && (
                        <div className="space-y-2">
                          <Label htmlFor="column" className="text-sm font-medium text-foreground">
                            Coluna do Card
                          </Label>
                          
                          {loadingColumns ? (
                            <div className="flex items-center gap-2 p-3 border border-border rounded-md bg-muted/30">
                              <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">
                                Carregando colunas...
                              </span>
                            </div>
                          ) : pipelineColumns.length > 0 ? (
                            <>
                              <Select value={selectedColumn} onValueChange={setSelectedColumn}>
                                <SelectTrigger className="h-11">
                                  <SelectValue placeholder="Selecionar Coluna" />
                                </SelectTrigger>
                                <SelectContent>
                                  {pipelineColumns.map((column) => (
                                    <SelectItem key={column.id} value={column.id}>
                                      <div className="flex items-center gap-2">
                                        <div 
                                          className="w-3 h-3 rounded-full" 
                                          style={{ backgroundColor: column.color }}
                                        />
                                        {column.name}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-muted-foreground">
                                Cards serão criados nesta coluna
                              </p>
                            </>
                          ) : (
                            <div className="flex items-center gap-2 p-3 border border-border rounded-md bg-muted/30">
                              <span className="text-sm text-muted-foreground">
                                Nenhuma coluna encontrada para este pipeline
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}

                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div className="flex items-center justify-between p-6 border-t border-border mt-6">
              <Button variant="outline" disabled={isCreating}>
                Voltar
              </Button>
              <Button 
                onClick={isEditMode ? editConnection : () => createInstance()} 
                disabled={
                  isCreating || 
                  (!isEditMode && !usage?.canCreateMore)
                }
                title={
                  !isEditMode && !usage?.canCreateMore 
                    ? `Limite de conexões atingido (${usage?.current || 0}/${usage?.limit || 1})` 
                    : ''
                }
              >
                {isCreating ? (isEditMode ? 'Salvando...' : 'Criando...') : (isEditMode ? 'Salvar Alterações' : 'Adicionar')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {connections.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Wifi className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Nenhuma conexão encontrada</h3>
            <p className="text-muted-foreground text-center mb-6">
              Crie sua primeira conexão WhatsApp para começar a receber mensagens
            </p>
            <Button 
              onClick={() => setIsCreateModalOpen(true)}
              disabled={!usage?.canCreateMore}
              title={!usage?.canCreateMore ? `Limite de conexões atingido (${usage?.current || 0}/${usage?.limit || 1})` : ''}
            >
              <Plus className="w-4 h-4 mr-2" />
              {usage === null 
                ? 'Carregando...' 
                : `Adicionar Instância (${usage.current}/${usage.limit})`
              }
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {connections.map((connection) => (
            <Card 
              key={connection.id} 
              className="relative border-l-4"
              style={{ 
                borderLeftColor: getConnectionColor(connection.id, connection.metadata)
              }}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-medium">
                    {connection.instance_name}
                  </CardTitle>
                  {/* Provider Badge */}
                  {connection.provider?.provider === 'zapi' ? (
                    <Badge variant="outline" className="flex items-center gap-1 bg-blue-500/10 text-blue-600 border-blue-500/30">
                      <Zap className="w-3 h-3" />
                      Z-API
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="flex items-center gap-1 bg-purple-500/10 text-purple-600 border-purple-500/30">
                      <Cloud className="w-3 h-3" />
                      Evolution
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(connection.status)}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                     <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setDefaultConnection(connection)}>
                        <Star className="mr-2 h-4 w-4" />
                        Definir como Padrão
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openEditModal(connection)}>
                        <Edit3 className="mr-2 h-4 w-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => openDeleteModal(connection)}
                        className="text-destructive"
                       >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Excluir
                      </DropdownMenuItem>
                     </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground flex items-center justify-between">
                    <span>Número: {formatPhoneNumberDisplay(connection.phone_number || '')}</span>
                    {/* Star icon for default connection */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDefaultConnection(connection)}
                      disabled={isSettingDefault}
                      className="h-6 w-6 p-0"
                      title="Definir como conexão padrão"
                    >
                      <Star 
                        className={`w-3 h-3 transition-colors ${
                          connection.is_default 
                            ? 'fill-yellow-500 text-yellow-500' 
                            : 'text-muted-foreground'
                        }`} 
                      />
                    </Button>
                  </div>
                  
                  <div className="flex gap-2 flex-wrap">
                    {connection.status === 'connected' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => disconnectInstance(connection)}
                        disabled={isDisconnecting}
                        className="flex items-center gap-2 text-destructive hover:text-destructive-foreground hover:bg-destructive"
                      >
                        {isDisconnecting ? (
                          <>
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            Desconectando...
                          </>
                        ) : (
                          <>
                            <Wifi className="w-4 h-4" />
                            Desconectar
                          </>
                        )}
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => connectInstance(connection)}
                          disabled={isConnecting}
                          className="flex items-center gap-2"
                        >
                          {isConnecting && selectedConnection?.id === connection.id ? (
                            <>
                              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                              Conectando...
                            </>
                          ) : (
                            <>
                              <QrCode className="w-4 h-4" />
                              Conectar
                            </>
                          )}
                        </Button>
                        
                        {/* Botão de refresh QR para Z-API desconectado */}
                        {connection.provider?.provider === 'zapi' && 
                         (connection.status === 'disconnected' || connection.status === 'qr') && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => refreshQRCode(connection.id)}
                            disabled={isRefreshing}
                            className="flex items-center gap-2"
                            title="Atualizar QR Code Z-API"
                          >
                            {isRefreshing ? (
                              <>
                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                Atualizando...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="w-4 h-4" />
                                Atualizar QR
                              </>
                            )}
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* QR Code Modal */}
      <Dialog open={isQRModalOpen} onOpenChange={(open) => {
        if (!open) {
          // Clear all timers when modal closes
          if (pollInterval) {
            clearInterval(pollInterval);
            setPollInterval(null);
          }
          setSelectedConnection(null);
        }
        setIsQRModalOpen(open);
      }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-primary mb-2">
              Passos para conectar
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 py-4">
            {/* Instruções à esquerda */}
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-semibold text-sm">
                  1
                </div>
                <div>
                  <p className="font-medium">Abra o <strong>WhatsApp</strong> no seu celular</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-semibold text-sm">
                  2
                </div>
                <div>
                  <p className="font-medium">No Android toque em <strong>Menu</strong> : ou no iPhone em <strong>Ajustes</strong></p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-semibold text-sm">
                  3
                </div>
                <div>
                  <p className="font-medium">Toque em <strong>Dispositivos conectados</strong> e depois <strong>Conectar um dispositivo</strong></p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-semibold text-sm">
                  4
                </div>
                <div>
                  <p className="font-medium">Escaneie o QR Code à direita para confirmar</p>
                </div>
              </div>

              {/* Botão para atualizar QR Code */}
              <div className="pt-4">
                <Button 
                  onClick={() => selectedConnection && refreshQRCode(selectedConnection.id)}
                  variant="outline" 
                  size="sm"
                  disabled={isRefreshing}
                  className="w-full"
                >
                  {isRefreshing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                      Atualizando QR Code...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Atualizar QR Code
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* QR Code à direita */}
            <div className="flex items-center justify-center">
              {selectedConnection?.qr_code ? (
                <div className="text-center space-y-4">
                  <img 
                    src={selectedConnection.qr_code.replace(/^data:image\/png;base64,data:image\/png;base64,/, 'data:image/png;base64,')} 
                    alt="QR Code" 
                    className="mx-auto border border-border rounded-lg bg-white p-4"
                    style={{ width: '280px', height: '280px' }}
                  />
                  <p className="text-sm text-muted-foreground font-medium">
                    {selectedConnection.instance_name}
                  </p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Gerando QR Code...</p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <AlertDialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a instância "{connectionToDelete?.instance_name}"? 
              Esta ação não pode ser desfeita e todos os dados associados serão perdidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={removeConnection}
              disabled={isDisconnecting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDisconnecting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}