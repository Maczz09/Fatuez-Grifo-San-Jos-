import {
  Controller,
  Get,
  Header,
  Headers,
  Param,
  StreamableFile,
} from "@nestjs/common";
import { ArtifactDeliveryService } from "./application/artifact-delivery.service";

@Controller("api/v1/fiscal-artifacts")
export class FiscalArtifactsController {
  constructor(private readonly delivery: ArtifactDeliveryService) {}
  @Get(":documentId/:format")
  @Header("Cache-Control", "private, no-store")
  @Header("X-Content-Type-Options", "nosniff")
  async download(
    @Param("documentId") documentId: string,
    @Param("format") format: string,
    @Headers("authorization") authorization?: string,
  ) {
    const result = await this.delivery.download(
      documentId,
      format,
      authorization,
    );
    return new StreamableFile(result.bytes, {
      type: "application/pdf",
      disposition: `attachment; filename="${result.fileName}"`,
      length: result.bytes.length,
    });
  }
}
