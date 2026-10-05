import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { PermissionCodes } from "@factuez/contracts";
import {
  type CreateUserInput,
  type UpdateUserAccessInput,
  UserAdministrationService,
} from "./application/user-administration.service";
import {
  IdentityPermissionGuard,
  RequiredPermissions,
  type AuthenticatedRequest,
} from "./auth/identity-permission.guard";

@Controller("api/v1")
@UseGuards(IdentityPermissionGuard)
export class UsersController {
  constructor(private readonly users: UserAdministrationService) {}

  @Get("roles")
  @RequiredPermissions(PermissionCodes.ROLE_MANAGE)
  roles(@Req() request: AuthenticatedRequest) {
    return this.users.listRoles(request.user!);
  }

  @Get("users")
  @RequiredPermissions(PermissionCodes.USER_MANAGE)
  usersList(@Req() request: AuthenticatedRequest) {
    return this.users.listUsers(request.user!);
  }

  @Post("users")
  @RequiredPermissions(PermissionCodes.USER_MANAGE, PermissionCodes.ROLE_MANAGE)
  create(@Body() body: CreateUserInput, @Req() request: AuthenticatedRequest) {
    return this.users.create(
      body,
      request.user!,
      request.headers.authorization as string,
    );
  }

  @Patch("users/:id/access")
  @RequiredPermissions(PermissionCodes.USER_MANAGE, PermissionCodes.ROLE_MANAGE)
  updateAccess(
    @Param("id") userId: string,
    @Body() body: UpdateUserAccessInput,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.users.updateAccess(
      userId,
      body,
      request.user!,
      request.headers.authorization as string,
    );
  }
}
