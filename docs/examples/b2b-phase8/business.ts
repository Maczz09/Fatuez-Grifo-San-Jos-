import {FactuEzB2bClient,type FactuEzB2bOptions,type BusinessBinding,type CustomerBody,type ProductBody} from '../../../packages/b2b-sdk/src';
/** Call explicitly with independent keys for each command. No environment or certificate files are read. */
export async function businessExample(options:FactuEzB2bOptions,binding:BusinessBinding,
  customer:CustomerBody,product:ProductBody,keys:{customerCreate:string;customerUpdate:string;productCreate:string;productUpdate:string;open:string;cash:string;close:string}) {
  const client=new FactuEzB2bClient(options);
  const created=await client.createCustomer(binding,customer,{idempotencyKey:keys.customerCreate});
  const updated=await client.updateCustomer(binding,created.data.id,{active:false},{idempotencyKey:keys.customerUpdate,expectedRevision:created.data.revision});
  const productCreated=await client.createProduct(binding,product,{idempotencyKey:keys.productCreate});
  const productUpdated=await client.updateProduct(binding,productCreated.data.id,{active:false},{idempotencyKey:keys.productUpdate,expectedRevision:productCreated.data.revision});
  const products=await client.listBusinessProducts(binding,{limit:25});
  const shift=await client.openShift(binding,{openingAmount:'10.00',currency:'PEN'},{idempotencyKey:keys.open});
  const cash=await client.createCashMovement(binding,shift.data.id,{direction:'IN',amount:'0.10',reason:'Movimiento autorizado'},{idempotencyKey:keys.cash,expectedRevision:shift.data.revision});
  const closed=await client.closeShift(binding,shift.data.id,{countedAmount:'10.10',reason:'Cierre autorizado'},{idempotencyKey:keys.close,expectedRevision:cash.data.revision});
  return {updated,productUpdated,products,closed};
}
