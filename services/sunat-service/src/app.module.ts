import { Module } from "@nestjs/common";
import { DocumentIssuedConsumer } from "./application/document-issued.consumer";
import { HealthController } from "./health.controller";
import { ArtifactStore } from "./infrastructure/artifact-store";
import { PrismaService } from "./infrastructure/prisma.service";
import { StatusOutboxPublisher } from "./infrastructure/status-outbox.publisher";
import { FiscalArtifactsController } from "./fiscal-artifacts.controller";
import { ArtifactDeliveryService } from "./application/artifact-delivery.service";
import { FiscalConfigurationController } from "./fiscal-configuration.controller";
import { FiscalConfigurationService } from "./application/fiscal-configuration.service";
import { SecretVault } from "./infrastructure/crypto/secret-vault";
import { ConfigurationGuard } from "./auth/configuration.guard";
import { CertificateInspectionService } from "./infrastructure/crypto/certificate-inspection.service";
import { LocalXmlWorkerService } from "./infrastructure/crypto/local-xml-worker.service";
import { LocalXmlValidationService } from "./application/local-xml-validation.service";
import { LocalXmlValidationController } from "./local-xml-validation.controller";
import { FiscalCircuitQaService } from './application/fiscal-circuit-qa.service';
import { FiscalCircuitQaController } from './fiscal-circuit-qa.controller';
import { XsdValidationService } from './infrastructure/sunat/xsd-validation.service';
import { FiscalBatchQaService } from './application/fiscal-batch-qa.service';
import { FiscalBatchQaController } from './fiscal-batch-qa.controller';
import { BatchQaWorkerService } from './infrastructure/crypto/batch-qa-worker.service';
import { NotesQaService, NOTES_QA_PDF_RENDERER, type NotesQaPdfRenderer } from './application/notes-qa.service';
import { NotesQaRepository } from './application/notes-qa.repository';
import { NotesQaSigningService } from './application/notes-qa-signing.service';
import { NotesQaController } from './notes-qa.controller';
import { GreQaController } from './gre-qa.controller';
import { GreQaService } from './application/gre-qa.service';
import { GreQaSigningService } from './application/gre-qa-sign.service';
import { FiscalReadinessController } from './fiscal-readiness.controller';
import { FiscalReadinessService } from './application/fiscal-readiness.service';
import { CertificateTrustService } from './infrastructure/crypto/certificate-trust.service';
import { LocalEmissionWorkflowService } from './application/local-emission-workflow.service';
import { renderLocalDocumentPdf } from '@factuez/pdf-renderer';
import { BetaIssuanceService } from './application/beta-issuance.service';
import { BetaIssuanceRepository } from './application/beta-issuance.repository';
import { BetaXmlWorkerService } from './infrastructure/crypto/beta-xml-worker.service';
import { CdrSignatureTrustService } from './infrastructure/crypto/cdr-signature-trust.service';
import { NotesTransportQaService } from './application/notes-transport-qa.service';
import { BetaSupplementService } from './application/beta-supplement.service';
import { BetaSupplementRepository } from './application/beta-supplement.repository';
import { BetaFiscalPackageWorkerService } from './infrastructure/crypto/beta-fiscal-package-worker.service';
import { FiscalRulesPreviewController } from './fiscal-rules-preview.controller';
import { SupplementTrackingController } from './supplement-tracking.controller';
import { SupplementTrackingService } from './application/supplement-tracking.service';
import { BetaSupplementEvidenceConsumer } from './application/beta-supplement-evidence.consumer';
import { BetaSupplementCommandConsumer } from './application/beta-supplement-command.consumer';
import { FiscalFinancialPreviewController } from './fiscal-financial-preview.controller';

@Module({
  controllers: [HealthController, FiscalArtifactsController, FiscalConfigurationController, LocalXmlValidationController, FiscalCircuitQaController, FiscalBatchQaController, NotesQaController, GreQaController, FiscalReadinessController, FiscalRulesPreviewController, SupplementTrackingController, FiscalFinancialPreviewController],
  providers: [
    PrismaService,
    ArtifactStore,
    DocumentIssuedConsumer,
    StatusOutboxPublisher,
    ArtifactDeliveryService,
    FiscalConfigurationService,
    SecretVault,
    ConfigurationGuard,
    CertificateInspectionService,
    LocalXmlWorkerService,
    LocalXmlValidationService,
    FiscalCircuitQaService,
    LocalEmissionWorkflowService,
    XsdValidationService,
    FiscalBatchQaService, BatchQaWorkerService,
    NotesQaService, NotesQaRepository, NotesQaSigningService, NotesTransportQaService,
    { provide: NOTES_QA_PDF_RENDERER, useValue: { render: (note, format, proof) => renderLocalDocumentPdf(note, format, { digestValue: proof.digestValue, status: 'SIGNED_LOCAL' }) } satisfies NotesQaPdfRenderer },
    GreQaService, GreQaSigningService,
    FiscalReadinessService, CertificateTrustService,
    BetaIssuanceRepository, BetaIssuanceService, BetaXmlWorkerService, CdrSignatureTrustService,
    BetaSupplementRepository, BetaSupplementService, BetaFiscalPackageWorkerService,
    SupplementTrackingService, BetaSupplementEvidenceConsumer, BetaSupplementCommandConsumer,
  ],
})
export class AppModule {}
