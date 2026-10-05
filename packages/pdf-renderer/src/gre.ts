import PDFDocument from 'pdfkit';
import { join } from 'node:path';
import QRCode from 'qrcode';
import type { PrintFormat } from './index';
export interface PrintableGre {
  id:string; ublNumber:string; issueDate:string; issuer:{ruc:string;legalName:string}; transferDate:string;
  origin:{address:string;ubigeo:string;establishmentCode:string}; destination:{address:string;ubigeo:string;establishmentCode:string};
  grossWeight:string;weightUnit:string;transport:{mode:string;plate?:string;driverDni?:string;driverFirstName?:string;driverLastName?:string;driverLicense?:string;carrierRuc?:string;carrierName?:string;mtcRegistration?:string};
  items:{code:string;description:string;quantity:string;unitCode:string}[];
}
/** PDF de traslado local, no una factura y nunca una autorización GRE. */
export async function renderLocalGrePdf(s:PrintableGre,format:PrintFormat,digest?:string):Promise<Buffer>{
  if(!['ticket','a4'].includes(format)||!/^00\d{9}$/.test(s.issuer.ruc)||!/^TQ00-[1-9]\d{0,7}$/.test(s.ublNumber)||!s.items.length||s.items.length>50||(digest&&!/^[A-Za-z0-9+/]{43}=$/.test(digest)))throw new Error('GRE imprimible fuera del perfil QA');
  const ticket=format==='ticket', width=ticket?80*72/25.4:595.28,margin=ticket?12:42,content=width-margin*2,size=ticket?8:10;
  const lines:[string,number][]=[['GUÍA DE REMISIÓN REMITENTE · PRUEBA',ticket?9:14],['SIN VALIDEZ TRIBUTARIA · NO AUTORIZA TRASLADO',ticket?7:9],
    [s.issuer.legalName,ticket?11:17],[`RUC ficticio ${s.issuer.ruc} · 09 · ${s.ublNumber}`,size],[`Emisión ${s.issueDate} · Traslado ${s.transferDate}`,size],
    ['Motivo 04: entre establecimientos del mismo emisor',size],[`ORIGEN ${s.origin.establishmentCode} · Ubigeo ${s.origin.ubigeo}\n${s.origin.address}`,size],
    [`DESTINO ${s.destination.establishmentCode} · Ubigeo ${s.destination.ubigeo}\n${s.destination.address}`,size],[`Peso bruto ${s.grossWeight} ${s.weightUnit}`,size],
    [s.transport.mode==='02'?`Transporte privado · Placa ${s.transport.plate}\nConductor ${s.transport.driverFirstName} ${s.transport.driverLastName}\nDNI ${s.transport.driverDni} · Licencia ${s.transport.driverLicense}`:`Transporte público · ${s.transport.carrierName}\nRUC ${s.transport.carrierRuc} · Registro MTC ${s.transport.mtcRegistration}`,size],
    ...s.items.map((i,index)=>[`${index+1}. ${i.description}\n${i.code} · ${i.quantity} ${i.unitCode}`,size] as [string,number]),
    [digest?`Hash del XML firmado localmente: ${digest}`:'Sin firma local: no utilice esta representación para un traslado',ticket?6.5:8],
    ['Certificado ficticio, sin CDR oficial ni transmisión a SUNAT.',ticket?7:9]];
  const clean=(text:string)=>text.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\u202a-\u202e\u2066-\u2069]/g,'');
  const font=require.resolve('@fontsource/inter/files/inter-latin-400-normal.woff');
  const measure=new PDFDocument({size:[width,14400],margin:0});measure.registerFont('Inter',font).font('Inter');
  const heights=lines.map(([text,size])=>measure.fontSize(size).heightOfString(clean(text),{width:content,lineGap:2})+10);measure.end();measure.resume();
  const pageHeight=ticket?heights.reduce((a,b)=>a+b,margin*2+170+(digest?110:0)):841.89;if(pageHeight>14400)throw new Error('GRE demasiado larga; utilice A4');
  const doc=new PDFDocument({autoFirstPage:false,bufferPages:true,info:{Title:`GRE ${s.ublNumber} · PRUEBA LOCAL`,Author:'Mavric Tecnologies · FactuEz'}});doc.registerFont('Inter',font).font('Inter');
  const result=new Promise<Buffer>((resolve,reject)=>{const chunks:Buffer[]=[];doc.on('data',chunk=>chunks.push(chunk));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);});
  let y=margin;const page=()=>{doc.addPage({size:[width,pageHeight],margin:0});y=margin;};page();
  const logoWidth=ticket?120:160,logoHeight=logoWidth*222/961,x=ticket?(width-logoWidth)/2:margin;
  doc.save().rect(x,y,logoWidth,logoHeight).clip().image(join(__dirname,'../assets/san-jose-logo.png'),x-130*logoWidth/961,y-286*logoWidth/961,{width:1200*logoWidth/961,height:800*logoWidth/961}).restore();y+=logoHeight+15;
  for(const [index,[text,size]]of lines.entries()){if(!ticket&&y+heights[index]>pageHeight-62)page();doc.fontSize(size).fillColor('#191919').text(clean(text),margin,y,{width:content,lineGap:2});y+=heights[index];}
  const footer=(digest?110:0)+65;if(!ticket&&y+footer>pageHeight-62)page();
  if(digest){const qr=await QRCode.toBuffer(`FACTUEZ-GRE-QA|${s.issuer.ruc}|${s.ublNumber}|${digest}|NO-AUTORIZA-TRASLADO`,{type:'png',margin:4,width:400,errorCorrectionLevel:'M'});doc.image(qr,margin,y,{width:90,height:90});y+=100;}
  const factuezWidth=ticket?90:128,logoSize=ticket?28:34,gap=18,logoY=y+(logoSize-factuezWidth*250/799)/2;
  doc.save().rect(margin,logoY,factuezWidth,factuezWidth*250/799).clip().image(join(__dirname,'../assets/factuez-logo.png'),margin-factuezWidth*0.1064,logoY-factuezWidth*250/799*0.26,{width:factuezWidth*1.5019}).restore();
  doc.image(join(__dirname,'../assets/mavric-logo.png'),margin+factuezWidth+gap,y,{width:logoSize,height:logoSize});y+=logoSize+8;
  doc.fontSize(ticket?7:9).text('Desarrollado e implementado por www.mavrictec.com',margin,y,{width:content});doc.end();return result;
}
