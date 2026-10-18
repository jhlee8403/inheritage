import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm','.json':'application/json','.pdf':'application/pdf','.png':'image/png','.bcmap':'application/octet-stream','.traineddata':'application/octet-stream'};
export function createServer() {
  return http.createServer(async(req,res)=>{
    try {
      const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
      const relative=pathname==='/'?'index.html':pathname.slice(1);
      const filename=path.resolve(root,relative);
      if(!filename.startsWith(root) || relative.split('/').some(p=>p.startsWith('.')) || !/^(index\.html|src\/|public\/|fixtures\/)/.test(relative)) {res.writeHead(403);res.end('Forbidden');return;}
      if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
      const size=(await stat(filename)).size;
      res.writeHead(200,{'Content-Type':types[path.extname(filename)]||'application/octet-stream','Content-Length':size,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
      res.end(req.method==='HEAD'?undefined:await readFile(filename));
    }catch{res.writeHead(404);res.end('Not found');}
  });
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const server=createServer();
  server.listen(4173,'127.0.0.1',()=>console.log('B1 workbench: http://127.0.0.1:4173 (loopback only)'));
}
