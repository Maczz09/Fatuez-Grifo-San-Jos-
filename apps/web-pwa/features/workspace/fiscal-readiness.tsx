"use client";
import { useResource } from './provider';
import { ErrorState,Loading } from './common';
import { Card,CardHeader,CardTitle,CardDescription,CardContent } from '@factuez/ui/components/card';
import { Badge } from '@factuez/ui/components/badge';
import { Button } from '@factuez/ui/components/button';
type Report={state:string;readyForLocalDevelopment:boolean;checkedAt:string;checks:{code:string;status:string;description:string}[];rules:{profile:string;source:{publishedVersion:string};coverage:{capability:string;status:string}[]}};
export function FiscalReadiness({companyId,environment}:{companyId:number;environment:string}){
  const r=useResource<Report>(`/api/v1/setup/sunat/${companyId}/${environment}/readiness`);
  return <Card className="mt-6 shadow-none"><CardHeader><CardTitle>Preparación fiscal y certificado</CardTitle><CardDescription>Revisión local, sin autenticación en SUNAT. No activa Beta oficial ni producción.</CardDescription></CardHeader><CardContent className="space-y-4">{r.error?<ErrorState message={r.error} retry={r.reload}/>:!r.data?<Loading/>:<><Badge variant="outline">{r.data.readyForLocalDevelopment?'Desarrollo local disponible':'Emisión oficial bloqueada'}</Badge><div className="divide-y">{r.data.checks.map(c=><div className="flex items-start justify-between gap-4 py-3" key={c.code}><div><p className="text-xs font-medium">{c.code}</p><p className="mt-1 text-xs text-muted-foreground">{c.description}</p></div><Badge variant="outline">{({PASS:'Verificado localmente',BLOCKED:'Bloqueado',PENDING:'Pendiente',NOT_APPLICABLE:'No configurado / no aplica'}as Record<string,string>)[c.status]??c.status}</Badge></div>)}</div><p className="text-xs text-muted-foreground">Perfil {r.data.rules.profile} · Fuente publicada {r.data.rules.source.publishedVersion}. No cubre todas las reglas SUNAT.</p><ul className="space-y-2 text-xs text-muted-foreground">{r.data.rules.coverage.map(c=><li key={c.capability}>{c.capability} · {c.status}</li>)}</ul></>}<Button variant="outline" onClick={r.reload}>Revisar preparación</Button></CardContent></Card>;
}
