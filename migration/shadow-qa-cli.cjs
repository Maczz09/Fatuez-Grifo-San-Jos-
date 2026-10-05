'use strict';
// Only bundled fixtures. No arbitrary files, stdin, URL, DB, certificate or env configuration.
try{
  const args=process.argv.slice(2),allowed=['--isolated-synthetic-only','--full-report'];
  if(!args.includes('--isolated-synthetic-only')||args.some(a=>!allowed.includes(a))||new Set(args).size!==args.length)
    throw Object.assign(new Error(),{code:'SHADOW_ARGUMENTS_BLOCKED'});
  const {compareShadowRun}=require('../packages/shadow-core/dist');
  const {run}=require('./fixtures/shadow-development.cjs');
  const report=compareShadowRun(run());
  const output=args.includes('--full-report')?report:{...report,reports:report.reports.map(({caseId,status,comparativeMatch,differenceCount,counts,inputSha256})=>
    ({caseId,status,comparativeMatch,differenceCount,counts,inputSha256}))};
  console.log(JSON.stringify(output,null,2));
  // Every result still requires review, including exact comparative equality.
  process.exitCode=3;
}catch(error){
  const reason=typeof error?.code==='string'&&/^[A-Z0-9_]{1,80}$/.test(error.code)?error.code:'SHADOW_VALIDATION_BLOCKED';
  console.error(JSON.stringify({status:'BLOCKED',reason,environment:'BETA',datasetClass:'SYNTHETIC',mode:'SHADOW',
    transmission:false,persisted:false,fiscalWrites:0,outboxWrites:0,countersChanged:false,productionBlocked:true}));
  process.exitCode=2;
}
