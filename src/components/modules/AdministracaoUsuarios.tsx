import { useState, useEffect } from "react";
import { Search, Edit, Pause, Trash2, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdicionarEditarUsuarioModal } from "@/components/modals/AdicionarEditarUsuarioModal";
import { PausarUsuarioModal } from "@/components/modals/PausarUsuarioModal";
import { DeletarUsuarioModal } from "@/components/modals/DeletarUsuarioModal";
import { AdministracaoCargos } from "./AdministracaoCargos";
import { useSystemUsers, type SystemUser } from "@/hooks/useSystemUsers";
export function AdministracaoUsuarios() {
  const { loading, listUsers, createUser, updateUser, deleteUser } = useSystemUsers();
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [isPauseModalOpen, setIsPauseModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SystemUser | undefined>(undefined);
  const [showCargos, setShowCargos] = useState(false);

  const refreshUsers = async () => {
    const result = await listUsers();
    if (result.data) {
      setUsers(result.data);
    }
  };

  useEffect(() => {
    refreshUsers();
  }, []);
  const filteredUsers = users.filter(user => user.name.toLowerCase().includes(searchTerm.toLowerCase()) || user.email.toLowerCase().includes(searchTerm.toLowerCase()));
  const handleEditUser = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (user) {
      setEditingUser(user);
      setIsAddEditModalOpen(true);
    }
  };
  const handlePauseUser = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (user) {
      setSelectedUser(user);
      setIsPauseModalOpen(true);
    }
  };
  const handleConfirmPause = (pauseOptions: {
    pauseConversations: boolean;
    pauseCalls: boolean;
  }) => {
    console.log("Pausar usuário com opções:", pauseOptions, selectedUser?.id);
    // TODO: Implementar lógica de pausa
    setIsPauseModalOpen(false);
    setSelectedUser(undefined);
  };
  const handleDeleteUser = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (user) {
      setSelectedUser(user);
      setIsDeleteModalOpen(true);
    }
  };
  const handleConfirmDelete = async () => {
    if (selectedUser) {
      const result = await deleteUser(selectedUser.id);
      if (result.success) {
        await refreshUsers();
      }
    }
    setIsDeleteModalOpen(false);
    setSelectedUser(undefined);
  };

  const handleAddUser = () => {
    setEditingUser(null);
    setIsAddEditModalOpen(true);
  };
  const handleModalSuccess = () => {
    refreshUsers();
    setIsAddEditModalOpen(false);
    setEditingUser(null);
  };
  const handleGerenciarCargos = () => {
    setShowCargos(true);
  };
  const handleBackFromCargos = () => {
    setShowCargos(false);
  };
  if (showCargos) {
    return <AdministracaoCargos onBack={handleBackFromCargos} />;
  }
  return <div className="p-6 space-y-6">
      {/* Header com título, pesquisa e botões */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-foreground">Usuários</h1>
        
        <div className="flex items-center gap-3">
          {/* Campo de pesquisa */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input placeholder="Pesquisar usuários..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 w-64" />
          </div>

          {/* Botão Gerenciar cargos */}
          <Button variant="outline" onClick={handleGerenciarCargos} className="border-brand-yellow text-brand-yellow hover:bg-brand-yellow/10">
            Gerenciar cargos
          </Button>

          {/* Botão Adicionar usuário */}
          <Button variant="yellow" onClick={handleAddUser} className="gap-2 rounded-xl">
            <Plus className="h-4 w-4" />
            Adicionar usuário
          </Button>
        </div>
      </div>

      {/* Tabela de usuários */}
      <div className="border border-border rounded-lg bg-white">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border">
              <TableHead className="text-foreground font-medium text-center">Nome</TableHead>
              <TableHead className="text-foreground font-medium">Email</TableHead>
              <TableHead className="text-foreground font-medium">Perfil</TableHead>
              <TableHead className="text-foreground font-medium">Cargo</TableHead>
              <TableHead className="text-foreground font-medium">Empresa</TableHead>
              <TableHead className="text-foreground font-medium">Status</TableHead>
              <TableHead className="text-foreground font-medium text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map(user => <TableRow key={user.id} className="border-b border-border hover:bg-muted/50">
                <TableCell className="text-center">
                  <span className="text-foreground font-medium">
                    {user.name}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {user.email}
                </TableCell>
                <TableCell>
                 <span className="text-foreground capitalize">
                    {user.profile}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {user.cargo_names && user.cargo_names.length > 0 ? (
                      user.cargo_names.map((cargoName, index) => (
                        <Badge 
                          key={index} 
                          variant="outline"
                          className="text-xs"
                        >
                          {cargoName}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </div>
                </TableCell>
               <TableCell>
                <span className="text-foreground">
                   {user.profile === 'master' ? 'Todas' : (user.empresa || (user.workspaces?.map(w => w.name).join(", ") || "-"))} 
                  </span>
            </TableCell>
                <TableCell>
                  <Badge 
                    variant={user.status === 'active' ? 'secondary' : 'outline'} 
                    className={user.status === 'active' 
                      ? "bg-brand-yellow text-black hover:bg-brand-yellow-hover rounded-full px-3 py-1" 
                      : "border-destructive text-destructive rounded-full px-3 py-1"
                    }
                  >
                    {user.status === 'active' ? 'Ativo' : 'Inativo'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleEditUser(user.id)} className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-hover-light">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handlePauseUser(user.id)} className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-hover-light">
                      <Pause className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteUser(user.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>)}
          </TableBody>
        </Table>
        {loading && (
          <div className="text-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
            <p className="text-muted-foreground mt-2">Carregando usuários...</p>
          </div>
        )}
        
        {!loading && filteredUsers.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum usuário encontrado
          </div>
        )}
      </div>

      {/* Modal de adicionar/editar usuário */}
      <AdicionarEditarUsuarioModal 
        open={isAddEditModalOpen} 
        onOpenChange={setIsAddEditModalOpen}
        editingUser={editingUser}
        onSuccess={handleModalSuccess}
      />

      {/* Modal de pausar usuário */}
      <PausarUsuarioModal isOpen={isPauseModalOpen} onClose={() => {
      setIsPauseModalOpen(false);
      setSelectedUser(undefined);
    }} onPauseUser={handleConfirmPause} userName={selectedUser?.name || ""} />

      {/* Modal de deletar usuário */}
      <DeletarUsuarioModal isOpen={isDeleteModalOpen} onClose={() => {
      setIsDeleteModalOpen(false);
      setSelectedUser(undefined);
    }} onConfirm={handleConfirmDelete} userName={selectedUser?.name || ""} />
    </div>;
}