"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { CollaborationLogos, SanJoseLogo } from "./brand";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  Fuel,
  LayoutDashboard,
  FileText,
  Users,
  ShieldCheck,
  KeyRound,
  LogOut,
  Moon,
  Sun,
  FlaskConical,
  ChevronRight,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@factuez/ui/components/sidebar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@factuez/ui/components/select";
import { Button } from "@factuez/ui/components/button";
import { Badge } from "@factuez/ui/components/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@factuez/ui/components/dialog";
import { useWorkspace } from "./provider";
import { Empty, ErrorState, Loading, rolesText } from "./common";
const menu = [
  { href: '/shadow-lab', title: 'Modo sombra (pruebas)', icon: FlaskConical, permission: 'sunat.configure', group: 'Administración' },
  { href: '/fiscal-lab', title: 'Laboratorio fiscal Beta', icon: FlaskConical, permission: 'sunat.configure', group: 'Administración' },
  { href: '/batches', title: 'Resúmenes y bajas', icon: FileText, permission: 'sunat.configure', group: 'Documentos' },
  { href: '/notes', title: 'Notas de crédito/débito', icon: FileText, permission: 'sunat.configure', group: 'Documentos' },
  { href: '/guides', title: 'Guías de remisión', icon: FileText, permission: 'sunat.configure', group: 'Documentos' },
  { href: '/mail-settings', title: 'Correo corporativo', icon: KeyRound, permission: 'document.email', group: 'Administración' },
  {
    href: "/dashboard",
    title: "Resumen",
    icon: LayoutDashboard,
    permission: "report.view",
    group: "Operación",
  },
  {
    href: "/pos",
    title: "Terminal de pista",
    icon: Fuel,
    permission: "document.issue",
    group: "Operación",
  },
  {
    href: "/documents",
    title: "Comprobantes emitidos",
    icon: FileText,
    permission: "document.view",
    group: "Documentos",
  },
  {
    href: "/stations",
    title: "Sedes y maestros",
    icon: Building2,
    permission: "document.view",
    group: "Administración",
  },
  {
    href: "/users",
    title: "Usuarios",
    icon: Users,
    permission: "user.manage",
    group: "Administración",
  },
  {
    href: "/roles",
    title: "Roles y permisos",
    icon: ShieldCheck,
    permission: "role.manage",
    group: "Administración",
  },
  {
    href: "/sunat-settings",
    title: "Configuración SUNAT",
    icon: KeyRound,
    permission: "sunat.configure",
    group: "Administración",
  },
];
export function WorkspaceShell({ children }: { children: ReactNode }) {
  const {
    user,
    restoring,
    restoreError,
    retryRestore,
    catalog,
    branchId,
    companyId,
    setCompany,
    setBranch,
    can,
    logout,
    catalogError,
    reloadCatalog,
    dirty,
    setDirty,
  } = useWorkspace();
  const pathname = usePathname();
  const router = useRouter();
  const [dark, setDark] = useState(false);
  const [pending, setPending] = useState<(() => void) | null>(null);
  useEffect(() => {
    if (!user && !restoring && !restoreError) router.replace("/login");
  }, [user, restoring, restoreError, router]);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  function confirm(action: () => void) {
    if (dirty) setPending(() => action);
    else action();
  }
  if (!user && restoreError) return <main className="p-8"><ErrorState message={restoreError} /><Button onClick={retryRestore}>Reintentar sesión</Button></main>;
  if (!user || restoring) return <Loading />;
  const current = menu.find(
    (item) => item.href === pathname || pathname.startsWith(`${item.href}/`),
  );
  return (
    <SidebarProvider
      style={{ "--sidebar-width": "15rem" } as React.CSSProperties}
    >
      <Sidebar collapsible="icon">
        <SidebarHeader className="px-5 py-7">
          <SanJoseLogo className="w-40 self-start group-data-[collapsible=icon]:hidden" />
          <Fuel className="hidden size-5 group-data-[collapsible=icon]:block" />
        </SidebarHeader>
        <SidebarContent>
          {["Operación", "Documentos", "Administración"].map((group) => (
            <SidebarGroup key={group}>
              <SidebarGroupLabel className="mb-2 text-[10px] uppercase tracking-[0.16em] text-slate-400">
                {group}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {menu
                    .filter(
                      (item) => item.group === group && can(item.permission) && (item.href !== '/shadow-lab' || user.scope.kind === 'GLOBAL' && user.roles.includes('ADMIN')),
                    )
                    .map((item) => (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          asChild
                          isActive={pathname === item.href}
                          tooltip={item.title}
                          className="h-11"
                        >
                          <Link
                            href={item.href}
                            onClick={(event) => {
                              if (dirty) {
                                event.preventDefault();
                                confirm(() => {
                                  setDirty(false);
                                  router.push(item.href);
                                });
                              }
                            }}
                          >
                            <item.icon />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarFooter className="p-4">
          <div className="mb-3 rounded-lg border border-white/10 p-3 group-data-[collapsible=icon]:hidden">
            <p className="text-xs font-medium">
              {user.fullName ?? user.username}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              {user.roles.map((role) => rolesText[role] ?? role).join(" · ")}
            </p>
          </div>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() =>
                  confirm(() => {
                    logout();
                    router.replace("/login");
                  })
                }
                tooltip="Cerrar sesión"
              >
                <LogOut />
                <span>Cerrar sesión</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <CollaborationLogos
            compact
            dark
            className="mt-2 self-start group-data-[collapsible=icon]:hidden"
          />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-w-0 bg-background">
        <header className="flex min-h-18 flex-wrap items-center gap-3 border-b bg-card px-4 py-3 sm:px-7">
          <SidebarTrigger aria-label="Abrir o cerrar menú" />
          <span className="hidden text-sm text-muted-foreground sm:block">
            San José
          </span>
          <ChevronRight className="hidden size-3.5 text-muted-foreground sm:block" />
          <span className="hidden text-sm font-medium xl:block">
            {current?.title}
          </span>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            {catalog && (
              <Select
                value={companyId || "all"}
                onValueChange={(value) =>
                  confirm(() => setCompany(value === "all" ? "" : value))
                }
              >
                <SelectTrigger
                  aria-label="Emisor RUC activo"
                  className="w-44 sm:w-56"
                >
                  <SelectValue placeholder="Emisor RUC" />
                </SelectTrigger>
                <SelectContent>
                  {user.scope.kind === "GLOBAL" && (
                    <SelectItem value="all">Todos los emisores</SelectItem>
                  )}
                  {catalog.companies.map((company) => (
                    <SelectItem key={company.id} value={String(company.id)}>
                      {company.ruc} · {company.legalName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {catalog &&
              (catalog.branches.length > 1 || user.scope.kind === "GLOBAL" ? (
                <Select
                  value={branchId || "all"}
                  onValueChange={(value) =>
                    confirm(() => setBranch(value === "all" ? "" : value))
                  }
                >
                  <SelectTrigger
                    aria-label="Sede activa"
                    className="w-44 sm:w-56"
                  >
                    <Building2 className="size-4 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {user.scope.kind === "GLOBAL" && (
                      <SelectItem value="all">Todas las sedes</SelectItem>
                    )}
                    {catalog.branches
                      .filter(
                        (branch) =>
                          !companyId || String(branch.companyId) === companyId,
                      )
                      .map((branch) => (
                        <SelectItem value={branch.id} key={branch.id}>
                          {branch.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              ) : (
                <Badge variant="outline" className="h-9">
                  {catalog.branches[0]?.name ?? "Sin sede asignada"}
                </Badge>
              ))}
            <Badge
              variant="outline"
              className="hidden border-amber-200 bg-amber-50 text-amber-900 sm:flex"
            >
              <FlaskConical className="mr-1 size-3" />
              {(companyId
                ? catalog?.companies.find(
                    (company) => String(company.id) === companyId,
                  )?.environment
                : "Consolidado") ?? "Cargando"}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              aria-label={dark ? "Usar tema claro" : "Usar tema oscuro"}
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun /> : <Moon />}
            </Button>
          </div>
        </header>
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs leading-relaxed text-amber-900 sm:px-7">
          {catalog?.capabilities.demoData ? "Datos de demostración · " : ""}
          Emisión local de prueba. Firma y envío a SUNAT pendientes de
          habilitación.
        </div>
        <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-7 lg:p-8">
          {catalogError ? (
            <ErrorState
              message={catalogError}
              retry={() => void reloadCatalog()}
            />
          ) : !catalog ? (
            <Loading />
          ) : current && !can(current.permission) ? (
            <Empty
              title="Acceso no autorizado"
              description="Tu cuenta no tiene permiso para este módulo."
            />
          ) : (
            <div key={`${companyId}:${branchId}`}>{children}</div>
          )}
        </div>
      </SidebarInset>
      <Dialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hay datos sin guardar</DialogTitle>
            <DialogDescription>
              {pathname === '/shadow-lab' ? 'Las anotaciones y motivos del laboratorio están sólo en memoria. Descárgalos antes de salir; continuar los descarta sin modificar documentos fiscales.' : <>Los borradores no enviados se descartarán. Una solicitud de
              emisión enviada sin respuesta conserva su clave en esta pestaña;
              salir no la cancela. ¿Deseas continuar?</>}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>
              Seguir editando
            </Button>
            <Button
              onClick={() => {
                const action = pending;
                setPending(null);
                setDirty(false);
                action?.();
              }}
            >
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
