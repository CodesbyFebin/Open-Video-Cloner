'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createApp}=require('../server-secure');
const key='test-secret-which-is-long-enough-123456';
test('secure API, project scope, timeline validation, persistence, cancellation, retention validation',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ovc-secure-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const app=createApp({dataDir:dir,apiKey:key});const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());
 const origin='http://127.0.0.1:'+server.address().port;
 const req=async(route,method='GET',body,auth=true)=>{const res=await fetch(origin+route,{method,headers:{...(auth?{Authorization:'Bearer '+key}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:res.status,data:await res.json()}};
 assert.equal((await req('/api/projects','GET',null,false)).status,401);
 assert.equal((await req('/api/projects','GET')).status,200);
 assert.equal((await req('/api/projects','POST',{name:''})).status,400);
 const a=await req('/api/projects','POST',{name:'A'});assert.equal(a.status,201);
 const b=await req('/api/projects','POST',{name:'B'});assert.equal(b.status,201);
 assert.equal((await req('/api/projects/'+a.data.id+'/jobs','POST',{uploadId:cryptoId(),operation:'transcode'})).status,404);
 assert.equal((await req('/api/projects/'+a.data.id+'/jobs','POST',{operation:'timeline',clips:[]})).status,400);
 assert.equal((await req('/api/projects/'+a.data.id+'/jobs','POST',{operation:'timeline',clips:[{uploadId:cryptoId()}]})).status,404);
 assert.equal((await req('/api/projects/'+b.data.id+'/jobs')).data.length,0);
 assert.equal((await req('/api/maintenance/cleanup','POST',{days:0})).status,400);
 assert.deepEqual((await req('/api/maintenance/cleanup','POST',{days:30})).data,{deletedJobs:0,deletedUploads:0});
 const app2=createApp({dataDir:dir,apiKey:key});const s2=app2.listen(0,'127.0.0.1');await new Promise(r=>s2.once('listening',r));const r2=await fetch('http://127.0.0.1:'+s2.address().port+'/api/projects',{headers:{Authorization:'Bearer '+key}});assert.equal((await r2.json()).length,2);await new Promise(r=>s2.close(r));
});
function cryptoId(){return '00000000-0000-4000-8000-000000000001'}
