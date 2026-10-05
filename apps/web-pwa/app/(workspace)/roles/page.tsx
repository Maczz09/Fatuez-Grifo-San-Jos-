"use client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@factuez/ui/components/card";
import { Badge } from "@factuez/ui/components/badge";
import { useResource } from "../../../features/workspace/provider";
import {
  ErrorState,
  Loading,
  PageHeading,
  rolesText,
} from "../../../features/workspace/common";
import type { Role } from "../../../features/workspace/types";
const labels: Record<string, string> = {
  "setup.manage": "Configurar empresa y sedes",
  "user.manage": "Administrar usuarios",
  "role.manage": "Asignar roles",
  "product.manage": "Administrar productos",
  "series.manage": "Administrar series",
  "sunat.configure": "Configurar SUNAT",
  "document.issue": "Emitir documentos",
  "document.view": "Consultar documentos",
  "document.retry": "Reintentar envíos",
  "document.email": "Enviar por correo",
  "shift.open": "Abrir turno",
  "shift.close": "Cerrar turno",
  "report.view": "Consultar reportes",
  "report.export": "Exportar reportes",
  "audit.view": "Consultar auditoría",
};
export default function RolesPage() {
  const { data, error, reload } = useResource<Role[]>("/api/v1/roles");
  return (
    <>
      <PageHeading
        eyebrow="Seguridad"
        title="Roles y permisos"
        description="Presets del sistema. Cada asignación conserva su alcance por sede, punto y serie."
      />
      <div className="mb-6 rounded-lg border bg-card p-4 text-sm leading-relaxed text-muted-foreground">
        Esta matriz describe facultades de acceso, no asegura que todos los
        módulos estén implementados. Los roles personalizados, turnos, correo y
        reportes avanzados se habilitarán en etapas posteriores.
      </div>
      {error ? (
        <ErrorState message={error} retry={reload} />
      ) : !data ? (
        <Loading />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {data.map((role) => (
            <Card key={role.code} className="shadow-none">
              <CardHeader>
                <div className="mb-2">
                  <Badge variant={role.assignable ? "secondary" : "outline"}>
                    {role.assignable
                      ? "Puedes asignarlo"
                      : "Asignación restringida"}
                  </Badge>
                </div>
                <CardTitle>{rolesText[role.code] ?? role.name}</CardTitle>
                <CardDescription>
                  {role.code === "ADMIN"
                    ? "Acceso global a los emisores RUC y todas sus sedes."
                    : role.code === "STATION_MANAGER"
                      ? "Gestiona operación y usuarios de su propio alcance, sin delegar administración general."
                      : "Sus permisos se aplican únicamente a los recursos asignados."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {role.permissions.map((permission) => (
                    <li key={permission} className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-primary" />
                      {labels[permission] ?? permission}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
