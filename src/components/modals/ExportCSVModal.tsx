import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface ExportField {
  key: string;
  label: string;
  available: boolean;
}

interface ExportSection {
  title: string;
  key: string;
  fields: ExportField[];
}

interface ExportCSVModalProps {
  isOpen: boolean;
  onClose: () => void;
  columnName: string;
  cards: any[];
}

export function ExportCSVModal({ isOpen, onClose, columnName, cards }: ExportCSVModalProps) {
  const { toast } = useToast();
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());

  const sections: ExportSection[] = [
    {
      title: "Informações Básicas",
      key: "basic",
      fields: [
        { key: "id", label: "ID do Negócio", available: true },
        { key: "pipeline", label: "Pipeline", available: true },
        { key: "value", label: "Valor", available: true },
        { key: "status", label: "Status", available: true },
        { key: "created_at", label: "Data de Criação", available: true },
        { key: "updated_at", label: "Última Atualização", available: true },
        { key: "moved_at", label: "Última Movimentação", available: true },
        { key: "won_at", label: "Data de Ganho", available: true },
      ],
    },
    {
      title: "Informações do Contato",
      key: "contact",
      fields: [
        { key: "contact_name", label: "Nome do Contato", available: true },
        { key: "contact_phone", label: "Telefone do Contato", available: true },
        { key: "contact_email", label: "E-mail do Contato", available: true },
      ],
    },
    {
      title: "Informações Comerciais",
      key: "commercial",
      fields: [
        { key: "product", label: "Produto/Serviço", available: cards.some(c => c.product_name) },
        { key: "product_value", label: "Valor do Produto", available: cards.some(c => c.product_name) },
        { key: "sales_stage", label: "Etapa de Venda", available: true },
        { key: "tags", label: "Tags", available: cards.some(c => c.contact?.contact_tags?.length > 0) },
        { key: "queue", label: "Filas", available: cards.some(c => c.conversation?.queue) },
      ],
    },
    {
      title: "Responsáveis",
      key: "responsible",
      fields: [
        { key: "responsible_user", label: "Usuário Responsável", available: true },
        { key: "sales_responsible", label: "Responsável pela Venda", available: cards.some(c => c.responsible_user) },
      ],
    },
    {
      title: "Atividades",
      key: "activities",
      fields: [
        { key: "activities_count", label: "Total de Atividades", available: cards.some(c => c.activities?.length > 0) },
        { key: "pending_activities", label: "Atividades Pendentes", available: cards.some(c => c.activities?.length > 0) },
        { key: "completed_activities", label: "Atividades Concluídas", available: cards.some(c => c.activities?.length > 0) },
        { key: "next_activity", label: "Próxima Atividade", available: cards.some(c => c.activities?.length > 0) },
      ],
    },
  ];

  // Inicializar com todos os campos disponíveis selecionados
  useEffect(() => {
    if (isOpen) {
      const availableFields = sections.flatMap(section =>
        section.fields.filter(f => f.available).map(f => f.key)
      );
      setSelectedFields(new Set(availableFields));
    }
  }, [isOpen]);

  const toggleField = (fieldKey: string) => {
    setSelectedFields(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fieldKey)) {
        newSet.delete(fieldKey);
      } else {
        newSet.add(fieldKey);
      }
      return newSet;
    });
  };

  const selectAllInSection = (section: ExportSection) => {
    const availableKeys = section.fields.filter(f => f.available).map(f => f.key);
    setSelectedFields(prev => {
      const newSet = new Set(prev);
      availableKeys.forEach(key => newSet.add(key));
      return newSet;
    });
  };

  const deselectAllInSection = (section: ExportSection) => {
    const availableKeys = section.fields.filter(f => f.available).map(f => f.key);
    setSelectedFields(prev => {
      const newSet = new Set(prev);
      availableKeys.forEach(key => newSet.delete(key));
      return newSet;
    });
  };

  const selectAll = () => {
    const allAvailable = sections.flatMap(s => 
      s.fields.filter(f => f.available).map(f => f.key)
    );
    setSelectedFields(new Set(allAvailable));
  };

  const isSectionFullySelected = (section: ExportSection) => {
    const availableKeys = section.fields.filter(f => f.available).map(f => f.key);
    return availableKeys.every(key => selectedFields.has(key));
  };

  const getFieldValue = (card: any, fieldKey: string): string => {
    switch (fieldKey) {
      case "id":
        return card.id || "";
      case "pipeline":
        return card.pipeline?.name || "";
      case "value":
        return card.value ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(card.value) : "R$ 0,00";
      case "status":
        return card.status || "";
      case "created_at":
        return card.created_at ? format(new Date(card.created_at), "dd/MM/yyyy HH:mm") : "";
      case "updated_at":
        return card.updated_at ? format(new Date(card.updated_at), "dd/MM/yyyy HH:mm") : "";
      case "moved_at":
        return card.moved_at ? format(new Date(card.moved_at), "dd/MM/yyyy HH:mm") : "";
      case "won_at":
        return card.won_at ? format(new Date(card.won_at), "dd/MM/yyyy HH:mm") : "";
      case "contact_name":
        return card.contact?.name || "";
      case "contact_phone":
        return card.contact?.phone || "";
      case "contact_email":
        return card.contact?.email || "";
      case "product":
        return card.product_name || "";
      case "product_value":
        return card.product_value ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(card.product_value) : "R$ 0,00";
      case "sales_stage":
        return columnName;
      case "tags":
        return card.contact?.contact_tags?.map((ct: any) => ct.tags?.name).filter(Boolean).join(", ") || "";
      case "queue":
        return card.conversation?.queue?.name || "";
      case "responsible_user":
        return card.responsible_user?.name || card.responsible || "";
      case "sales_responsible":
        return card.responsible_user?.name || card.responsible || "";
      case "activities_count":
        return card.activities?.length?.toString() || "0";
      case "pending_activities":
        return card.activities?.filter((a: any) => !a.is_completed)?.length?.toString() || "0";
      case "completed_activities":
        return card.activities?.filter((a: any) => a.is_completed)?.length?.toString() || "0";
      case "next_activity":
        const nextActivity = card.activities
          ?.filter((a: any) => !a.is_completed && a.scheduled_for)
          ?.sort((a: any, b: any) => new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime())[0];
        return nextActivity ? `${nextActivity.subject} - ${format(new Date(nextActivity.scheduled_for), "dd/MM/yyyy HH:mm")}` : "";
      default:
        return "";
    }
  };

  const handleExport = () => {
    if (selectedFields.size === 0) {
      toast({
        title: "Nenhum campo selecionado",
        description: "Selecione ao menos um campo para exportar.",
        variant: "destructive",
      });
      return;
    }

    // Criar headers baseado nos campos selecionados
    // Se "product" estiver selecionado, incluir automaticamente "product_value"
    const selectedFieldsArray = Array.from(selectedFields);
    const finalFields = [...selectedFieldsArray];
    
    // Se produto estiver selecionado mas valor do produto não, adicionar
    if (finalFields.includes("product") && !finalFields.includes("product_value")) {
      const productIndex = finalFields.indexOf("product");
      finalFields.splice(productIndex + 1, 0, "product_value");
    }
    
    const headers = finalFields.map(key => {
      for (const section of sections) {
        const field = section.fields.find(f => f.key === key);
        if (field) return field.label;
      }
      return key;
    });

    // Criar linhas de dados
    const rows = cards.map(card => {
      return finalFields.map(key => {
        let value = getFieldValue(card, key);
        // Remover quebras de linha e caracteres de controle
        value = value.replace(/[\r\n\t]+/g, " ").trim();
        // Escapar aspas duplas duplicando-as
        value = value.replace(/"/g, '""');
        // Sempre envolver em aspas para segurança
        return `"${value}"`;
      });
    });

    // BOM para UTF-8 (para Excel reconhecer acentuação)
    const BOM = "\uFEFF";
    const csvContent = BOM + [
      headers.map(h => `"${h.replace(/"/g, '""')}"`).join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    // Download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `pipeline-${columnName}-${format(new Date(), "yyyyMMdd-HHmmss")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Exportação concluída",
      description: `${cards.length} negócios exportados com ${selectedFields.size} campos.`,
    });

    onClose();
  };

  const selectedCount = selectedFields.size;
  const totalAvailable = sections.flatMap(s => s.fields.filter(f => f.available)).length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Selecionar Campos para Exportação CSV
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Etapa: {columnName}
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={selectAll}
              className="text-yellow-600 border-yellow-600 hover:bg-yellow-50"
            >
              Selecionar Todos
            </Button>
            <p className="text-sm text-muted-foreground">
              {selectedCount} de {totalAvailable} campos selecionados
            </p>
          </div>

          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-6">
              {sections.map(section => {
                const availableFields = section.fields.filter(f => f.available);
                if (availableFields.length === 0) return null;

                const isFullySelected = isSectionFullySelected(section);

                return (
                  <div key={section.key} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-semibold text-yellow-600">
                        {section.title}
                      </h3>
                      <button
                        onClick={() => isFullySelected ? deselectAllInSection(section) : selectAllInSection(section)}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {isFullySelected ? "Desmarcar Seção" : "Selecionar Seção"}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {availableFields.map(field => (
                        <div key={field.key} className="flex items-center space-x-2">
                          <Checkbox
                            id={field.key}
                            checked={selectedFields.has(field.key)}
                            onCheckedChange={() => toggleField(field.key)}
                          />
                          <label
                            htmlFor={field.key}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {field.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="flex items-center gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleExport}
            disabled={selectedFields.size === 0}
            className="bg-yellow-600 hover:bg-yellow-700 text-white"
          >
            Exportar CSV ({selectedCount} campos)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
