// Mac development/test helper only; not a Windows product launcher.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
export async function startServer(port=0) {
  const server=createServer(async(req,res)=>{
    try {
      let pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
      if(pathname==='/') {res.writeHead(302,{Location:'/experiments/inheritance-calculator/index.html'});res.end();return;}
      const path=resolve(root,`.${pathname}`);
      const allowed=['experiments/inheritance-calculator','packages/inheritance-engine/src'].some(prefix=>path.startsWith(resolve(root,prefix)+sep));
      if(!allowed || !mime[extname(path)]) {res.writeHead(403);res.end();return;}
      res.setHeader('Content-Type',mime[extname(path)]);res.setHeader('Cache-Control','no-store');
      res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
      res.end(await readFile(path));
    }catch{res.writeHead(404);res.end();}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  return {server,origin:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise(resolve=>server.close(resolve))};
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const host=await startServer(4174);
  console.log(`가공 사례 검증용: ${host.origin}/experiments/inheritance-calculator/index.html\n종료: Ctrl+C (Mac 개발용 서버)`);
  for(const signal of ['SIGINT','SIGTERM']) process.once(signal,()=>void host.close().then(()=>process.exit(0)));
}
