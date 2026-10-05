export * from './events';
export * from './authorization';
export * from './fiscal-delivery';
// El payload específico del cliente es opt-in del servidor, no se carga al
// importar eventos/permisos desde un consumidor o un bundle de navegador.
export type { ClientIntakeV1, ClientIntakeCompany, ClientIntakeBranch, ClientIntakePending, ClientIntakeReportV1 } from './client-intake';
