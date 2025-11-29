import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useLossReasons } from '@/hooks/useLossReasons';
import { Plus, Trash2, Edit2, X, Check, RefreshCw } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';

export const ConfiguracaoAcoes: React.FC = () => {
  const { selectedWorkspace } = useWorkspace();
  const { workspaceId: urlWorkspaceId } = useParams<{ workspaceId: string }>();
  const [storedWorkspaceId, setStoredWorkspaceId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (urlWorkspaceId) {
      setStoredWorkspaceId(urlWorkspaceId);
      return;
    }
    try {
      const stored = localStorage.getItem('selectedWorkspace');
      if (stored) {
        const parsed = JSON.parse(stored);
        setStoredWorkspaceId(parsed?.workspace_id || null);
      }
    } catch {
      setStoredWorkspaceId(null);
    }
  }, [urlWorkspaceId]);

  const effectiveWorkspaceId =
    urlWorkspaceId ||
    selectedWorkspace?.workspace_id ||
    storedWorkspaceId ||
    null;

  const {
    lossReasons,
    isLoading,
    createLossReason,
    updateLossReason,
    deleteLossReason,
  } = useLossReasons(effectiveWorkspaceId);

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
    <div className="flex flex-col gap-4 h-full bg-white border border-gray-300 m-2 shadow-sm font-sans text-xs">
      {/* Header estilo sistema */}
      <div className="flex items-center justify-between border-b border-gray-300 bg-[#f3f3f3] px-4 py-2">
        <div>
          <h1 className="text-lg font-bold text-gray-800 tracking-tight">
            Configuração de Ações
          </h1>
          <p className="text-[11px] text-gray-600">
            Gerencie os motivos de perda utilizados em toda a empresa.
          </p>
        </div>
        <Button size="sm" variant="outline" className="h-8 rounded-none border-gray-300 text-gray-700 hover:bg-white" onClick={() => window.location.reload()}>
          <RefreshCw className="w-3 h-3 mr-1.5" />
          Atualizar
        </Button>
      </div>

      <div className="flex-1 overflow-auto bg-[#f8f9fb] p-4">
        <Card className="rounded-none border border-gray-300 shadow-sm">
          <CardHeader className="bg-[#fdfdfd] border-b border-gray-200 rounded-none">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-gray-900 tracking-tight">
                  Motivos de Perda
                </CardTitle>
                <CardDescription className="text-xs text-gray-600">
                  Configure os motivos que podem ser selecionados ao marcar um negócio como perdido.
                </CardDescription>
              </div>
              <Badge variant="secondary" className="rounded-none px-2 py-0.5 text-[10px] tracking-tight border border-gray-300 bg-white text-gray-700">
                {lossReasons.length} motivo{lossReasons.length === 1 ? '' : 's'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 bg-white">
          {/* Formulário de criação */}
          <div className="flex flex-col md:flex-row gap-2 rounded-none border border-dashed border-gray-300 bg-gray-50/80 p-3">
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
            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={!newReasonName.trim() || isLoading} className="rounded-none">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar
              </Button>
              <Button variant="ghost" className="border border-gray-300 rounded-none text-gray-700 hover:bg-white" onClick={() => setNewReasonName('')}>
                Limpar
              </Button>
            </div>
          </div>

          {/* Lista de motivos */}
          <div className="space-y-2 border border-dashed border-gray-200 rounded-none bg-[#fafafa] p-3">
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
                  className="flex items-center gap-2 p-3 border border-[#e5e7eb] rounded-none bg-white hover:bg-yellow-50 transition-colors shadow-sm"
                >
                  {editingId === reason.id ? (
                    <>
                      <div className="flex-1 space-y-1">
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
                          className="rounded-none"
                          autoFocus
                        />
                        <span className="text-[10px] text-gray-400">Pressione Enter para salvar ou ESC para cancelar</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="rounded-none w-8 h-8 hover:bg-green-50"
                          onClick={handleSaveEdit}
                          disabled={!editingName.trim()}
                        >
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="rounded-none w-8 h-8 hover:bg-red-50"
                          onClick={handleCancelEdit}
                        >
                          <X className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex flex-col flex-1">
                        <span className="font-semibold text-sm text-gray-900">{reason.name}</span>
                        <span className="text-[10px] uppercase tracking-[0.08em] text-gray-400">Motivo ativo</span>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="hover:bg-gray-100 rounded-none w-8 h-8"
                        onClick={() => handleStartEdit(reason.id, reason.name)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="hover:bg-red-50 rounded-none w-8 h-8"
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
      </div>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={!!deleteReasonId} onOpenChange={() => setDeleteReasonId(null)}>
        <AlertDialogContent className="rounded-none border border-gray-300">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg">Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Tem certeza que deseja excluir este motivo de perda? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none border border-gray-300">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="rounded-none bg-red-600 hover:bg-red-700">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
