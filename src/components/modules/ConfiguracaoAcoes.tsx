import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useLossReasons } from '@/hooks/useLossReasons';
import { Plus, Trash2, Edit2, X, Check } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export const ConfiguracaoAcoes: React.FC = () => {
  const { selectedWorkspace } = useWorkspace();
  const { lossReasons, isLoading, createLossReason, updateLossReason, deleteLossReason } =
    useLossReasons(selectedWorkspace?.workspace_id || null);

  const [newReasonName, setNewReasonName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [deleteReasonId, setDeleteReasonId] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!newReasonName.trim()) return;
    await createLossReason(newReasonName.trim());
    setNewReasonName('');
  };

  const handleStartEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditingName(name);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editingName.trim()) return;
    await updateLossReason(editingId, editingName.trim());
    setEditingId(null);
    setEditingName('');
  };

  const handleDelete = async () => {
    if (!deleteReasonId) return;
    await deleteLossReason(deleteReasonId);
    setDeleteReasonId(null);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Configuração de Ações</h1>
        <p className="text-muted-foreground">
          Gerencie os motivos de perda da página de configurações da empresa.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Motivos de Perda</CardTitle>
          <CardDescription>
            Configure os motivos que podem ser selecionados ao marcar um negócio como perdido.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Formulário de criação */}
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="new-reason" className="sr-only">
                Novo motivo
              </Label>
              <Input
                id="new-reason"
                placeholder="Digite o nome do novo motivo..."
                value={newReasonName}
                onChange={(e) => setNewReasonName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreate();
                  }
                }}
              />
            </div>
            <Button onClick={handleCreate} disabled={!newReasonName.trim() || isLoading}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar
            </Button>
          </div>

          {/* Lista de motivos */}
          <div className="space-y-2">
            {isLoading && lossReasons.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Carregando motivos...
              </div>
            ) : lossReasons.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum motivo de perda cadastrado ainda.
              </div>
            ) : (
              lossReasons.map((reason) => (
                <div
                  key={reason.id}
                  className="flex items-center gap-2 p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  {editingId === reason.id ? (
                    <>
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSaveEdit();
                          } else if (e.key === 'Escape') {
                            handleCancelEdit();
                          }
                        }}
                        className="flex-1"
                        autoFocus
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={handleSaveEdit}
                        disabled={!editingName.trim()}
                      >
                        <Check className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={handleCancelEdit}
                      >
                        <X className="h-4 w-4 text-red-600" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 font-medium">{reason.name}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleStartEdit(reason.id, reason.name)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setDeleteReasonId(reason.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={!!deleteReasonId} onOpenChange={() => setDeleteReasonId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este motivo de perda? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
