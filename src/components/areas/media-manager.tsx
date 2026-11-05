"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  Camera,
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

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Falha ao ler arquivo"));
    reader.readAsDataURL(file);
  });
}

async function compressPhoto(file: File): Promise<{ data: string; mimeType: string; size: number; name: string }> {
  try {
    const bitmap = await createImageBitmap(file);
    const maxSize = 1600;
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas indisponível");
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob) throw new Error("compressão falhou");
    const buffer = await blob.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
    return { data: btoa(binary), mimeType: "image/jpeg", size: blob.size, name: file.name.replace(/\.[^.]+$/, "") + ".jpg" };
  } catch {
    const data = await fileToBase64(file);
    return { data, mimeType: file.type || "image/jpeg", size: file.size, name: file.name };
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

  const photos = media.filter((item) => item.kind === "photo");
  const documents = media.filter((item) => item.kind === "document");

  async function upload(files: FileList | null, kind: "photo" | "document") {
    if (!files || files.length === 0) return;
    setBusy(kind);
    setMessage(null);
    try {
      const items = [];
      for (const file of Array.from(files)) {
        if (file.size > 9 * 1024 * 1024) {
          throw new Error(`${file.name} excede 9 MB.`);
        }
        if (kind === "photo") {
          const compressed = await compressPhoto(file);
          items.push({
            kind,
            category: "fachada",
            name: compressed.name,
            mimeType: compressed.mimeType,
            data: compressed.data,
            caption: "",
          });
        } else {
          items.push({
            kind,
            category,
            name: file.name,
            mimeType: file.type || "application/octet-stream",
            data: await fileToBase64(file),
            caption: "",
          });
        }
      }
      const response = await fetch(`/api/areas/${areaId}/media`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Falha no upload");
      setMessage({ tone: "ok", text: `${items.length} arquivo(s) adicionados ao dossiê.` });
      if (kind === "photo" && photoRef.current) photoRef.current.value = "";
      if (kind === "document" && docRef.current) docRef.current.value = "";
      router.refresh();
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Falha no upload." });
    } finally {
      setBusy(null);
    }
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
              <p className="text-[10px] text-muted">JPG/PNG · compressão automática para apresentação</p>
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
              <p className="text-[10px] text-muted">Matrícula, planta, projeto, mapa, laudo, KMZ · até 9 MB</p>
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
              accept=".pdf,.doc,.docx,.xls,.xlsx,.kml,.kmz,.zip,.txt,image/*"
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
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Fotos ({photos.length})</p>
        {photos.length === 0 ? (
          <p className="mt-2 rounded-lg bg-paper/60 p-3 text-[11px] text-muted">Nenhuma foto cadastrada.</p>
        ) : (
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {photos.map((photo) => (
              <div key={photo.id} className="group relative overflow-hidden rounded-lg border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt={photo.name} className="h-24 w-full object-cover" />
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
