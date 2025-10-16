import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { TezeusCRM } from "@/components/TezeusCRM";
import NotFound from "./pages/NotFound";
import { AuthProvider } from "./components/AuthProvider";
import { WorkspaceProvider } from "./contexts/WorkspaceContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { RoleProtectedRoute } from "./components/RoleProtectedRoute";
import { Login } from "./pages/Login";
import MasterDashboard from "./pages/MasterDashboard";
import { SystemCustomizationProvider } from "./contexts/SystemCustomizationContext";
import { RealtimeNotificationProvider } from "./components/RealtimeNotificationProvider";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <SystemCustomizationProvider>
          <WorkspaceProvider>
            <RealtimeNotificationProvider>
              <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/master-dashboard" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master']}>
                  <MasterDashboard />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/dashboard" element={<ProtectedRoute><TezeusCRM /></ProtectedRoute>} />
            <Route path="/conversas" element={<ProtectedRoute><TezeusCRM /></ProtectedRoute>} />
            <Route path="/ds-voice" element={<ProtectedRoute><TezeusCRM /></ProtectedRoute>} />
            <Route path="/crm-negocios" element={<ProtectedRoute><TezeusCRM /></ProtectedRoute>} />
            <Route path="/crm-ligacoes" element={<ProtectedRoute><TezeusCRM /></ProtectedRoute>} />
            <Route path="/crm-contatos" element={<ProtectedRoute><TezeusCRM /></ProtectedRoute>} />
            <Route path="/crm-tags" element={<ProtectedRoute><TezeusCRM /></ProtectedRoute>} />
            <Route path="/crm-produtos" element={<ProtectedRoute><TezeusCRM /></ProtectedRoute>} />
            
            <Route path="/automacoes-agente" element={<ProtectedRoute><TezeusCRM /></ProtectedRoute>} />
            <Route path="/automacoes-bot" element={<ProtectedRoute><TezeusCRM /></ProtectedRoute>} />
            <Route path="/automacoes-integracoes" element={<ProtectedRoute><TezeusCRM /></ProtectedRoute>} />
            <Route path="/automacoes-filas" element={<ProtectedRoute><TezeusCRM /></ProtectedRoute>} />
            <Route path="/automacoes-api" element={<ProtectedRoute><TezeusCRM /></ProtectedRoute>} />
            <Route path="/parceiros-clientes" element={<ProtectedRoute><RoleProtectedRoute allowedRoles={['master']}><TezeusCRM /></RoleProtectedRoute></ProtectedRoute>} />
            <Route path="/parceiros-planos" element={<ProtectedRoute><TezeusCRM /></ProtectedRoute>} />
            <Route path="/conexoes" element={<ProtectedRoute><RoleProtectedRoute allowedRoles={['master', 'admin']}><TezeusCRM /></RoleProtectedRoute></ProtectedRoute>} />
            <Route path="/administracao-usuarios" element={<ProtectedRoute><RoleProtectedRoute allowedRoles={['master']}><TezeusCRM /></RoleProtectedRoute></ProtectedRoute>} />
            <Route path="/administracao-financeiro" element={<ProtectedRoute><RoleProtectedRoute allowedRoles={['master']}><TezeusCRM /></RoleProtectedRoute></ProtectedRoute>} />
            <Route path="/administracao-configuracoes" element={<ProtectedRoute><RoleProtectedRoute allowedRoles={['master']}><TezeusCRM /></RoleProtectedRoute></ProtectedRoute>} />
            <Route path="/administracao-dashboard" element={<ProtectedRoute><RoleProtectedRoute allowedRoles={['master']}><TezeusCRM /></RoleProtectedRoute></ProtectedRoute>} />
            <Route path="/workspace-empresas" element={<ProtectedRoute><RoleProtectedRoute allowedRoles={['master', 'admin']}><TezeusCRM /></RoleProtectedRoute></ProtectedRoute>} />
            <Route path="/workspace-empresas/:workspaceId/usuarios" element={<ProtectedRoute><RoleProtectedRoute allowedRoles={['master', 'admin']}><TezeusCRM /></RoleProtectedRoute></ProtectedRoute>} />
            <Route path="/workspace-relatorios" element={<ProtectedRoute><TezeusCRM /></ProtectedRoute>} />
            <Route path="/editar-agente/:agentId" element={<ProtectedRoute><TezeusCRM /></ProtectedRoute>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
            </BrowserRouter>
            </RealtimeNotificationProvider>
          </WorkspaceProvider>
        </SystemCustomizationProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
