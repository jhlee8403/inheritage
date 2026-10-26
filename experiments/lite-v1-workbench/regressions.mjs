// Development-only bounded runner; existing suites and artifacts are not edited.
import {spawn} from 'node:child_process';
import {openSync,closeSync,readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),results=new URL(process.env.INHERITAGE_LITE_RESULTS??'results/',import.meta.url);
const suites=[['c1-browser','packages/inheritance-engine/test/browser/run.mjs'],['m2-browser','packages/inheritance-engine/test/browser/run-m2.mjs'],['c1-file','experiments/c1-offline-file-prototype/test/browser-file.mjs'],['c1-workbench','experiments/inheritance-calculator/test/browser.mjs']];
const summary=[];
for(const [name,script] of suites){
  const output=new URL(`${name}.json`,results),err=new URL(`${name}.stderr.txt`,results),fd=openSync(output,'w'),ef=openSync(err,'w');
  console.log(name+' START');const child=spawn(process.execPath,[script],{cwd:root,stdio:['ignore',fd,ef]});let timeout=false;
  const timer=setTimeout(()=>{timeout=true;child.kill('SIGKILL');},60000);
  const exit=await new Promise(resolve=>{child.once('error',e=>resolve(String(e)));child.once('exit',(code,signal)=>resolve(code??signal));});
  clearTimeout(timer);closeSync(fd);closeSync(ef);
  let parsed;try{parsed=JSON.parse(readFileSync(output,'utf8'));}catch{}
  const record={name,command:`node ${script}`,exit,timeout,results:parsed?.browsers?.map(b=>({name:b.name,version:b.version,pass:b.pass,fail:b.fail,skipped:b.skipped,diagnosticsPass:b.diagnosticsPass,error:b.error}))??null};
  summary.push(record);
  for(const file of [output,err])writeFileSync(file,readFileSync(file,'utf8').replaceAll(root,'<repo>/').replaceAll(new URL('../../',import.meta.url).href,'<repo>/'));
  writeFileSync(new URL('regressions.json',results),JSON.stringify(summary,null,2)+'\n');console.log(name+' '+JSON.stringify(record));
  if(timeout||exit!==0){process.exitCode=1;break;}
}
