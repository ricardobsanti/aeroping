import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('./dist/',import.meta.url));const port=Number(process.env.PORT||4173);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');let relative=decodeURIComponent(url.pathname).replace(/^\/+/, '')||'index.html';const target=path.resolve(root,relative);if(!target.startsWith(root))throw Error('Invalid path');const content=await readFile(target);res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(content);}catch{res.writeHead(404);res.end('Não encontrado');}}).listen(port,'127.0.0.1',()=>console.log(`AeroPing: http://127.0.0.1:${port}`));
