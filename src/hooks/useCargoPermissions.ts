import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

interface CargoPermissions {
  [moduleId: string]: {
    ver?: boolean;
    criar?: boolean;
    editar?: boolean;
    deletar?: boolean;
  };
}

export const useCargoPermissions = () => {
  const { user, userRole } = useAuth();
  const [permissions, setPermissions] = useState<CargoPermissions>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPermissions = async () => {
      // Master/Admin têm acesso total
      if (userRole === 'master' || userRole === 'admin') {
        setLoading(false);
        return;
      }

      // Carregar permissões do cargo do usuário
      if (user?.cargo_id) {
        const { data, error } = await supabase
          .from('cargos')
          .select('permissions')
          .eq('id', user.cargo_id)
          .single();

        if (data && !error) {
          setPermissions((data.permissions as CargoPermissions) || {});
        }
      }
      setLoading(false);
    };

    loadPermissions();
  }, [user?.cargo_id, userRole]);

  // Funções de verificação
  const canView = (moduleId: string): boolean => {
    if (userRole === 'master' || userRole === 'admin') return true;
    return permissions[moduleId]?.ver === true;
  };

  const canCreate = (moduleId: string): boolean => {
    if (userRole === 'master' || userRole === 'admin') return true;
    return permissions[moduleId]?.criar === true;
  };

  const canEdit = (moduleId: string): boolean => {
    if (userRole === 'master' || userRole === 'admin') return true;
    return permissions[moduleId]?.editar === true;
  };

  const canDelete = (moduleId: string): boolean => {
    if (userRole === 'master' || userRole === 'admin') return true;
    return permissions[moduleId]?.deletar === true;
  };

  const canViewAnyIn = (moduleIds: string[]): boolean => {
    if (userRole === 'master' || userRole === 'admin') return true;
    return moduleIds.some(id => canView(id));
  };

  return {
    permissions,
    loading,
    canView,
    canCreate,
    canEdit,
    canDelete,
    canViewAnyIn
  };
};
