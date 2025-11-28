import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Edit, Trash2, Search, Plus, Package, Download, Upload, Filter } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProducts, Product } from "@/hooks/useProducts";
import { cn } from "@/lib/utils";

export function CRMProdutos() {
  const { products, isLoading, createProduct, updateProduct, deleteProduct } = useProducts();
  const [searchTerm, setSearchTerm] = useState("");
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    value: ''
  });

  // Estado para seleção (checkboxes)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const resetForm = () => {
    setFormData({ name: '', value: '' });
  };

  const handleCreateProduct = async () => {
    if (!formData.name.trim()) return;
    
    try {
      await createProduct({
        name: formData.name.trim(),
        value: parseFloat(formData.value) || 0
      });
      resetForm();
      setIsCreateModalOpen(false);
    } catch (error) {
      console.error('Erro ao criar produto:', error);
    }
  };

  const handleEditProduct = async () => {
    if (!selectedProduct || !formData.name.trim()) return;
    
    try {
      await updateProduct(selectedProduct.id, {
        name: formData.name.trim(),
        value: parseFloat(formData.value) || 0
      });
      resetForm();
      setIsEditModalOpen(false);
      setSelectedProduct(null);
    } catch (error) {
      console.error('Erro ao editar produto:', error);
    }
  };

  const handleDeleteProduct = async () => {
    if (!productToDelete) return;
    
    try {
      await deleteProduct(productToDelete.id);
      setIsDeleteModalOpen(false);
      setProductToDelete(null);
    } catch (error) {
      console.error('Erro ao excluir produto:', error);
    }
  };

  const openEditModal = (product: Product) => {
    setSelectedProduct(product);
    setFormData({
      name: product.name,
      value: product.value.toString()
    });
    setIsEditModalOpen(true);
  };

  const openDeleteModal = (product: Product) => {
    setProductToDelete(product);
    setIsDeleteModalOpen(true);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div className="flex flex-col h-full bg-white border border-gray-300 m-2 shadow-sm font-sans text-xs">
      {/* Excel-like Toolbar (Ribbon) */}
      <div className="flex flex-col border-b border-gray-300 bg-[#f8f9fa]">
        {/* Title Bar */}
        <div className="flex items-center justify-between px-4 py-1 bg-primary text-primary-foreground h-8">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            <span className="font-semibold">Produtos</span>
          </div>
          <div className="text-[10px] opacity-80">
            {isLoading ? "Carregando..." : `${filteredProducts.length} itens`}
          </div>
        </div>

        {/* Tools Bar */}
        <div className="flex items-center gap-2 p-2 overflow-x-auto">
          {/* Search Group */}
          <div className="flex items-center gap-2 border-r border-gray-300 pr-3 mr-1">
            <div className="relative w-48">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500 h-3 w-3" />
              <Input
                placeholder="Pesquisar produtos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-7 text-xs border-gray-300 rounded-none focus-visible:ring-1 focus-visible:ring-primary"
              />
            </div>
          </div>

          {/* Actions Group */}
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 hover:bg-gray-200 rounded-sm flex flex-col items-center justify-center gap-0.5 text-gray-700"
              onClick={() => {
                resetForm();
                setIsCreateModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4 text-primary" />
              <span className="text-[9px]">Novo Produto</span>
            </Button>

             <Button 
              size="sm" 
              variant="ghost"
              className="h-8 px-2 hover:bg-gray-200 rounded-sm flex flex-col items-center justify-center gap-0.5 text-gray-700"
            >
              <Download className="h-4 w-4 text-primary" />
              <span className="text-[9px]">Exportar</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Table Area */}
      <div className="flex-1 overflow-auto bg-[#e6e6e6]">
        <div className="inline-block min-w-full align-middle">
          <table className="min-w-full border-collapse bg-white text-xs font-sans">
            <thead className="bg-[#f3f3f3] sticky top-0 z-10">
              <tr>
                <th className="border border-[#d4d4d4] px-2 py-1 text-left font-semibold text-gray-700 min-w-[200px] group hover:bg-[#e1e1e1] cursor-pointer">
                  <div className="flex items-center justify-between">
                    <span>Nome do Produto</span>
                    <div className="w-[1px] h-3 bg-gray-400 mx-1" />
                  </div>
                </th>
                <th className="border border-[#d4d4d4] px-2 py-1 text-right font-semibold text-gray-700 min-w-[100px] group hover:bg-[#e1e1e1] cursor-pointer">
                   <div className="flex items-center justify-between">
                    <span>Preço (R$)</span>
                    <div className="w-[1px] h-3 bg-gray-400 mx-1" />
                  </div>
                </th>
                <th className="border border-[#d4d4d4] px-2 py-1 text-center font-semibold text-gray-700 w-[80px]">
                   <div className="flex items-center justify-between">
                    <span>Ações</span>
                    <div className="w-[1px] h-3 bg-gray-400 mx-1" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                 <tr>
                  <td colSpan={3} className="border border-[#e0e0e0] text-center py-12 bg-gray-50 text-muted-foreground">
                    {isLoading ? "Carregando produtos..." : "Nenhum produto encontrado."}
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-blue-50 group h-[32px]">
                    <td className="border border-[#e0e0e0] px-2 py-0 font-medium align-middle">{product.name}</td>
                    <td className="border border-[#e0e0e0] px-2 py-0 text-right align-middle">{formatCurrency(product.value)}</td>
                    <td className="border border-[#e0e0e0] px-1 py-0 text-center align-middle">
                      <div className="flex items-center justify-center gap-1 h-full">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditModal(product)}
                          className="h-6 w-6 rounded-sm hover:bg-blue-100 text-gray-600"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteModal(product)}
                          className="h-6 w-6 rounded-sm hover:bg-red-100 text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
              {/* Empty rows filler */}
              {filteredProducts.length > 0 && Array.from({ length: Math.max(0, 20 - filteredProducts.length) }).map((_, i) => (
                <tr key={`empty-${i}`} className="h-[32px]">
                   <td className="border border-[#e0e0e0]"></td>
                   <td className="border border-[#e0e0e0]"></td>
                   <td className="border border-[#e0e0e0] bg-gray-50"></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Sheets (Categories) */}
      <div className="flex items-center border-t border-gray-300 bg-[#f0f0f0] px-1 h-8 select-none">
         <div className="flex items-end h-full gap-1 overflow-x-auto px-1">
            <div
              className={cn(
                "flex items-center gap-1.5 px-4 h-[26px] text-xs cursor-pointer border-t border-l border-r rounded-t-sm transition-all",
                "bg-white border-gray-300 border-b-white text-primary font-medium z-10 shadow-sm translate-y-[1px]"
              )}
            >
              <Package className="h-3 w-3" />
              <span>Produtos</span>
            </div>
         </div>
      </div>

      {/* Create Product Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Produto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Input
                placeholder="Nome"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="border-input"
              />
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Preço</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                  R$
                </span>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.value}
                  onChange={(e) => setFormData({...formData, value: e.target.value})}
                  className="pl-8 border-input"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => setIsCreateModalOpen(false)}
                className="text-red-500 hover:text-red-600"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleCreateProduct}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Product Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Produto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Input
                placeholder="Nome"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="border-input"
              />
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Preço</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                  R$
                </span>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.value}
                  onChange={(e) => setFormData({...formData, value: e.target.value})}
                  className="pl-8 border-input"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => setIsEditModalOpen(false)}
                className="text-red-500 hover:text-red-600"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleEditProduct}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Tem certeza que deseja excluir o produto "{productToDelete?.name}"?
            </p>
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => setIsDeleteModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleDeleteProduct}
                className="bg-red-500 hover:bg-red-600 text-white"
              >
                Excluir
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
