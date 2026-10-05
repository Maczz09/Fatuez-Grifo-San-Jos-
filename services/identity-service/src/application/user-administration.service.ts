import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  canDelegate,
  DefaultRolePermissions,
  RoleCodes,
  type AccessTokenClaims,
  type AccessScope,
  type RoleCode,
} from "@factuez/contracts";
import { PasswordService } from "./password.service";
import { PrismaService } from "../infrastructure/prisma.service";

export interface CreateUserInput {
  username: string;
  fullName: string;
  password: string;
  roles: RoleCode[];
  branchIds: string[];
  emissionPointIds: string[];
  series: string[];
}
export interface UpdateUserAccessInput {
  active?: boolean;
  roles?: RoleCode[];
  branchIds?: string[];
  emissionPointIds?: string[];
  series?: string[];
}
type UserRecord = {
  id: string;
  username: string;
  fullName: string;
  active: boolean;
  lastLoginAt: Date | null;
  roles: Array<{ role: { code: string; name: string } }>;
  emissionPoints: Array<{ emissionPointId: string }>;
  branches: Array<{ branchId: string }>;
  series: Array<{ series: string }>;
};
const includeAccess = {
  roles: { include: { role: true } },
  emissionPoints: true,
  branches: true,
  series: true,
} as const;
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class UserAdministrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
  ) {}

  async listUsers(actor: AccessTokenClaims) {
    const scope = actor.scope;
    const users = await this.prisma.user.findMany({
      where:
        scope.kind === "GLOBAL"
          ? {}
          : {
              branches: {
                some: { branchId: { in: scope.branchIds } },
                every: { branchId: { in: scope.branchIds } },
              },
              roles: { none: { role: { code: RoleCodes.ADMIN } } },
            },
      orderBy: { username: "asc" },
      include: includeAccess,
    });
    return (users as UserRecord[]).map((user) => ({
      ...this.view(user),
      editable: user.id !== actor.sub && this.canManage(actor, user),
    }));
  }

  async listRoles(actor: AccessTokenClaims) {
    const roles = await this.prisma.role.findMany({
      where: { active: true },
      orderBy: { code: "asc" },
    });
    return roles.map(
      (role: {
        id: string;
        code: string;
        name: string;
        description: string | null;
      }) => ({
        ...role,
        permissions: DefaultRolePermissions[role.code as RoleCode] ?? [],
        assignable:
          actor.scope.kind === "GLOBAL" ||
          canDelegate(actor, [role.code as RoleCode], actor.scope),
      }),
    );
  }

  async create(
    input: CreateUserInput,
    actor: AccessTokenClaims,
    authorization: string,
  ) {
    if (
      typeof input?.username !== "string" ||
      !/^[a-zA-Z0-9._-]{3,80}$/.test(input.username.trim())
    )
      throw new BadRequestException(
        "Usuario: entre 3 y 80 letras, números, puntos o guiones",
      );
    if (
      typeof input.fullName !== "string" ||
      !input.fullName.trim() ||
      input.fullName.trim().length > 160
    )
      throw new BadRequestException("Nombre completo inválido");
    this.validate(input);
    const scope = this.inputScope(input);
    if (!canDelegate(actor, input.roles, scope)) {
      await this.auditDenied(actor, "user.create", undefined);
      throw new ForbiddenException(
        "No puede delegar esos roles, sedes, puntos o series",
      );
    }
    await this.validateResources(input, authorization);
    const passwordHash = await this.passwords.hash(input.password);
    const roles = await this.resolveRoles(input.roles);
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const tx = transaction as unknown as PrismaService;
        const user = await tx.user.create({
          data: {
            username: input.username.trim(),
            fullName: input.fullName.trim(),
            passwordHash,
            roles: {
              create: roles.map((role) => ({
                roleId: role.id,
                assignedByUserId: actor.sub,
              })),
            },
            branches: {
              create: [...new Set(input.branchIds)].map((branchId) => ({
                branchId,
              })),
            },
            emissionPoints: {
              create: [...new Set(input.emissionPointIds)].map(
                (emissionPointId) => ({
                  emissionPointId,
                  assignedByUserId: actor.sub,
                }),
              ),
            },
            series: {
              create: [...new Set(input.series)].map((series) => ({ series })),
            },
          },
          include: includeAccess,
        });
        await tx.auditLog.create({
          data: {
            userId: actor.sub,
            action: "user.created",
            entityType: "User",
            entityId: user.id,
            metadata: { roles: input.roles, scope },
          },
        });
        return this.view(user as UserRecord);
      });
    } catch (error) {
      if ((error as { code?: string }).code === "P2002")
        throw new ConflictException("El nombre de usuario ya existe");
      throw error;
    }
  }

  async updateAccess(
    userId: string,
    input: UpdateUserAccessInput,
    actor: AccessTokenClaims,
    authorization: string,
  ) {
    if (!uuid.test(userId))
      throw new BadRequestException("Identificador inválido");
    if (userId === actor.sub)
      throw new BadRequestException("No puede modificar su propio acceso");
    if (
      !input ||
      !Object.keys(input).length ||
      Object.keys(input).some(
        (key) =>
          ![
            "active",
            "roles",
            "branchIds",
            "emissionPointIds",
            "series",
          ].includes(key),
      )
    )
      throw new BadRequestException("Cambio de acceso inválido");
    if (input.active !== undefined && typeof input.active !== "boolean")
      throw new BadRequestException("Estado inválido");
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const tx = transaction as unknown as PrismaService;
        await tx.$queryRawUnsafe(
          'SELECT "id" FROM "User" WHERE "id" = $1::uuid FOR UPDATE',
          userId,
        );
        const target = (await tx.user.findUnique({
          where: { id: userId },
          include: includeAccess,
        })) as UserRecord | null;
        if (!target || !this.canManage(actor, target))
          throw new NotFoundException("Usuario no disponible en su alcance");
        const before = this.view(target);
        const merged = {
          ...before,
          ...input,
          roles:
            input.roles ?? before.roles.map((role) => role.code as RoleCode),
        };
        this.validate(merged, !merged.active);
        if (!canDelegate(actor, merged.roles, this.inputScope(merged)))
          throw new ForbiddenException("Asignación fuera de sus facultades");
        // Revocar una cuenta no debe depender de Billing ni de maestros activos.
        // La reactivación sí verifica de nuevo todos los recursos.
        if (merged.active) await this.validateResources(merged, authorization);
        const roles = await this.resolveRoles(merged.roles);
        await tx.userRoleAssignment.deleteMany({ where: { userId } });
        await tx.userBranch.deleteMany({ where: { userId } });
        await tx.userEmissionPoint.deleteMany({ where: { userId } });
        await tx.userSeries.deleteMany({ where: { userId } });
        const updated = await tx.user.update({
          where: { id: userId },
          data: {
            active: merged.active,
            authVersion: { increment: 1 },
            roles: {
              create: roles.map((role) => ({
                roleId: role.id,
                assignedByUserId: actor.sub,
              })),
            },
            branches: {
              create: [...new Set(merged.branchIds)].map((branchId) => ({
                branchId,
              })),
            },
            emissionPoints: {
              create: [...new Set(merged.emissionPointIds)].map(
                (emissionPointId) => ({
                  emissionPointId,
                  assignedByUserId: actor.sub,
                }),
              ),
            },
            series: {
              create: [...new Set(merged.series)].map((series) => ({ series })),
            },
          },
          include: includeAccess,
        });
        await tx.refreshSession.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        const after = this.view(updated as UserRecord);
        await tx.auditLog.create({
          data: {
            userId: actor.sub,
            action: "user.access.updated",
            entityType: "User",
            entityId: userId,
            metadata: JSON.parse(JSON.stringify({ before, after })),
          },
        });
        return after;
      });
    } catch (error) {
      if (
        error instanceof ForbiddenException ||
        error instanceof NotFoundException
      )
        await this.auditDenied(actor, "user.access.update", userId);
      throw error;
    }
  }

  private auditDenied(
    actor: AccessTokenClaims,
    action: string,
    targetId?: string,
  ) {
    return this.prisma.auditLog.create({
      data: {
        userId: actor.sub,
        action: "access.delegation.denied",
        entityType: "User",
        entityId: targetId,
        metadata: { operation: action },
      },
    });
  }

  private canManage(actor: AccessTokenClaims, user: UserRecord) {
    const view = this.view(user);
    return canDelegate(
      actor,
      view.roles.map((role) => role.code as RoleCode),
      this.inputScope({
        ...view,
        roles: view.roles.map((role) => role.code as RoleCode),
      }),
    );
  }
  private inputScope(input: {
    roles: RoleCode[];
    branchIds: string[];
    emissionPointIds: string[];
    series: string[];
  }): AccessScope {
    return input.roles.includes(RoleCodes.ADMIN)
      ? { kind: "GLOBAL" }
      : {
          kind: "ASSIGNED",
          branchIds: input.branchIds,
          emissionPointIds: input.emissionPointIds,
          series: input.series,
        };
  }
  private validate(
    input: {
      roles: RoleCode[];
      branchIds: string[];
      emissionPointIds: string[];
      series: string[];
    },
    allowLegacy = false,
  ) {
    if (
      !Array.isArray(input.roles) ||
      !input.roles.length ||
      !input.roles.every((role) => Object.values(RoleCodes).includes(role))
    )
      throw new BadRequestException("Seleccione roles válidos");
    for (const ids of [input.branchIds, input.emissionPointIds]) {
      if (
        !Array.isArray(ids) ||
        ids.length > 100 ||
        ids.some((id) => typeof id !== "string" || !uuid.test(id))
      )
        throw new BadRequestException("Sedes o puntos inválidos");
    }
    if (
      !Array.isArray(input.series) ||
      input.series.length > 200 ||
      input.series.some(
        (value) =>
          typeof value !== "string" ||
          (!(uuid.test(value) && value === value.toLowerCase()) &&
            !(allowLegacy && /^[FB][A-Z0-9]{3}$/.test(value))),
      )
    )
      throw new BadRequestException("Series inválidas");
    if (!input.roles.includes(RoleCodes.ADMIN) && !input.branchIds.length)
      throw new BadRequestException("Asigne al menos una sede");
  }
  private async resolveRoles(codes: RoleCode[]) {
    const roles = await this.prisma.role.findMany({
      where: { code: { in: [...new Set(codes)] }, active: true },
    });
    if (roles.length !== new Set(codes).size)
      throw new BadRequestException("Rol no disponible");
    return roles;
  }
  private async validateResources(
    input: {
      roles: RoleCode[];
      branchIds: string[];
      emissionPointIds: string[];
      series: string[];
    },
    authorization: string,
  ) {
    if (input.roles.includes(RoleCodes.ADMIN)) return;
    // Billing es el único propietario de sedes y series. Identity conserva IDs externos,
    // nunca consulta ni escribe tablas de otra base de datos.
    let response: Response;
    try {
      response = await fetch(
        `${process.env.BILLING_INTERNAL_URL ?? "http://billing-service:3002"}/api/v1/documents/catalog/issuance`,
        {
          headers: { Authorization: authorization },
          signal: AbortSignal.timeout(4000),
        },
      );
    } catch {
      throw new ServiceUnavailableException(
        "No se pudieron verificar sedes y series. No se guardó el cambio.",
      );
    }
    if (!response.ok)
      throw new ServiceUnavailableException(
        "Catálogo de asignaciones no disponible",
      );
    const catalog = (await response.json()) as {
      branches: { id: string }[];
      emissionPoints: {
        id: string;
        branchId: string;
        series: { id: string; series: string }[];
      }[];
    };
    if (
      input.branchIds.some(
        (id) => !catalog.branches.some((branch) => branch.id === id),
      )
    )
      throw new BadRequestException("Sede no disponible");
    const points = catalog.emissionPoints.filter((point) =>
      input.branchIds.includes(point.branchId),
    );
    if (
      input.emissionPointIds.some(
        (id) => !points.some((point) => point.id === id),
      )
    )
      throw new BadRequestException(
        "El punto no pertenece a las sedes asignadas",
      );
    if (
      input.series.some(
        (series) =>
          !points.some(
            (point) =>
              input.emissionPointIds.includes(point.id) &&
              point.series.some((counter) => counter.id === series),
          ),
      )
    )
      throw new BadRequestException(
        "La serie no pertenece a los puntos asignados",
      );
  }
  private view(user: UserRecord) {
    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      active: user.active,
      lastLoginAt: user.lastLoginAt,
      roles: user.roles.map(({ role }) => ({
        code: role.code,
        name: role.name,
      })),
      branchIds: user.branches.map((item) => item.branchId),
      emissionPointIds: user.emissionPoints.map((item) => item.emissionPointId),
      series: user.series.map((item) => item.series),
    };
  }
}
