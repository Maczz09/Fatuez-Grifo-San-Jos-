"use client";
import { useEffect, useState } from "react";
import { Plus, MapPin, LoaderCircle, Building2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@factuez/ui/components/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@factuez/ui/components/select";
import { Badge } from "@factuez/ui/components/badge";
import { Button } from "@factuez/ui/components/button";
import { Input } from "@factuez/ui/components/input";
import { Label } from "@factuez/ui/components/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@factuez/ui/components/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@factuez/ui/components/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@factuez/ui/components/table";
import { useWorkspace } from "../../../features/workspace/provider";
import { ClientIntakeWorkspace } from "../../../features/workspace/client-intake";
import {
  Empty,
  ErrorState,
  money,
  PageHeading,
} from "../../../features/workspace/common";
export default function StationsPage() {
  const {
    user,
    catalog,
    branchId,
    companyId,
    can,
    api,
    reloadCatalog,
    setDirty,
  } = useWorkspace();
  const [dialog, setDialog] = useState<string>();
  const [selectedCompany, setSelectedCompany] = useState("");
  const [ruc, setRuc] = useState("");
  const [ubigeo, setUbigeo] = useState("");
  const isIssuer = dialog === "issuer";
  const isBranch = dialog === "branch";
  const isAssign = dialog?.startsWith("assign:") ?? false;
  function openDialog(value: string) {
    setSelectedCompany(
      companyId ||
        String(
          catalog?.branches.find(
            (branch) => branch.id === value.replace("assign:", ""),
          )?.companyId ??
            catalog?.companies[0]?.id ??
            "",
        ),
    );
    setDialog(value);
  }
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [invoiceSeries, setInvoiceSeries] = useState("");
  const [receiptSeries, setReceiptSeries] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => () => setDirty(false), [setDirty]);
  function close() {
    setDialog(undefined);
    setCode("");
    setRuc("");
    setUbigeo("");
    setName("");
    setAddress("");
    setInvoiceSeries("");
    setReceiptSeries("");
    setDirty(false);
    setError(undefined);
  }
  async function save() {
    setBusy(true);
    setError(undefined);
    try {
      await api(
        isIssuer
          ? "/api/v1/stations/issuers"
          : isAssign
            ? `/api/v1/stations/${dialog?.slice(7)}/issuer`
            : isBranch
              ? "/api/v1/stations"
              : `/api/v1/stations/${dialog}/points`,
        {
          method: isAssign ? "PATCH" : "POST",
          body: JSON.stringify(
            isIssuer
              ? { ruc, legalName: name, taxAddress: address, ubigeo }
              : isAssign
                ? { companyId: Number(selectedCompany) }
                : isBranch
                  ? { companyId: Number(selectedCompany), code, name, address }
                  : { code, name, invoiceSeries, receiptSeries },
          ),
        },
      );
      close();
      await reloadCatalog();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }
  const global = user?.scope.kind === "GLOBAL";
  const canReadIntake = global && user?.roles.includes("ADMIN") && can("setup.manage");
  const branches =
    catalog?.branches.filter(
      (branch) =>
        (!branchId || branch.id === branchId) &&
        (!companyId || String(branch.companyId) === companyId),
    ) ?? [];
  const valid = isIssuer
    ? /^\d{11}$/.test(ruc) &&
      name.trim() &&
      address.trim() &&
      /^\d{6}$/.test(ubigeo)
    : isAssign
      ? !!selectedCompany
      : /^[A-Z0-9_-]{2,20}$/.test(code) &&
        name.trim() &&
        (isBranch
          ? !!selectedCompany
          : /^F[A-Z0-9]{3}$/.test(invoiceSeries) &&
            /^B[A-Z0-9]{3}$/.test(receiptSeries));
  return (
    <>
      <PageHeading
        eyebrow="Sistema privado · varios RUC · múltiples sedes"
        title="Sedes y maestros"
        description="Cada sede pertenece a un emisor fiscal configurable. Sin límites fijos de RUC ni distribución de sedes."
        action={
          global &&
          can("setup.manage") && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => openDialog("issuer")}>
                <Plus className="size-4" />
                Nuevo emisor RUC
              </Button>
              <Button
                disabled={!catalog?.companies.length}
                onClick={() => openDialog("branch")}
              >
                <Plus className="size-4" />
                Nueva sede
              </Button>
            </div>
          )
        }
      />
      <Tabs defaultValue="branches">
        <TabsList className="mb-5 max-w-full flex-wrap group-data-[orientation=horizontal]/tabs:h-auto">
          <TabsTrigger value="issuers">Emisores RUC</TabsTrigger>
          <TabsTrigger value="branches">Sedes y series</TabsTrigger>
          <TabsTrigger value="products">Catálogo de productos</TabsTrigger>
          {canReadIntake && <TabsTrigger value="client-intake">Entrega del cliente</TabsTrigger>}
        </TabsList>
        <TabsContent value="issuers">
          <div className="grid gap-5 lg:grid-cols-2">
            {catalog?.companies
              .filter(
                (company) => !companyId || String(company.id) === companyId,
              )
              .map((company) => (
                <Card key={company.id} className="shadow-none">
                  <CardHeader>
                    <Badge variant="outline" className="w-fit font-mono">
                      RUC {company.ruc}
                    </Badge>
                    <CardTitle>{company.legalName}</CardTitle>
                    <CardDescription>
                      {
                        catalog.branches.filter(
                          (branch) => branch.companyId === company.id,
                        ).length
                      }{" "}
                      sedes visibles · {company.environment}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    Certificado digital, SOL y credenciales GRE deberán
                    configurarse individualmente para este RUC en la etapa
                    fiscal. No se comparten entre emisores.
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>
        <TabsContent value="branches">
          <div className="grid gap-5 lg:grid-cols-2">
            {branches.map((branch) => {
              const points =
                catalog?.emissionPoints.filter(
                  (point) => point.branchId === branch.id,
                ) ?? [];
              return (
                <Card key={branch.id} className="shadow-none">
                  <CardHeader>
                    <div className="mb-2 flex items-center justify-between">
                      <Badge variant="outline">
                        <Building2 className="mr-1 size-3" />
                        {branch.code}
                      </Badge>
                      {global && can("series.manage") && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openDialog(branch.id)}
                        >
                          <Plus className="size-3.5" />
                          Punto de emisión
                        </Button>
                      )}
                    </div>
                    <CardTitle>{branch.name}</CardTitle>
                    <CardDescription className="font-mono">
                      RUC{" "}
                      {
                        catalog?.companies.find(
                          (company) => company.id === branch.companyId,
                        )?.ruc
                      }
                    </CardDescription>
                    {global && can("setup.manage") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-fit"
                        disabled={!!points.length}
                        onClick={() => openDialog(`assign:${branch.id}`)}
                      >
                        Cambiar emisor (solo sede sin puntos)
                      </Button>
                    )}
                    <CardDescription className="flex items-center gap-1">
                      <MapPin className="size-3.5" />
                      {branch.address || "Dirección pendiente de configurar"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {points.length ? (
                      <div className="space-y-3">
                        {points.map((point) => (
                          <div
                            key={point.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                          >
                            <div>
                              <p className="text-sm font-medium">
                                {point.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {point.code}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              {point.series.map((counter) => (
                                <Badge variant="secondary" key={counter.id}>
                                  {counter.series}
                                </Badge>
                              ))}
                              {!point.series.length && (
                                <span className="text-xs text-muted-foreground">
                                  Sin series autorizadas
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <Empty
                        title="Sin puntos disponibles"
                        description="Un administrador general debe crear el punto y asignar series únicas dentro del RUC."
                      />
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {!branches.length && (
            <Empty
              title="Sin sedes autorizadas"
              description="Solicita al administrador una asignación de sede."
            />
          )}
          <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
            Las series son únicas por tipo de documento para el mismo RUC. No se
            trasladan puntos ni se reinician correlativos al agregar una sede.
            La modificación de series históricas no está habilitada en esta
            etapa.
          </p>
        </TabsContent>
        <TabsContent value="products">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>Combustibles y productos</CardTitle>
              <CardDescription>
                Consulta del catálogo operativo compartido · Edición de maestros
                pendiente de una etapa posterior
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Unidad</TableHead>
                    <TableHead>Afectación</TableHead>
                    <TableHead className="text-right">
                      Precio de referencia
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {catalog?.products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="text-xs">{product.sku}</TableCell>
                      <TableCell className="font-medium">
                        {product.description}
                      </TableCell>
                      <TableCell>{product.unitCode}</TableCell>
                      <TableCell>{product.taxAffectationCode}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {product.defaultUnitPrice
                          ? money(product.defaultUnitPrice)
                          : "Sin precio"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        {canReadIntake && <TabsContent value="client-intake"><ClientIntakeWorkspace /></TabsContent>}
      </Tabs>
      <Dialog
        open={!!dialog}
        onOpenChange={(open) => {
          if (!open && !busy) close();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isIssuer
                ? "Registrar emisor RUC"
                : isAssign
                  ? "Asignar emisor a sede"
                  : isBranch
                    ? "Agregar sede"
                    : "Crear punto y series"}
            </DialogTitle>
            <DialogDescription>
              {isIssuer
                ? "Registro local inicial en Beta. Verifica los datos fiscales reales; este formulario no valida el RUC ante SUNAT ni habilita transmisión."
                : isAssign
                  ? "Solo se permite antes de crear puntos. Nunca se traslada el historial fiscal a otro RUC."
                  : isBranch
                    ? "Selecciona la empresa emisora de esta sede. Puedes agregar cualquier distribución de sedes por RUC."
                    : "Las series son únicas por RUC y tipo. Otro emisor puede usar la misma etiqueta con sus propios correlativos."}
            </DialogDescription>
          </DialogHeader>
          <fieldset
            disabled={busy}
            onChange={() => setDirty(true)}
            className="space-y-4"
          >
            {(isBranch || isAssign) && (
              <div className="space-y-2">
                <Label>Emisor fiscal de la sede</Label>
                <Select
                  value={selectedCompany}
                  onValueChange={(value) => {
                    setSelectedCompany(value);
                    setDirty(true);
                  }}
                >
                  <SelectTrigger aria-label="RUC de la sede">
                    <SelectValue placeholder="Seleccionar emisor" />
                  </SelectTrigger>
                  <SelectContent>
                    {catalog?.companies.map((company) => (
                      <SelectItem key={company.id} value={String(company.id)}>
                        {company.ruc} · {company.legalName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {isIssuer && (
              <div className="space-y-2">
                <Label htmlFor="issuer-ruc">RUC (11 dígitos)</Label>
                <Input
                  id="issuer-ruc"
                  inputMode="numeric"
                  maxLength={11}
                  value={ruc}
                  onChange={(event) =>
                    setRuc(event.target.value.replace(/\D/g, ""))
                  }
                />
              </div>
            )}
            {!isIssuer && !isAssign && (
              <div className="space-y-2">
                <Label htmlFor="station-code">Código único</Label>
                <Input
                  id="station-code"
                  maxLength={20}
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value.toUpperCase())
                  }
                  placeholder={isBranch ? "SEDE02" : "CAJA02"}
                />
              </div>
            )}
            {!isAssign && (
              <div className="space-y-2">
                <Label htmlFor="station-name">
                  {isIssuer ? "Razón social" : "Nombre"}
                </Label>
                <Input
                  id="station-name"
                  maxLength={isIssuer ? 200 : 120}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
            )}
            {!isAssign &&
              (isBranch || isIssuer ? (
                <div className="space-y-2">
                  <Label htmlFor="station-address">
                    {isIssuer ? "Dirección fiscal" : "Dirección"}
                  </Label>
                  <Input
                    id="station-address"
                    maxLength={300}
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="invoice-series">Serie factura</Label>
                    <Input
                      id="invoice-series"
                      maxLength={4}
                      placeholder="F002"
                      value={invoiceSeries}
                      onChange={(event) =>
                        setInvoiceSeries(event.target.value.toUpperCase())
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="receipt-series">Serie boleta</Label>
                    <Input
                      id="receipt-series"
                      maxLength={4}
                      placeholder="B002"
                      value={receiptSeries}
                      onChange={(event) =>
                        setReceiptSeries(event.target.value.toUpperCase())
                      }
                    />
                  </div>
                </div>
              ))}
            {isIssuer && (
              <div className="space-y-2">
                <Label htmlFor="issuer-ubigeo">Ubigeo fiscal (6 dígitos)</Label>
                <Input
                  id="issuer-ubigeo"
                  inputMode="numeric"
                  maxLength={6}
                  value={ubigeo}
                  onChange={(event) =>
                    setUbigeo(event.target.value.replace(/\D/g, ""))
                  }
                />
              </div>
            )}
          </fieldset>
          {error && <ErrorState message={error} />}
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={close}>
              Cancelar
            </Button>
            <Button disabled={busy || !valid} onClick={() => void save()}>
              {busy && <LoaderCircle className="size-4 animate-spin" />}Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
