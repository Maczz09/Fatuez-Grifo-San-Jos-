import { createHash, randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import {
  allowsResource,
  EventNames,
  type AccessScope,
  type DocumentIssuedEventV1,
  type FiscalDocumentTypeCode,
  type FiscalPaymentTermsSnapshot,
} from "@factuez/contracts";
import { validateInvoicePaymentTerms } from '@factuez/sunat-core';
import { calculateDocumentTotals } from "./totals";
import { PrismaService } from "../infrastructure/prisma.service";

export interface IssueDocumentInput {
  emissionPointId: string;
  shiftId?: string;
  documentType: "INVOICE" | "SALES_RECEIPT";
  series: string;
  issueDate?: string;
  currencyCode?: "PEN" | "USD";
  paymentTerms?: FiscalPaymentTermsSnapshot;
  customer: {
    identityType: string;
    identityNumber: string;
    legalName: string;
    address?: string;
    email?: string;
  };
  lines: Array<{
    productId?: string;
    productCode?: string;
    description: string;
    unitCode: string;
    quantity: string;
    unitPriceWithTax: string;
    taxAffectationCode: string;
    igvRate: string;
  }>;
}

@Injectable()
export class IssueDocumentService {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    input: IssueDocumentInput,
    context: {
      idempotencyKey: string;
      userId: string;
      correlationId: string;
      scope: AccessScope;
    },
  ) {
    if (!context.idempotencyKey)
      throw new Error("Idempotency-Key es obligatorio");
    if (!input || typeof input !== 'object' || Object.keys(input).some(key => ![
      'emissionPointId', 'shiftId', 'documentType', 'series', 'issueDate', 'currencyCode', 'paymentTerms', 'customer', 'lines',
    ].includes(key))) throw new BadRequestException('Campos no soportados; descuentos/anticipos/impuestos especiales requieren otro perfil');
    if (
      !Array.isArray(input?.lines) ||
      !input.lines.length ||
      input.lines.length > 100
    )
      throw new BadRequestException("Se requieren entre 1 y 100 ítems");
    if (!["INVOICE", "SALES_RECEIPT"].includes(input.documentType))
      throw new BadRequestException("Tipo no habilitado en esta etapa");
    if (!input.customer || typeof input.customer !== 'object' || Array.isArray(input.customer) ||
      Object.keys(input.customer).some(key => !['identityType', 'identityNumber', 'legalName', 'address', 'email'].includes(key)))
      throw new BadRequestException('Campos de cliente no soportados');
    if (
      typeof input.customer?.legalName !== "string" ||
      !input.customer.legalName.trim() ||
      input.customer.legalName.length > 200
    )
      throw new BadRequestException("Falta el nombre del cliente");
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        input.emissionPointId,
      ) ||
      !/^[FB][A-Z0-9]{3}$/.test(input.series)
    )
      throw new BadRequestException("Punto o serie inválidos");
    if (
      input.currencyCode !== undefined &&
      !["PEN", "USD"].includes(input.currencyCode)
    )
      throw new BadRequestException("Moneda inválida");
    if (
      input.issueDate !== undefined &&
      !Number.isFinite(Date.parse(input.issueDate))
    )
      throw new BadRequestException("Fecha inválida");
    for (const line of input.lines) {
      if (!line || typeof line !== 'object' || Array.isArray(line) || Object.keys(line).some(key => ![
        'productId', 'productCode', 'description', 'unitCode', 'quantity', 'unitPriceWithTax', 'taxAffectationCode', 'igvRate',
      ].includes(key))) throw new BadRequestException('Campos de ítem no soportados; no se omiten descuentos o impuestos especiales');
      if (line && (line.taxAffectationCode !== '10' || line.igvRate !== '18'))
        throw new BadRequestException('Perfil de desarrollo: venta gravada con IGV 18%; otras afectaciones aún no habilitadas');
      if (
        !line ||
        typeof line.description !== "string" ||
        !line.description.trim() ||
        line.description.length > 250 ||
        !/^[A-Z0-9]{2,3}$/.test(line.unitCode) ||
        ![line.quantity, line.unitPriceWithTax].every(
          (value) =>
            typeof value === "string" &&
            /^\d{1,12}(\.\d{1,6})?$/.test(value) &&
            Number(value) > 0,
        ) ||
        !["10", "20", "30"].includes(line.taxAffectationCode) ||
        line.igvRate !== (line.taxAffectationCode === "10" ? "18" : "0")
      )
        throw new BadRequestException(
          "Ítems inválidos: revise descripción, unidad, cantidades, precio y afectación",
        );
    }
    if (
      input.documentType === "INVOICE" &&
      !/^\d{11}$/.test(input.customer.identityNumber)
    )
      throw new BadRequestException("La factura requiere RUC de 11 dígitos");
    const requestHash = createHash("sha256")
      .update(JSON.stringify(input))
      .digest("hex");

    return this.prisma.$transaction(async (transaction) => {
      // Prisma 7 genera el tipo del cliente transaccional sin delegates al
      // extender PrismaClient dinámicamente; en runtime conserva la misma API.
      const tx = transaction as unknown as PrismaService;
      const point = await tx.emissionPoint.findUnique({
        where: { id: input.emissionPointId },
        include: { branch: true },
      });
      if (
        !point?.active ||
        !point.branch?.active ||
        !point.branchId ||
        point.companyId !== point.branch.companyId ||
        !allowsResource(context.scope, point.branchId, point.id)
      ) {
        throw new ForbiddenException("Sede, punto o serie no autorizados");
      }
      const counter = await tx.seriesCounter.findUnique({
        where: {
          companyId_documentType_series: {
            companyId: point.companyId,
            documentType: input.documentType,
            series: input.series,
          },
        },
      });
      if (
        !counter?.active ||
        counter.emissionPointId !== point.id ||
        !allowsResource(context.scope, point.branchId, point.id, counter.id)
      )
        throw new ForbiddenException("Sede, punto o serie no autorizados");

      const prior = await tx.idempotencyRecord.findUnique({
        where: { key: context.idempotencyKey },
      });
      if (prior && prior.requestHash !== requestHash)
        throw new ConflictException(
          "Idempotency-Key reutilizada con otro contenido",
        );
      if (prior?.documentId)
        return tx.document.findUniqueOrThrow({
          where: { id: prior.documentId },
        });

      const company = await tx.companySettings.findUniqueOrThrow({
        where: { id: point.companyId },
      });
      if (company.environment !== 'BETA') throw new BadRequestException('Desarrollo sólo BETA: producción bloqueada');
      const calculated = calculateDocumentTotals(input.lines);
      const issueDate = input.issueDate ?? new Date().toISOString();
      const paymentIssues = validateInvoicePaymentTerms({ paymentTerms: input.paymentTerms,
        documentTypeCode: input.documentType === 'INVOICE' ? '01' : '03', issueDate,
        currencyCode: input.currencyCode ?? 'PEN', totals: calculated.totals },
        { mode: /^00\d{9}$/.test(company.ruc) ? 'LOCAL_DEVELOPMENT' : 'REAL_PREPARATION' });
      if (paymentIssues.length) throw new BadRequestException(paymentIssues.map(issue => issue.message).join('; '));
      const updated = await tx.seriesCounter.update({
        where: { id: counter.id },
        data: { nextNumber: { increment: 1 } },
      });
      const number = updated.nextNumber - 1n;
      const documentId = randomUUID();
      const eventId = randomUUID();
      const typeCode: FiscalDocumentTypeCode =
        input.documentType === "INVOICE" ? "01" : "03";
      const fullNumber = `${input.series}-${number}`;
      const snapshot = {
        companyId: company.id,
        branchId: point.branchId,
        environment: company.environment,
        documentId,
        documentTypeCode: typeCode,
        series: input.series,
        number: number.toString(),
        fullNumber,
        issueDate,
        currencyCode: input.currencyCode ?? "PEN",
        operationTypeCode: "0101",
        issuer: {
          identityType: "6",
          identityNumber: company.ruc,
          legalName: company.legalName,
          tradeName: company.tradeName ?? undefined,
          address: company.taxAddress,
          ubigeo: company.ubigeo,
          establishmentCode: point.code,
        },
        customer: { identityType: input.customer.identityType, identityNumber: input.customer.identityNumber,
          legalName: input.customer.legalName, ...(input.customer.address ? { address: input.customer.address } : {}) },
        ...(input.paymentTerms ? { paymentTerms: input.paymentTerms } : {}),
        lines: calculated.lines,
        totals: calculated.totals,
      } as const;
      const event: DocumentIssuedEventV1 = {
        eventId,
        eventName: EventNames.documentIssued,
        occurredAt: new Date().toISOString(),
        correlationId: context.correlationId,
        producer: "billing-service",
        payload: snapshot,
      };

      const document = await tx.document.create({
        data: {
          id: documentId,
          companyId: company.id,
          seriesCounterId: counter.id,
          type: input.documentType,
          status: "ISSUED",
          sunatStatus: "QUEUED",
          series: input.series,
          number,
          fullNumber,
          issueDate,
          currencyCode: input.currencyCode ?? "PEN",
          operationTypeCode: "0101",
          emissionPointId: point.id,
          shiftId: input.shiftId,
          createdByUserId: context.userId,
          customerIdentityType: input.customer.identityType,
          customerIdentityNumber: input.customer.identityNumber,
          customerLegalName: input.customer.legalName,
          customerAddress: input.customer.address,
          customerEmail: input.customer.email,
          taxableAmount: calculated.totals.taxableAmount,
          igvAmount: calculated.totals.igvAmount,
          payableAmount: calculated.totals.payableAmount,
          immutableSnapshot: JSON.parse(JSON.stringify(snapshot)),
          items: {
            create: calculated.lines.map((line, index) => ({
              lineNumber: line.lineNumber,
              productId: input.lines[index].productId,
              internalCode: line.productCode,
              description: line.description,
              unitCode: line.unitCode,
              quantity: line.quantity,
              unitValue: line.unitValue,
              unitPriceWithTax: line.unitPriceWithTax,
              discountAmount: 0,
              lineExtensionAmount: line.lineExtensionAmount,
              taxAffectationCode: line.taxAffectationCode,
              igvRate: line.igvRate,
              igvAmount: line.igvAmount,
              iscAmount: 0,
              totalAmount: line.totalAmount,
            })),
          },
        },
      });
      await tx.outboxEvent.create({
        data: {
          id: eventId,
          eventType: event.eventName,
          aggregateId: documentId,
          payload: JSON.parse(JSON.stringify(event)),
        },
      });
      await tx.idempotencyRecord.create({
        data: {
          key: context.idempotencyKey,
          requestHash,
          documentId,
          responseCode: 202,
          responseBody: { documentId, fullNumber },
          expiresAt: new Date(Date.now() + 86_400_000),
        },
      });
      return document;
    });
  }
}
