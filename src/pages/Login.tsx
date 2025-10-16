import { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  
  const { user, userRole, login } = useAuth();
  const navigate = useNavigate();

  // Redirecionar após login bem-sucedido baseado na role
  useEffect(() => {
    if (loginSuccess && user && userRole) {
      if (userRole === 'master') {
        // Master SEMPRE vai para master-dashboard após login
        navigate('/master-dashboard');
      } else {
        navigate('/dashboard');
      }
    }
  }, [loginSuccess, user, userRole, navigate]);

  // Redirect if already logged in
  if (user && !loading) {
    if (userRole === 'master') {
      // Master SEMPRE vai para master-dashboard
      return <Navigate to="/master-dashboard" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({
        title: "Erro",
        description: "Por favor, preencha todos os campos",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    
    try {
      const result = await login(email, password);
      
      if (result.error) {
        toast({
          title: "Erro no login",
          description: result.error,
          variant: "destructive"
        });
      } else {
        // ✅ NOVO: Para Admin/User, buscar e salvar workspace ANTES de redirecionar
        // result só retorna vazio {} se sucesso, precisa pegar user do localStorage
        const savedUser = localStorage.getItem('currentUser');
        
        if (savedUser) {
          try {
            const parsedUser = JSON.parse(savedUser);
            const role = parsedUser.profile === 'master' ? 'master' : (parsedUser.profile === 'admin' ? 'admin' : 'user');
            
            if (role !== 'master') {
              console.log('🔐 Login: Buscando workspace para Admin/User...');
              try {
                const { data } = await supabase.functions.invoke('list-user-workspaces', {
                  headers: {
                    'x-system-user-id': parsedUser.id,
                    'x-system-user-email': parsedUser.email || ''
                  }
                });
                
                if (data?.workspaces && data.workspaces.length > 0) {
                  const userWorkspace = {
                    workspace_id: data.workspaces[0].workspace_id || data.workspaces[0].id,
                    name: data.workspaces[0].name,
                    slug: data.workspaces[0].slug,
                    cnpj: data.workspaces[0].cnpj,
                    created_at: data.workspaces[0].created_at,
                    updated_at: data.workspaces[0].updated_at,
                    connections_count: data.workspaces[0].connections_count || 0
                  };
                  
                  localStorage.setItem('selectedWorkspace', JSON.stringify(userWorkspace));
                  console.log('✅ Login: Workspace salvo no localStorage:', userWorkspace.name);
                } else {
                  console.warn('⚠️ Login: Nenhum workspace encontrado para o usuário');
                }
              } catch (wsError) {
                console.error('❌ Login: Erro ao buscar workspace:', wsError);
                // Não bloquear login por erro ao buscar workspace
              }
            }
          } catch (parseError) {
            console.error('❌ Login: Erro ao parsear usuário salvo:', parseError);
          }
        }
        
        toast({
          title: "Login realizado com sucesso!",
          description: "Redirecionando...",
        });
        setLoginSuccess(true);
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro interno do servidor",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            Tezeus CRM
          </CardTitle>
          <p className="text-muted-foreground">
            Faça login para acessar o sistema
          </p>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Entrando...
                </div>
              ) : (
                <>
                  <LogIn className="h-4 w-4 mr-2" />
                  Entrar
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};