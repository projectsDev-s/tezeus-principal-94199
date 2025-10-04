import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Tag {
  id: string;
  name: string;
}

interface DeletarTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTagDeleted: () => void;
  tag: Tag | null;
}

export function DeletarTagModal({ isOpen, onClose, onTagDeleted, tag }: DeletarTagModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleDelete = async () => {
    if (!tag?.id) return;

    setIsLoading(true);
    try {
      // Primeiro deletar todos os registros de contact_tags associados
      const { error: contactTagsError } = await supabase
        .from('contact_tags')
        .delete()
        .eq('tag_id', tag.id);

      if (contactTagsError) throw contactTagsError;

      // Depois deletar a tag
      const { error: tagError } = await supabase
        .from('tags')
        .delete()
        .eq('id', tag.id);

      if (tagError) throw tagError;

      toast({
        title: "Tag deletada",
        description: `A tag "${tag.name}" foi deletada com sucesso.`,
      });

      onTagDeleted();
      onClose();
    } catch (error: any) {
      console.error('Erro ao deletar tag:', error);
      toast({
        title: "Erro",
        description: "Não foi possível deletar a tag. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="bg-white">
        <AlertDialogHeader>
          <AlertDialogTitle>Deletar Tag</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja deletar a tag "{tag?.name}"? 
            Esta ação removerá a tag de todos os contatos associados e não poderá ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isLoading}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {isLoading ? "Deletando..." : "Deletar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}