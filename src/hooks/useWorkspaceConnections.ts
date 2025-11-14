import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface WorkspaceConnection {
  id: string;
  instance_name: string;
  phone_number?: string;
  status: string;
}

export const useWorkspaceConnections = (workspaceId?: string) => {
  const [connections, setConnections] = useState<WorkspaceConnection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pollingEnabled, setPollingEnabled] = useState(true);

  const fetchConnections = async () => {
    if (!workspaceId) return;
    
    setIsLoading(true);
    try {
      // First, try direct query to connections table
      const { data, error } = await supabase
        .from('connections')
        .select('id, instance_name, phone_number, status')
        .eq('workspace_id', workspaceId)
        .order('instance_name');

      if (error || !data || data.length === 0) {
        // Fallback to edge function silently
        try {
          // Get user data for headers
          const userData = localStorage.getItem('currentUser');
          const currentUserData = userData ? JSON.parse(userData) : null;
          
          if (!currentUserData?.id) {
            setConnections([]);
            return;
          }

          const { data: functionData, error: functionError } = await supabase.functions.invoke('evolution-list-connections', {
            body: { workspaceId },
            headers: {
              'x-system-user-id': currentUserData.id,
              'x-system-user-email': currentUserData.email || '',
              'x-workspace-id': workspaceId
            }
          });

          if (functionError) {
            // Silently fail - Evolution API not configured
            setConnections([]);
            return;
          }

          if (functionData?.success && functionData.connections) {
            setConnections(functionData.connections.map((conn: any) => ({
              id: conn.id,
              instance_name: conn.instance_name,
              phone_number: conn.phone_number,
              status: conn.status
            })));
          } else {
            setConnections([]);
          }
        } catch (fallbackError) {
          // Silently fail - Evolution API not configured or other network issues
          setConnections([]);
        }
      } else {
        setConnections(data || []);
      }
    } catch (error) {
      // Only log serious errors, not configuration issues
      console.error('Error fetching connections:', error);
      setConnections([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, [workspaceId]);

  // Polling automático a cada 5 segundos para atualizar status das conexões
  useEffect(() => {
    if (!workspaceId || !pollingEnabled) return;

    const interval = setInterval(() => {
      fetchConnections();
    }, 5000); // 5 segundos

    return () => clearInterval(interval);
  }, [workspaceId, pollingEnabled]);

  return {
    connections,
    isLoading,
    fetchConnections,
    setPollingEnabled,
  };
};