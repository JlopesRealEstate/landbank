"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  ImagePlus,
  Loader2,
  Map,
  Paperclip,
  Trash2,
  Upload,
} from "lucide-react";
import { DOCUMENT_CATEGORIES, dateLabel } from "@/lib/format";
import { cn } from "@/components/ui";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";

export type MediaItem = {
  id: number;
  kind: string;
  category: string;
  name: string;
  mimeType: string;
  size: number;
  url: string;
  createdAt: string | Date;
};

async function preparePhoto(file: File): Promise<{ body: Blob; mimeType: string; size: number; name: string }> {
  try {
    const bitmap = await createImageBitmap(file);
    const maxSize = 2000;
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas indisponível");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Falha ao preparar imagem")), "image/jpeg", 0.88),
    );
    return { body: blob, mimeType: "image/jpeg", size: blob.size, name: file.name.replace(/\.[^.]+$/, "") + ".jpg" };
  } catch {
    return { body: file, mimeType: file.type || "application/octet-stream", size: file.size, name: file.name };
  }
}

function docIcon(category: string) {
  if (category === "Mapa" || category === "KMZ") return Map;
  if (category === "Planta" || category === "Projeto") return FileSpreadsheet;
  return FileText;
}

export function MediaManager({ areaId, media }: { areaId: number; media: MediaItem[] }) {
  const router = useRouter();
  const photoRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState("Matrícula");
  const [busy, setBusy] = useState<"photo" | "document" | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [removing, setRemoving] = useState<number | null>(null);
  const [coverBusy, setCoverBusy] = useState<number | null>(null);

  const photos = media.filter((item) => item.kind === "photo");
  const documents = media.filter((item) => item.kind === "document");
  const coverPhoto = photos.find((item) => item.category === "capa");

  async function upload(files: FileList | null, kind: "photo" | "document") {
    if (!files || files.length === 0) return;
    setBusy(kind);
    setMessage(null);
    try {
      const supabase = createSupabaseClient() as any;
      const selected = Array.from(files);
      if (kind === "photo" && photos.length + selected.length > 100) {
        throw new Error(`Limite de 100 fotos por imóvel. Já existem ${photos.length}; você pode adicionar mais ${Math.max(0, 100 - photos.length)}.`);
      }
      const preparedFiles = await Promise.all(selected.map(async (file) => {
        if (file.size > 9 * 1024 * 1024) throw new Error(`${file.name} excede 9 MB.`);
        if (kind === "photo") return preparePhoto(file);
        return { body: file as Blob, mimeType: file.type || "application/octet-stream", size: file.size, name: file.name };
      }));
      const authResponse = await fetch(`/api/areas/${areaId}/media/upload-url`, {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, files: preparedFiles.map((file) => ({ name: file.name, size: file.size, mimeType: file.mimeType })) }),
      });
      const authData = await authResponse.json() as { ok: boolean; error?: string; uploads?: Array<{ path: string; token: string; name: string; size: number; mimeType: string }> };
      if (!authResponse.ok || !authData.ok || !authData.uploads) throw new Error(authData.error ?? "Não foi possível autorizar os arquivos.");
      const registered: Array<{ kind: string; category: string; name: string; mimeType: string; size: number; storagePath: string; caption: string }> = [];
      for (let index = 0; index < preparedFiles.length; index += 1) {
        const prepared = preparedFiles[index];
        const target = authData.uploads[index];
        const { error: uploadError } = await supabase.storage.from("landbank-files").uploadToSignedUrl(
          target.path, target.token, prepared.body, { contentType: prepared.mimeType },
        );
        if (uploadError) throw new Error(`Storage recusou "${selected[index].name}": ${uploadError.message}`);
        registered.push({
          kind, category: kind === "photo" ? "fachada" : category,
          name: target.name, mimeType: prepared.mimeType, size: prepared.size, storagePath: target.path, caption: "",
        });
      }
      const response = await fetch(`/api/areas/${areaId}/media`, {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: registered }),
      });
      const data = await response.json() as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Falha ao registrar arquivos no dossiê.");
      setMessage({ tone: "ok", text: `${registered.length} arquivo(s) adicionados ao dossiê.` });
      if (kind === "photo" && photoRef.current) photoRef.current.value = "";
      if (kind === "document" && docRef.current) docRef.current.value = "";
      router.refresh();
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Falha no upload." });
    } finally {
      setBusy(null);
    }
  }

  async function setCover(mediaId: number) {
    setCoverBusy(mediaId);
    setMessage(null);
    try {
      const response = await fetch(`/api/areas/${areaId}/media`, { method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mediaId }) });
      const data = await response.json() as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Não foi possível definir a capa.");
      setMessage({ tone: "ok", text: "Foto de capa do anúncio atualizada." });
      router.refresh();
    } catch (error) { setMessage({ tone: "error", text: error instanceof Error ? error.message : "Falha ao definir capa." }); }
    finally { setCoverBusy(null); }
  }

  async function remove(mediaId: number) {
    if (!window.confirm("Remover este arquivo do dossiê?")) return;
    setRemoving(mediaId);
    const response = await fetch(`/api/media/${mediaId}`, { method: "DELETE", credentials: "same-origin" });
    if (response.ok) router.refresh();
    setRemoving(null);
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-dashed border-leaf/40 bg-leaf-50/40 p-3.5">
          <div className="flex items-start gap-2">
            <ImagePlus className="mt-0.5 h-4 w-4 text-leaf" />
            <div>
              <p className="text-xs font-semibold text-ink">Fotos do imóvel</p>
              <p className="text-[10px] text-muted">Imagens em diversos formatos · compressão automática quando compatível</p>
            </div>
          </div>
          <input
            ref={photoRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => void upload(event.target.files, "photo")}
          />
          <button
            type="button"
            onClick={() => photoRef.current?.click()}
            disabled={busy !== null}
            className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-forest px-3 py-2 text-[11px] font-medium text-white hover:bg-forest-600 disabled:opacity-60"
          >
            {busy === "photo" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
            Enviar fotos
          </button>
        </div>

        <div className="rounded-xl border border-dashed border-line bg-paper/50 p-3.5">
          <div className="flex items-start gap-2">
            <Paperclip className="mt-0.5 h-4 w-4 text-ink-soft" />
            <div>
              <p className="text-xs font-semibold text-ink">Documentos e mapas</p>
              <p className="text-[10px] text-muted">Qualquer extensão: KMZ, PDF, Office, imagens, CAD, ZIP e outros · até 9 MB por arquivo</p>
            </div>
          </div>
          <div className="mt-2.5 flex gap-1.5">
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-line bg-white px-2 py-1.5 text-[11px]"
            >
              {DOCUMENT_CATEGORIES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <input
              ref={docRef}
              type="file"
              multiple
              
              className="hidden"
              onChange={(event) => void upload(event.target.files, "document")}
            />
            <button
              type="button"
              onClick={() => docRef.current?.click()}
              disabled={busy !== null}
              className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2.5 py-1.5 text-[11px] font-medium text-ink hover:border-leaf disabled:opacity-60"
            >
              {busy === "document" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Anexar
            </button>
          </div>
        </div>
      </div>

      {message ? (
        <p className={cn("rounded-lg px-3 py-2 text-[11px]", message.tone === "ok" ? "bg-leaf-50 text-leaf-600" : "bg-red-50 text-red-700")}>
          {message.text}
        </p>
      ) : null}

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Fotos ({photos.length}/100)</p>
        <p className="mt-1 text-[10px] text-muted">Escolha uma foto como capa do anúncio. Ela será a primeira imagem nos cards do CRM e no portal público; as demais ficam no carrossel.</p>
        {photos.length === 0 ? (
          <p className="mt-2 rounded-lg bg-paper/60 p-3 text-[11px] text-muted">Nenhuma foto cadastrada.</p>
        ) : (
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {photos.map((photo) => (
              <div key={photo.id} className="group relative overflow-hidden rounded-lg border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt={photo.name} className="h-24 w-full object-cover" />
                <div className="absolute left-1 top-1 flex gap-1">
                  <button type="button" onClick={() => void setCover(photo.id)} disabled={coverBusy !== null || photo.category === "capa"} className={cn("inline-flex items-center gap-1 rounded-md px-2 py-1 text-[9px] font-semibold shadow-sm", photo.category === "capa" ? "bg-emerald-600 text-white" : "bg-white/95 text-ink hover:bg-white", coverBusy === photo.id && "opacity-60")} title="Usar como capa do anúncio">
                    {coverBusy === photo.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}{photo.category === "capa" ? "Capa atual" : "Definir capa"}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => void remove(photo.id)}
                  className="absolute right-1 top-1 rounded-md bg-white/90 p-1 text-red-600 opacity-0 shadow-sm transition group-hover:opacity-100"
                  aria-label="Remover foto"
                >
                  {removing === photo.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                </button>
                <p className="truncate bg-white px-1.5 py-1 text-[9px] text-muted">{photo.category}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Documentos ({documents.length})</p>
        {documents.length === 0 ? (
          <p className="mt-2 rounded-lg bg-paper/60 p-3 text-[11px] text-muted">
            Nenhum documento anexado. Armazene matrículas, plantas, projetos e mapas neste dossiê.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
            {documents.map((document) => {
              const Icon = docIcon(document.category);
              return (
                <li key={document.id} className="flex items-center gap-2 px-2.5 py-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-paper text-ink-soft">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-medium text-ink">{document.name}</p>
                    <p className="text-[9px] text-muted">
                      {document.category} · {Math.max(1, Math.round(document.size / 1024))} KB · {dateLabel(document.createdAt)}
                    </p>
                  </div>
                  <a
                    href={`${document.url}?download=1`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md p-1.5 text-ink-soft hover:bg-paper hover:text-leaf-600"
                    title="Baixar documento"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </a>
                  <button
                    type="button"
                    onClick={() => void remove(document.id)}
                    className="rounded-md p-1.5 text-red-500 hover:bg-red-50"
                    title="Remover documento"
                  >
                    {removing === document.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
