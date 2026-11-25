"use client";
import { GreQa } from '../../../features/workspace/gre-qa';
import Link from 'next/link';
import { useWorkspace } from '../../../features/workspace/provider';
export default function GuidesPage(){const { can } = useWorkspace(); return <>{can('setup.manage') && <p className="mb-5 text-sm"><Link className="text-primary underline" href="/guide-settings">Configurar productos, rutas y rol de la empresa</Link></p>}<GreQa/></>;}
