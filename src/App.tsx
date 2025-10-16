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
            {/* ========== ROTAS MASTER (via Visualizar Empresa) ========== */}
            <Route path="/workspace/:workspaceId/dashboard" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/workspace/:workspaceId/conversas" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/workspace/:workspaceId/ds-voice" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/workspace/:workspaceId/crm-negocios" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/workspace/:workspaceId/crm-ligacoes" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/workspace/:workspaceId/crm-contatos" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/workspace/:workspaceId/crm-tags" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/workspace/:workspaceId/crm-produtos" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/workspace/:workspaceId/automacoes-agente" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/workspace/:workspaceId/automacoes-bot" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/workspace/:workspaceId/automacoes-integracoes" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/workspace/:workspaceId/automacoes-filas" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/workspace/:workspaceId/automacoes-api" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/workspace/:workspaceId/parceiros-planos" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/workspace/:workspaceId/workspace-relatorios" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/workspace/:workspaceId/editar-agente/:agentId" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            
            {/* ========== ROTAS NORMAIS (Admin/User) ========== */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/conversas" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/ds-voice" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/crm-negocios" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/crm-ligacoes" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/crm-contatos" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/crm-tags" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/crm-produtos" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/automacoes-agente" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/automacoes-bot" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/automacoes-integracoes" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/automacoes-filas" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/automacoes-api" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/parceiros-planos" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/workspace-relatorios" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/editar-agente/:agentId" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            
            {/* Rotas que Master pode acessar diretamente */}
            <Route path="/parceiros-clientes" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
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
