import { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  profile: string;
  status: string;
  avatar?: string;
  cargo_id?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  userRole: 'master' | 'admin' | 'user' | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  hasRole: (roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const mapProfileToRole = (profile: string): 'master' | 'admin' | 'user' => {
  switch (profile) {
    case 'master':
      return 'master';
    case 'admin':
      return 'admin';
    default:
      return 'user';
  }
};

export const useAuthState = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [userRole, setUserRole] = useState<'master' | 'admin' | 'user' | null>(null);
  const [loading, setLoading] = useState(true);

  // Load user from localStorage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        setUserRole(mapProfileToRole(parsedUser.profile));
      } catch (error) {
        console.error('Error parsing saved user:', error);
        localStorage.removeItem('currentUser');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      // Validar credenciais via sistema customizado
      const { data, error } = await supabase.functions.invoke('get-system-user', {
        body: { email, password }
      });

      if (error || !data.user) {
        return { error: 'Email ou senha inválidos' };
      }

      const user = data.user;
      
      // Criar uma sessão Supabase para permitir checagens no servidor
      try {
        const supabaseEmail = `${user.id}@tezeus.app`;
        
        // Primeiro tenta fazer signUp (cria conta se não existir)
        const { error: signUpError } = await supabase.auth.signUp({
          email: supabaseEmail,
          password: user.id,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              system_user_id: user.id,
              system_email: user.email,
              system_name: user.name,
              system_profile: user.profile
            }
          }
        });
        
        // Se usuário já existe ou criou com sucesso, fazer signIn
        if (!signUpError || signUpError.message.includes('already registered')) {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: supabaseEmail,
            password: user.id
          });
          
          if (signInError) {
            console.log('Info: Erro no signIn Supabase:', signInError.message);
          } else {
            console.log('Sessão Supabase ativa para chamadas autenticadas');
            
            // Ensure user metadata is updated after login
            try {
              await supabase.auth.updateUser({
                data: {
                  system_user_id: user.id,
                  system_email: user.email,
                  system_name: user.name,
                  system_profile: user.profile
                }
              });
              console.log('User metadata updated successfully');
            } catch (metadataError) {
              console.log('Info: Erro ao atualizar metadata (ignorado):', metadataError);
            }
          }
        }
      } catch (authError) {
        console.log('Info: Erro na autenticação Supabase (ignorado):', authError);
      }

      // Definir dados do usuário no estado local
      setUser(user);
      localStorage.setItem('currentUser', JSON.stringify(user));
      
      // Set user role based on profile
      setUserRole(mapProfileToRole(user.profile));

      return {};
    } catch (error) {
      console.error('Login error:', error);
      return { error: 'Erro interno do servidor' };
    }
  };

  const logout = async () => {
    setUser(null);
    setUserRole(null);
    localStorage.removeItem('currentUser');
    localStorage.removeItem('selectedWorkspace');
    
    // Também fazer logout do Supabase Auth
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.log('Erro ao fazer logout do Supabase:', error);
    }
  };

  const hasRole = (roles: string[]) => {
    if (!userRole) return false;
    return roles.includes(userRole);
  };

  return {
    user,
    userRole,
    loading,
    login,
    logout,
    hasRole
  };
};

export { AuthContext };