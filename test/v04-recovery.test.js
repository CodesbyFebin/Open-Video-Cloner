'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {openStore}=require('../sqlite-store'),{createApp}=require('../server-secure');
const key='valid-secret-with-32-bytes-for-tests';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
test('queued job resumes after restart, active cancellation is terminal, interrupted job stays uncertain',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ovc-recovery-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 fs.mkdirSync(path.join(dir,'inputs'));fs.mkdirSync(path.join(dir,'outputs'));
 const fake=path.join(dir,'fake-ffmpeg');
 fs.writeFileSync(fake,'#!/usr/bin/env node\nsetTimeout(()=>{require("node:fs").writeFileSync(process.argv.at(-1),"output");process.exit(0)},10000);\n',{mode:0o755});
 process.env.FFMPEG_PATH=fake;
 t.after(()=>delete process.env.FFMPEG_PATH);
 const projectId=crypto.randomUUID(),uploadId=crypto.randomUUID(),jobId=crypto.randomUUID();
 fs.writeFileSync(path.join(dir,'inputs',uploadId),'fixture');
 const job={id:jobId,projectId,inputId:uploadId,source:'fixture.mp4',operation:'transcode',format:'mp4',duration:20,options:{operation:'transcode',format:'mp4',start:0,end:20,duration:20},status:'queued',progress:0,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
 const store=openStore(dir);store.saveAll({projects:[{id:projectId,name:'Test'}],uploads:[{id:uploadId,projectId,name:'fixture.mp4',metadata:{duration:20}}],jobs:[job]});store.close();
 const app=createApp({dataDir:dir,apiKey:key}),server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 t.after(()=>new Promise(r=>server.close(r)));
 const base='http://127.0.0.1:'+server.address().port;
 async function call(url,opts={}){const response=await fetch(base+url,{...opts,headers:{Authorization:'Bearer '+key,...opts.headers}});return {status:response.status,data:await response.json()}}
 let status;
 for(let i=0;i<100;i++){status=(await call('/api/jobs/'+jobId)).data.status;if(status==='processing')break;await pause(25)}
 assert.equal(status,'processing','durable queued job should restart');
 const cancel=await call('/api/jobs/'+jobId+'/cancel',{method:'POST'});assert.equal(cancel.status,202);
 for(let i=0;i<100;i++){status=(await call('/api/jobs/'+jobId)).data.status;if(status==='cancelled')break;await pause(25)}
 assert.equal(status,'cancelled');assert.equal(fs.existsSync(path.join(dir,'outputs',jobId+'.mp4')),false);
 const changed=openStore(dir);const jobs=changed.load('jobs');jobs.push({...job,id:crypto.randomUUID(),status:'processing'});changed.saveAll({jobs});changed.close();
 const second=createApp({dataDir:dir,apiKey:key});const result=openStore(dir).load('jobs');assert.equal(result.find(j=>j.status==='interrupted')?.error.includes('uncertain'),true);
});
