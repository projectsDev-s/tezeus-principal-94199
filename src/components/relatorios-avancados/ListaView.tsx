import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ListaViewProps {
  data: any[];
}

export function ListaView({ data }: ListaViewProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]">
              <Checkbox />
            </TableHead>
            <TableHead>Título</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Responsável</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Criado em</TableHead>
            <TableHead>Pipeline</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                Nenhum registro encontrado
              </TableCell>
            </TableRow>
          ) : (
            data.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <Checkbox />
                </TableCell>
                <TableCell className="font-medium">{item.title}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      item.status === 'won' ? 'default' :
                      item.status === 'lost' ? 'destructive' :
                      'secondary'
                    }
                    className={
                      item.status === 'won' ? 'bg-green-500 hover:bg-green-600' :
                      item.status === 'lost' ? 'bg-red-500 hover:bg-red-600' :
                      'bg-blue-500 hover:bg-blue-600 text-white'
                    }
                  >
                    {item.status === 'won' ? 'Ganho' :
                     item.status === 'lost' ? 'Perdido' :
                     'Aberto'}
                  </Badge>
                </TableCell>
                <TableCell>{item.responsible}</TableCell>
                <TableCell>
                  {new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                  }).format(item.value)}
                </TableCell>
                <TableCell>
                  {format(new Date(item.createdAt), 'dd/MM/yyyy', { locale: ptBR })}
                </TableCell>
                <TableCell>{item.pipeline}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      <div className="flex items-center justify-end space-x-2 py-4 px-4">
        <Button variant="outline" size="sm">Anterior</Button>
        <Button variant="outline" size="sm">Próximo</Button>
      </div>
    </div>
  );
}


