import { Body, Controller, Get, Header, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ConfigurationGuard, type ConfigurationRequest } from "./auth/configuration.guard";
import { FiscalConfigurationService, type ConfigurationInput } from "./application/fiscal-configuration.service";

@Controller("api/v1/setup/sunat")
@UseGuards(ConfigurationGuard)
export class FiscalConfigurationController {
  constructor(private readonly configuration: FiscalConfigurationService) {}
  @Get(":companyId/:environment")
  @Header("Cache-Control", "private, no-store")
  status(@Param("companyId") companyId: string, @Param("environment") environment: string, @Req() request: ConfigurationRequest) {
    return this.configuration.status(companyId, environment, request.headers.authorization!);
  }
  @Post(":companyId/:environment")
  @Header("Cache-Control", "private, no-store")
  save(@Param("companyId") companyId: string, @Param("environment") environment: string, @Body() input: ConfigurationInput, @Req() request: ConfigurationRequest) {
    return this.configuration.save(companyId, environment, input, request.headers.authorization!, request.user!.sub);
  }
}
