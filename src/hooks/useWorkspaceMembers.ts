import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/hooks/useAuth';

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: 'user' | 'admin' | 'master';
  is_hidden: boolean;
  created_at: string;
  user?: {
    id: string;
    name: string;
    email: string;
    profile: string;
    phone?: string;
    status?: string;
    cargo_names?: string[];
    avatar?: string;
  };
}

export function useWorkspaceMembers(workspaceId?: string) {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const getRequestHeaders = () => {
    const headers: Record<string, string> = {};
    if (user?.id) {
      headers['x-system-user-id'] = user.id;
    }
    if (user?.email) {
      headers['x-system-user-email'] = user.email;
    }
    return headers;
  };

  const fetchMembers = async () => {
    if (!workspaceId) {
      setMembers([]);
      return;
    }
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-workspace-members', {
        body: {
          action: 'list',
          workspaceId
        },
        headers: getRequestHeaders()
      });

      if (error) {
        console.error('Error calling manage-workspace-members function:', error);
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch members');
      }

      setMembers(data.members || []);
    } catch (error: any) {
      console.error('Error in fetchMembers:', error);
      setMembers([]);
      
      const errorMessage = error?.message || "Erro ao carregar membros do workspace.";
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [workspaceId]);

  const addMember = async (userId: string, role: 'user' | 'admin' | 'master') => {
    if (!workspaceId) return;

    try {
      const { data, error } = await supabase.functions.invoke('manage-workspace-members', {
        body: {
          action: 'add',
          workspaceId,
          userId,
          role
        },
        headers: getRequestHeaders()
      });

      if (error) {
        console.error('Error calling manage-workspace-members function:', error);
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to add member');
      }

      toast({
        title: "Sucesso",
        description: "Membro adicionado ao workspace com sucesso.",
      });

      // Refresh the members list
      await fetchMembers();
    } catch (error: any) {
      console.error('Error in addMember:', error);
      
      const errorMessage = error?.message || "Erro ao adicionar membro ao workspace.";
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const createUserAndAddToWorkspace = async (
    userData: {
      name: string;
      email: string;
      profile: string;
      senha: string;
      default_channel?: string;
      phone?: string;
      cargo_ids?: string[];
    },
    role: 'user' | 'admin' | 'master'
  ) => {
    if (!workspaceId) return;

    try {
      // Create user via edge function
      const { data: createResponse, error: createError } = await supabase.functions.invoke('manage-system-user', {
        body: {
          action: 'create',
          userData: userData
        }
      });

      if (createError) {
        throw createError;
      }

      if (!createResponse.success) {
        throw new Error(createResponse.error || 'Falha ao criar usuário');
      }

      const newUserId = createResponse.data.id;

      // Add user to workspace via edge function to handle RLS
      const { data: memberResponse, error: memberError } = await supabase.functions.invoke('manage-workspace-members', {
        body: {
          action: 'add',
          workspaceId: workspaceId,
          userId: newUserId,
          role: role
        },
        headers: getRequestHeaders()
      });

      if (memberError) {
        throw memberError;
      }

      if (!memberResponse.success) {
        throw new Error(memberResponse.error || 'Falha ao adicionar membro ao workspace');
      }

      fetchMembers();
      return memberResponse.member;
    } catch (error: any) {
      console.error('Error creating user and adding to workspace:', error);
      
      let errorMessage = "Falha ao criar usuário e adicionar ao workspace";
      
      // Check for specific error messages
      if (error.message?.includes('duplicate key') || error.message?.includes('already exists')) {
        errorMessage = "Este email já está sendo usado por outro usuário";
      } else if (error.message?.includes('invalid email')) {
        errorMessage = "Email inválido";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive"
      });
      throw error;
    }
  };

  const updateMember = async (memberId: string, updates: { role?: 'user' | 'admin' | 'master'; is_hidden?: boolean }) => {
    if (!workspaceId) return;

    try {
      const { data, error } = await supabase.functions.invoke('manage-workspace-members', {
        body: {
          action: 'update',
          workspaceId,
          memberId,
          updates
        },
        headers: getRequestHeaders()
      });

      if (error) {
        console.error('Error calling manage-workspace-members function:', error);
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to update member');
      }

      toast({
        title: "Sucesso",
        description: "Membro atualizado com sucesso.",
      });

      // Refresh the members list
      await fetchMembers();
    } catch (error: any) {
      console.error('Error in updateMember:', error);
      
      const errorMessage = error?.message || "Erro ao atualizar membro.";
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const updateUser = async (userId: string, userData: {
    name?: string;
    email?: string;
    profile?: string;
    senha?: string;
    phone?: string;
    default_channel?: string;
  }) => {
    try {
      const { data, error } = await supabase.functions.invoke('manage-system-user', {
        body: {
          action: 'update',
          userId,
          userData
        }
      });

      if (error) {
        console.error('Error calling manage-system-user function:', error);
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to update user');
      }

      toast({
        title: "Sucesso",
        description: "Usuário atualizado com sucesso.",
      });

      // Refresh the members list to show updated data
      await fetchMembers();
    } catch (error) {
      console.error('Error in updateUser:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar usuário.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const removeMember = async (memberId: string) => {
    if (!workspaceId) return;

    try {
      const { data, error } = await supabase.functions.invoke('manage-workspace-members', {
        body: {
          action: 'remove',
          workspaceId,
          memberId
        },
        headers: getRequestHeaders()
      });

      if (error) {
        console.error('Error calling manage-workspace-members function:', error);
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to remove member');
      }

      toast({
        title: "Sucesso",
        description: "Membro removido do workspace com sucesso.",
      });

      // Refresh the members list
      await fetchMembers();
    } catch (error: any) {
      console.error('Error in removeMember:', error);
      
      const errorMessage = error?.message || "Erro ao remover membro do workspace.";
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  return {
    members,
    isLoading,
    fetchMembers,
    addMember,
    createUserAndAddToWorkspace,
    updateMember,
    updateUser,
    removeMember
  };
}