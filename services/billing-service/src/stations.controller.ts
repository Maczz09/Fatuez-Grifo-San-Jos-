import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Param,
  Post,
  Patch,
  Req,
  UseGuards,
} from "@nestjs/common";
import { PermissionCodes } from "@factuez/contracts";
import { PrismaService } from "./infrastructure/prisma.service";
import {
  JwtPermissionGuard,
  RequiredPermissions,
  type AuthenticatedRequest,
} from "./auth/jwt-permission.guard";

@Controller("api/v1/stations")
@UseGuards(JwtPermissionGuard)
export class StationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post("issuers")
  @RequiredPermissions(PermissionCodes.SETUP_MANAGE)
  async createIssuer(
    @Body()
    body: {
      ruc: string;
      legalName: string;
      taxAddress: string;
      ubigeo: string;
    },
    @Req() request: AuthenticatedRequest,
  ) {
    this.requireGlobal(request);
    if (
      typeof body?.ruc !== "string" ||
      !/^\d{11}$/.test(body.ruc) ||
      typeof body.legalName !== "string" ||
      !body.legalName.trim() ||
      body.legalName.length > 200 ||
      typeof body.taxAddress !== "string" ||
      !body.taxAddress.trim() ||
      body.taxAddress.length > 300 ||
      typeof body.ubigeo !== "string" ||
      !/^\d{6}$/.test(body.ubigeo)
    )
      throw new BadRequestException(
        "Revise RUC, razón social, dirección fiscal y ubigeo",
      );
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const tx = transaction as unknown as PrismaService;
        const issuer = await tx.companySettings.create({
          data: {
            ruc: body.ruc,
            legalName: body.legalName.trim(),
            taxAddress: body.taxAddress.trim(),
            ubigeo: body.ubigeo,
            companyType: "Por configurar",
            economicActivities: [],
            contactEmails: [],
            environment: "BETA",
          },
        });
        await tx.configurationAudit.create({
          data: {
            actorId: request.user!.sub,
            action: "issuer.created",
            entityId: String(issuer.id),
            metadata: {
              companyId: issuer.id,
              ruc: issuer.ruc,
              environment: issuer.environment,
            },
          },
        });
        return {
          id: issuer.id,
          ruc: issuer.ruc,
          legalName: issuer.legalName,
          environment: issuer.environment,
        };
      });
    } catch (error) {
      this.conflict(error);
    }
  }

  @Patch(":id/issuer")
  @RequiredPermissions(PermissionCodes.SETUP_MANAGE)
  async assignIssuer(
    @Param("id") branchId: string,
    @Body() body: { companyId: number },
    @Req() request: AuthenticatedRequest,
  ) {
    this.requireGlobal(request);
    if (
      !/^[0-9a-f-]{36}$/i.test(branchId) ||
      !Number.isSafeInteger(body?.companyId) ||
      body.companyId < 1
    )
      throw new BadRequestException("Sede o emisor inválidos");
    return this.prisma.$transaction(async (transaction) => {
      const tx = transaction as unknown as PrismaService;
      // También crear un punto toma este lock: no se permite una reasignación concurrente.
      await tx.$queryRawUnsafe(
        'SELECT "id" FROM "Branch" WHERE "id" = $1::uuid FOR UPDATE',
        branchId,
      );
      const branch = await tx.branch.findUnique({ where: { id: branchId } });
      if (!branch?.active) throw new BadRequestException("Sede no disponible");
      if (branch.companyId === body.companyId) return branch;
      if (
        !(await tx.companySettings.findUnique({
          where: { id: body.companyId },
        }))
      )
        throw new BadRequestException("Emisor no disponible");
      if (await tx.emissionPoint.count({ where: { branchId } }))
        throw new ConflictException(
          "Esta sede ya tiene puntos de emisión. No se permite cambiar su RUC ni trasladar su historial; requiere una transición fiscal controlada.",
        );
      const updated = await tx.branch.update({
        where: { id: branchId },
        data: { companyId: body.companyId },
      });
      await tx.configurationAudit.create({
        data: {
          actorId: request.user!.sub,
          action: "branch.issuer.changed",
          entityId: branchId,
          metadata: {
            beforeCompanyId: branch.companyId,
            afterCompanyId: body.companyId,
          },
        },
      });
      return updated;
    });
  }

  @Post()
  @RequiredPermissions(PermissionCodes.SETUP_MANAGE)
  async create(
    @Body()
    body: { companyId: number; code: string; name: string; address?: string },
    @Req() request: AuthenticatedRequest,
  ) {
    this.requireGlobal(request);
    this.validate(body);
    if (!Number.isSafeInteger(body.companyId) || body.companyId < 1)
      throw new BadRequestException("Seleccione un emisor válido");
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const tx = transaction as unknown as PrismaService;
        if (
          !(await tx.companySettings.findUnique({
            where: { id: body.companyId },
          }))
        )
          throw new BadRequestException("Emisor no disponible");
        const branch = await tx.branch.create({
          data: {
            companyId: body.companyId,
            code: body.code.trim().toUpperCase(),
            name: body.name.trim(),
            address: body.address?.trim(),
          },
        });
        await tx.configurationAudit.create({
          data: {
            actorId: request.user!.sub,
            action: "branch.created",
            entityId: branch.id,
            metadata: {
              companyId: branch.companyId,
              code: branch.code,
              name: branch.name,
            },
          },
        });
        return branch;
      });
    } catch (error) {
      this.conflict(error);
    }
  }

  @Post(":id/points")
  @RequiredPermissions(PermissionCodes.SERIES_MANAGE)
  async point(
    @Param("id") branchId: string,
    @Body()
    body: {
      code: string;
      name: string;
      invoiceSeries: string;
      receiptSeries: string;
    },
    @Req() request: AuthenticatedRequest,
  ) {
    this.requireGlobal(request);
    this.validate(body);
    if (
      !/^[0-9a-f-]{36}$/i.test(branchId) ||
      !/^F[A-Z0-9]{3}$/.test(body.invoiceSeries) ||
      !/^B[A-Z0-9]{3}$/.test(body.receiptSeries)
    )
      throw new BadRequestException("Sede o series inválidas");
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const tx = transaction as unknown as PrismaService;
        await tx.$queryRawUnsafe(
          'SELECT "id" FROM "Branch" WHERE "id" = $1::uuid FOR UPDATE',
          branchId,
        );
        const branch = await tx.branch.findUnique({ where: { id: branchId } });
        if (!branch?.active)
          throw new BadRequestException("Sede no disponible");
        const point = await tx.emissionPoint.create({
          data: {
            companyId: branch.companyId,
            branchId,
            code: body.code.trim().toUpperCase(),
            name: body.name.trim(),
            counters: {
              create: [
                { documentType: "INVOICE", series: body.invoiceSeries },
                { documentType: "SALES_RECEIPT", series: body.receiptSeries },
              ],
            },
          },
          include: { counters: true },
        });
        await tx.configurationAudit.create({
          data: {
            actorId: request.user!.sub,
            action: "emission-point.created",
            entityId: point.id,
            metadata: {
              branchId,
              code: point.code,
              series: [body.invoiceSeries, body.receiptSeries],
            },
          },
        });
        return {
          id: point.id,
          companyId: point.companyId,
          code: point.code,
          name: point.name,
          branchId,
          series: point.counters.map((counter) => ({
            id: counter.id,
            documentType: counter.documentType,
            series: counter.series,
          })),
        };
      });
    } catch (error) {
      this.conflict(error);
    }
  }

  private requireGlobal(request: AuthenticatedRequest) {
    if (request.user?.scope.kind !== "GLOBAL")
      throw new ForbiddenException(
        "La configuración de sedes y series requiere administrador general",
      );
  }
  private validate(body: { code: string; name: string; address?: string }) {
    if (
      typeof body?.code !== "string" ||
      !/^[A-Z0-9_-]{2,20}$/i.test(body.code.trim()) ||
      typeof body.name !== "string" ||
      !body.name.trim() ||
      body.name.length > 120 ||
      (body.address !== undefined &&
        (typeof body.address !== "string" || body.address.length > 300))
    )
      throw new BadRequestException("Código, nombre o dirección inválidos");
  }
  private conflict(error: unknown): never {
    if ((error as { code?: string }).code === "P2002")
      throw new ConflictException(
        "El RUC, código o serie ya existe para este emisor. No se modificó ningún correlativo.",
      );
    throw error;
  }
}
