"use client";
import { useEffect, useRef, useState } from 'react';
import { Printer, ExternalLink } from 'lucide-react';
import { Button } from '@factuez/ui/components/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@factuez/ui/components/dialog';
import { useWorkspace } from './provider';

export const PRINTER_COMPATIBILITY = 'Imprime en cualquier marca con controlador instalado: USB, red o compartida. Selecciona la impresora en el diálogo del sistema; también puedes guardar como PDF.';
export const PRINT_GUIDANCE = {
  ticket: 'Ticket de 80 mm: usa una térmica que admita ese ancho, tamaño real (100 %) y sin ajustar a página. Para otro tamaño de papel, utiliza A4 o ajusta en tu visor y comprueba que texto y QR sean legibles.',
  a4: 'PDF A4: compatible con impresoras láser, de tinta o multifunción que admitan este papel. Selecciona A4 y tamaño real (100 %); si utilizas otro tamaño, ajusta en el visor y revisa el resultado.',
} as const;

export async function assertPrintablePdf(blob: Blob) {
  if (blob.type.split(';')[0] !== 'application/pdf' || blob.size < 5 || blob.size > 10 * 1024 * 1024 ||
    await blob.slice(0, 5).text() !== '%PDF-') throw new Error('El archivo no es un PDF válido para imprimir');
}

/** Siempre recupera el PDF con la sesión. Nunca imprime la página ni publica el JWT. */
export function PdfPrintButton({ path, format, label: customLabel, disabled = false }: { path: string; format: 'ticket' | 'a4'; label?: string; disabled?: boolean }) {
  const { apiBlob, user } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string>();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    if (!open || !user) return;
    const controller = new AbortController(); let objectUrl: string | undefined;
    setUrl(undefined); setReady(false); setError(undefined); setNotice(undefined);
    void (async () => {
      try {
        const blob = await apiBlob(path, AbortSignal.any([controller.signal, AbortSignal.timeout(25000)]));
        await assertPrintablePdf(blob);
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob); setUrl(objectUrl);
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'No se pudo preparar la impresión');
      }
    })();
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [open, path, apiBlob, user]);
  useEffect(() => { if (!user) setOpen(false); }, [user]);
  const label = customLabel ?? (format === 'ticket' ? 'Imprimir ticket 80 mm' : 'Imprimir A4');
  function print() {
    try {
      if (!url) return;
      if (!ready || !frame.current?.contentWindow || frame.current.contentWindow.location.href === 'about:blank') throw new Error('Visor no integrado');
      frame.current.contentWindow.focus(); frame.current.contentWindow.print();
      setNotice('Selecciona la impresora y confirma en el diálogo del navegador. Esto no confirma una impresión física.');
    } catch {
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
      setNotice('Se solicitó abrir el PDF. Si el navegador bloquea la apertura o sólo descarga el archivo, abre el PDF descargado en Chrome, Edge o tu lector habitual y usa Imprimir (Ctrl+P). La apertura no está confirmada por el sistema.');
    }
  }
  return <>
    <Button variant="outline" disabled={disabled} onClick={() => setOpen(true)}><Printer className="size-4" />{label}</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader><DialogTitle>{label}</DialogTitle><DialogDescription>
          Documento de desarrollo, sin validez tributaria. {PRINT_GUIDANCE[format]} {PRINTER_COMPATIBILITY} La aplicación no confirma una impresión física ni controla directamente la impresora.
        </DialogDescription></DialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {!url && !error && <p role="status">Preparando PDF protegido…</p>}
        {url && <><iframe ref={frame} title={`Vista previa · ${label}`} src={url} onLoad={() => setReady(true)} className="h-[55vh] w-full rounded-md border" /><p className="text-xs text-muted-foreground">¿Vista previa vacía? Este navegador puede no incluir visor PDF. Usa Imprimir o Abrir en visor; el archivo ya se recuperó con tu sesión.</p></>}
        {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
        <DialogFooter>
          {url && <Button variant="outline" asChild><a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-4" />Abrir en visor</a></Button>}
          <Button disabled={!url} onClick={print}><Printer className="size-4" />Imprimir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
