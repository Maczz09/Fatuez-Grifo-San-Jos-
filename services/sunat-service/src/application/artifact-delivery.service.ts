import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import type { FiscalDocumentSnapshot } from "@factuez/contracts";
import { renderLocalDocumentPdf, type PrintFormat } from "@factuez/pdf-renderer";
import { isDeepStrictEqual } from "node:util";
import { ArtifactStore } from "../infrastructure/artifact-store";
import { PrismaService } from "../infrastructure/prisma.service";

@Injectable()
export class ArtifactDeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly store: ArtifactStore,
  ) {}
  async download(documentId: string, format: string, authorization?: string) {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        documentId,
      ) ||
      !["ticket", "a4"].includes(format)
    )
      throw new BadRequestException("Documento o formato inválido");
    if (
      !authorization ||
      !/^Bearer [A-Za-z0-9_.-]{1,8192}$/i.test(authorization)
    )
      throw new UnauthorizedException("Se requiere un access token Bearer");
    // Billing valida permisos, alcance sede/punto/serie y revocación en Identity.
    // No se consulta su base ni se confía en IDs o RUC enviados por el cliente.
    let response: Response;
    try {
      response = await fetch(
        `${process.env.BILLING_INTERNAL_URL ?? "http://billing-service:3002"}/api/v1/documents/${documentId}`,
        {
          headers: {
            Authorization: authorization,
            Accept: "application/json",
            "Cache-Control": "no-store",
          },
          signal: AbortSignal.timeout(5000),
          redirect: "error",
        },
      );
    } catch {
      throw new ServiceUnavailableException(
        "No se pudo verificar el acceso al documento",
      );
    }
    if (response.status === 401)
      throw new UnauthorizedException("Inicie sesión nuevamente");
    if (response.status === 403)
      throw new ForbiddenException("Documento no autorizado");
    if (response.status === 404)
      throw new NotFoundException("Documento no disponible en su alcance");
    if (!response.ok)
      throw new ServiceUnavailableException(
        "No se pudo verificar el acceso al documento",
      );
    let permitted: { id: string; immutableSnapshot: FiscalDocumentSnapshot };
    try {
      permitted = (await response.json()) as typeof permitted;
    } catch {
      throw new ServiceUnavailableException(
        "Respuesta de autorización inválida",
      );
    }
    if (
      permitted.id !== documentId ||
      permitted.immutableSnapshot?.documentId !== documentId
    )
      throw new ServiceUnavailableException(
        "Respuesta de autorización inconsistente",
      );
    const document = await this.prisma.fiscalDocument.findUnique({
      where: { documentId },
    });
    if (!document)
      throw new ConflictException(
        "PDF en preparación. Reintente en unos segundos",
      );
    const snapshot = permitted.immutableSnapshot;
    if (
      document.issuerRuc !== snapshot.issuer.identityNumber ||
      document.environment !== snapshot.environment ||
      document.series !== snapshot.series ||
      document.number !== BigInt(snapshot.number) ||
      document.documentType !== snapshot.documentTypeCode ||
      !isDeepStrictEqual(document.immutablePayload, JSON.parse(JSON.stringify(snapshot)))
    )
      throw new ConflictException(
        "Contexto fiscal inconsistente; requiere revisión",
      );
    if (!["QUEUED", "BUILDING"].includes(document.status))
      throw new ConflictException(
        "El documento requiere representación fiscal; no se entrega el PDF local de prueba",
      );
    const kind = format === "ticket" ? "PDF_TICKET_80MM" : "PDF_A4";
    const artifact = await this.prisma.documentArtifact.findUnique({
      where: { documentId_kind: { documentId, kind } },
    });
    if (!artifact)
      throw new ConflictException(
        "PDF en preparación. Reintente en unos segundos",
      );
    let bytes: Buffer;
    try {
      await this.store.read(documentId, artifact);
      // Sólo representación local: actualizar marcas sin tocar originales,
      // snapshot, correlativo, XML ni colas. Nunca para documentos fiscales.
      bytes = await renderLocalDocumentPdf(snapshot, format as PrintFormat);
    } catch {
      throw new ServiceUnavailableException(
        "No se pudo verificar el archivo. Solicite revisión al administrador",
      );
    }
    return {
      bytes,
      fileName: `${document.issuerRuc}-${document.documentType}-${document.series}-${document.number}-${format}-PRUEBA.pdf`,
    };
  }
}
