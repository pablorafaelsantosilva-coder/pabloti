import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, Upload } from "lucide-react";
import { toast } from "sonner";
import { ApiError, apiUpload } from "@/lib/api";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ImportResult } from "@/lib/participants";

export default function ImportDialog() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [replace, setReplace] = useState(false);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.append("file", file as File);
      form.append("replace", String(replace));
      return apiUpload<ImportResult>("/participants/import", form);
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["participants"] });
      toast.success(`Importação concluída: ${r.created} novos, ${r.updated} atualizados (total ${r.total}).`);
      setOpen(false);
      setFile(null);
    },
    onError: (e) => {
      const detail = e instanceof ApiError && e.body && typeof e.body === "object" && "detail" in e.body
        ? String((e.body as { detail: unknown }).detail)
        : "Falha ao importar o arquivo.";
      toast.error(detail);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="outline" size="sm" className="gap-1.5" data-testid="import-open-button" />}
      >
        <Upload className="size-4" /> Importar planilha
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" data-testid="import-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg">Importar participantes</DialogTitle>
          <DialogDescription>
            Envie a planilha de inscrições (.xlsx ou .csv). Quem já existe é atualizado e mantém o status de contato;
            novos inscritos são distribuídos entre as equipes de forma equilibrada.
          </DialogDescription>
        </DialogHeader>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            setFile(e.dataTransfer.files[0] ?? null);
          }}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors duration-150",
            drag ? "border-emerald-500 bg-emerald-500/10" : "hover:border-emerald-500/50",
          )}
          data-testid="import-dropzone"
        >
          <FileSpreadsheet className="size-8 text-emerald-400" />
          <span className="text-sm font-medium" data-testid="import-file-name">
            {file ? file.name : "Clique ou arraste o arquivo aqui"}
          </span>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            data-testid="import-file-input"
          />
        </div>
        <Label className="flex items-center gap-2 text-sm font-normal">
          <Checkbox checked={replace} onCheckedChange={(v) => setReplace(Boolean(v))} data-testid="import-replace-checkbox" />
          Substituir todos os dados atuais (apaga contatos e anotações)
        </Label>
        <Button
          disabled={!file || mutation.isPending}
          onClick={() => mutation.mutate()}
          data-testid="import-submit-button"
        >
          {mutation.isPending ? "Importando..." : "Importar"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
