import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useWorkspaceUsers } from "@/hooks/useWorkspaceUsers";
import { useProducts } from "@/hooks/useProducts";
import { usePipelines } from "@/hooks/usePipelines";
import { usePipelineColumns } from "@/hooks/usePipelineColumns";

interface CriarNegocioModalProps {
  isOpen?: boolean;
  open?: boolean;
  onClose?: () => void;
  onOpenChange?: (open: boolean) => void;
  onCreateBusiness?: (business: any) => void;
  isDarkMode?: boolean;
  preSelectedContactId?: string;
  preSelectedContactName?: string;
  onResponsibleUpdated?: () => void;
}

export function CriarNegocioModal({ 
  isOpen, 
  open, 
  onClose, 
  onOpenChange, 
  onCreateBusiness, 
  isDarkMode = false,
  preSelectedContactId,
  preSelectedContactName,
  onResponsibleUpdated
}: CriarNegocioModalProps) {
  const modalOpen = open ?? isOpen ?? false;
  const handleClose = () => {
    if (onOpenChange) onOpenChange(false);
    if (onClose) onClose();
  };

  const [selectedLead, setSelectedLead] = useState(preSelectedContactId || "");
  const [selectedResponsible, setSelectedResponsible] = useState("");
  const [selectedPipeline, setSelectedPipeline] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedColumn, setSelectedColumn] = useState("");
  const [value, setValue] = useState("");
  const [contacts, setContacts] = useState<any[]>([]);
  
  const { selectedWorkspace } = useWorkspace();
  const { pipelines } = usePipelines();
  const { columns, fetchColumns } = usePipelineColumns(selectedPipeline || null);
  
  // Estabilizar o array de filtros para evitar loop infinito
  const profileFilters = useMemo<('user' | 'admin' | 'master')[]>(() => ['user', 'admin'], []);
  
  const { users, isLoading: isLoadingUsers } = useWorkspaceUsers(
    selectedWorkspace?.workspace_id, 
    profileFilters
  );
  const { products, isLoading: isLoadingProducts } = useProducts();

  // Buscar contatos
  useEffect(() => {
    const fetchContacts = async () => {
      if (!selectedWorkspace) return;
      
      const { data, error } = await supabase
        .from('contacts')
        .select('id, name, phone, email')
        .eq('workspace_id', selectedWorkspace.workspace_id)
        .order('name');
      
      if (!error && data) {
        setContacts(data);
      }
    };
    
    fetchContacts();
  }, [selectedWorkspace]);


  // Pré-selecionar contato quando fornecido
  useEffect(() => {
    if (preSelectedContactId) {
      setSelectedLead(preSelectedContactId);
    }
  }, [preSelectedContactId]);

  // Preencher valor automaticamente ao selecionar produto
  useEffect(() => {
    if (selectedProduct) {
      const product = products.find(p => p.id === selectedProduct);
      if (product) {
        setValue(product.value.toString());
      }
    }
  }, [selectedProduct, products]);

  // Carregar colunas quando pipeline for selecionado
  useEffect(() => {
    if (selectedPipeline) {
      fetchColumns();
    }
  }, [selectedPipeline]);

  // Atualizar primeira coluna quando colunas mudarem
  useEffect(() => {
    if (columns.length > 0 && !selectedColumn) {
      setSelectedColumn(columns[0].id);
    }
  }, [columns]);

  // Validar se pode habilitar botão criar
  const canCreate = selectedLead && selectedResponsible && selectedPipeline && selectedColumn;

  const handleSubmit = async () => {
    if (!canCreate) return;
    
    const newBusiness = {
      lead: selectedLead,
      responsible: selectedResponsible,
      pipeline: selectedPipeline,
      product: selectedProduct || null,
      column: selectedColumn,
      value: value ? parseFloat(value) : 0
    };
    
    if (onCreateBusiness) {
      try {
        await onCreateBusiness(newBusiness);
        
        if (onResponsibleUpdated) {
          onResponsibleUpdated();
        }
        
        // Reset form apenas se sucesso
        setSelectedLead(preSelectedContactId || "");
        setSelectedResponsible("");
        setSelectedPipeline("");
        setSelectedProduct("");
        setSelectedColumn("");
        setValue("");
        
        handleClose();
      } catch (error: any) {
        // Erro já foi tratado no contexto com toast
        console.error('Erro ao criar negócio:', error);
      }
    }
  };

  return (
    <Dialog open={modalOpen} onOpenChange={handleClose}>
      <DialogContent className={cn(
        "max-w-md p-0 gap-0 border border-[#d4d4d4] shadow-sm rounded-none",
        isDarkMode 
          ? "bg-gray-800 border-gray-600 text-white" 
          : "bg-white text-gray-900"
      )}>
        <DialogHeader className={cn(
          "p-4 m-0 rounded-none border-b",
          isDarkMode ? "bg-gray-700 border-gray-600" : "bg-primary border-[#d4d4d4]"
        )}>
          <DialogTitle className={cn(
            "text-base font-bold",
            isDarkMode ? "text-white" : "text-primary-foreground"
          )}>
            Criar Negócio
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 p-6">
          {/* Seleção de Lead */}
          <div>
            <Label className={cn("text-xs font-bold mb-1.5 block", isDarkMode ? "text-gray-300" : "text-gray-700")}>Lead</Label>
            <Select value={selectedLead} onValueChange={setSelectedLead} disabled={!!preSelectedContactId}>
              <SelectTrigger className={cn(
                "h-8 text-xs rounded-none focus:ring-0",
                isDarkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-900"
              )}>
                <SelectValue placeholder={preSelectedContactName || "Selecione o Lead"} />
              </SelectTrigger>
              <SelectContent className={cn(
                "max-h-48 overflow-auto z-50 rounded-none",
                isDarkMode ? "bg-gray-800 border-gray-600" : "bg-white border-gray-300"
              )}>
                {contacts.map((contact) => (
                  <SelectItem key={contact.id} value={contact.id} className={cn("text-xs rounded-none cursor-pointer", isDarkMode ? "text-gray-300 focus:bg-gray-700" : "text-gray-700")}>
                    {contact.name} - {contact.phone || contact.email || 'Sem contato'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Seleção de responsável */}
          <div>
            <Label className={cn("text-xs font-bold mb-1.5 block", isDarkMode ? "text-gray-300" : "text-gray-700")}>Responsável</Label>
            <Select value={selectedResponsible} onValueChange={setSelectedResponsible} disabled={isLoadingUsers}>
              <SelectTrigger className={cn(
                "h-8 text-xs rounded-none focus:ring-0",
                isDarkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-900"
              )}>
                <SelectValue placeholder={
                  isLoadingUsers 
                    ? "Carregando usuários..." 
                    : users.length === 0 
                      ? "Nenhum usuário disponível" 
                      : "Selecione o responsável"
                } />
              </SelectTrigger>
              {users.length > 0 && (
                <SelectContent className={cn(
                  "max-h-48 overflow-auto z-50 rounded-none",
                  isDarkMode ? "bg-gray-800 border-gray-600" : "bg-white border-gray-300"
                )}>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id} className={cn("text-xs rounded-none cursor-pointer", isDarkMode ? "text-gray-300 focus:bg-gray-700" : "text-gray-700")}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              )}
            </Select>
          </div>

          {/* Seleção de pipeline */}
          <div>
            <Label className={cn("text-xs font-bold mb-1.5 block", isDarkMode ? "text-gray-300" : "text-gray-700")}>Pipeline</Label>
            <Select value={selectedPipeline} onValueChange={setSelectedPipeline}>
              <SelectTrigger className={cn(
                "h-8 text-xs rounded-none focus:ring-0",
                isDarkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-900"
              )}>
                <SelectValue placeholder="Selecione o pipeline" />
              </SelectTrigger>
              <SelectContent className={cn(
                "max-h-48 overflow-auto z-50 rounded-none",
                isDarkMode ? "bg-gray-800 border-gray-600" : "bg-white border-gray-300"
              )}>
                {pipelines.map((pipeline) => (
                  <SelectItem key={pipeline.id} value={pipeline.id} className={cn("text-xs rounded-none cursor-pointer", isDarkMode ? "text-gray-300 focus:bg-gray-700" : "text-gray-700")}>
                    {pipeline.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Seleção de coluna */}
          <div>
            <Label className={cn("text-xs font-bold mb-1.5 block", isDarkMode ? "text-gray-300" : "text-gray-700")}>Coluna</Label>
            <Select 
              value={selectedColumn} 
              onValueChange={setSelectedColumn}
              disabled={!selectedPipeline || columns.length === 0}
            >
              <SelectTrigger className={cn(
                "h-8 text-xs rounded-none focus:ring-0",
                isDarkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-900"
              )}>
                <SelectValue placeholder={
                  !selectedPipeline 
                    ? "Selecione um pipeline primeiro" 
                    : columns.length === 0 
                      ? "Nenhuma coluna disponível" 
                      : "Selecione a coluna"
                } />
              </SelectTrigger>
              {columns.length > 0 && (
                <SelectContent className={cn(
                  "max-h-48 overflow-auto z-50 rounded-none",
                  isDarkMode ? "bg-gray-800 border-gray-600" : "bg-white border-gray-300"
                )}>
                  {columns.map((column) => (
                    <SelectItem key={column.id} value={column.id} className={cn("text-xs rounded-none cursor-pointer", isDarkMode ? "text-gray-300 focus:bg-gray-700" : "text-gray-700")}>
                      {column.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              )}
            </Select>
          </div>

          {/* Seleção de produto (opcional) */}
          <div>
            <Label className={cn("text-xs font-bold mb-1.5 block", isDarkMode ? "text-gray-300" : "text-gray-700")}>Produto (Opcional)</Label>
            <Select value={selectedProduct} onValueChange={setSelectedProduct} disabled={isLoadingProducts}>
              <SelectTrigger className={cn(
                "h-8 text-xs rounded-none focus:ring-0",
                isDarkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-900"
              )}>
                <SelectValue placeholder={
                  isLoadingProducts 
                    ? "Carregando produtos..." 
                    : products.length === 0 
                      ? "Nenhum produto disponível" 
                      : "Selecione o produto"
                } />
              </SelectTrigger>
              {products.length > 0 && (
                <SelectContent className={cn(
                  "max-h-48 overflow-auto z-50 rounded-none",
                  isDarkMode ? "bg-gray-800 border-gray-600" : "bg-white border-gray-300"
                )}>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id} className={cn("text-xs rounded-none cursor-pointer", isDarkMode ? "text-gray-300 focus:bg-gray-700" : "text-gray-700")}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              )}
            </Select>
          </div>

          {/* Campo de preço */}
          <div>
            <Label htmlFor="value" className={cn("text-xs font-bold mb-1.5 block", isDarkMode ? "text-gray-300" : "text-gray-700")}>
              Preço (Opcional)
            </Label>
            <div className="relative">
              <span className={cn("absolute left-3 top-1/2 transform -translate-y-1/2 text-xs font-medium", isDarkMode ? "text-gray-400" : "text-gray-500")}>
                R$
              </span>
              <Input
                id="value"
                type="number"
                step="0.01"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="0,00"
                className={cn(
                  "pl-8 h-8 text-xs rounded-none focus-visible:ring-0",
                  isDarkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-900"
                )}
              />
            </div>
          </div>
        </div>

        {/* Botões de ação */}
        <div className={cn(
          "flex justify-end gap-2 p-4 border-t mt-0",
          isDarkMode ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-[#d4d4d4]"
        )}>
          <Button
            variant="outline"
            onClick={handleClose}
            className={cn(
              "h-8 text-xs rounded-none",
              isDarkMode ? "bg-gray-600 border-gray-500 text-white hover:bg-gray-500" : "bg-white border-gray-300 hover:bg-gray-100 text-gray-700"
            )}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canCreate}
            className={cn(
              "h-8 text-xs rounded-none transition-opacity",
              isDarkMode ? "bg-primary hover:bg-primary/90 text-primary-foreground" : "bg-primary hover:bg-primary/90 text-primary-foreground",
              !canCreate && "opacity-50 cursor-not-allowed"
            )}
          >
            Criar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}