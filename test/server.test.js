'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {once}=require('node:events');
const {createApp}=require('../server');

test('upload → persist job → real worker callback → download; restart retains completed job',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ovc-test-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const executed=[];
  const app=createApp({
    dataDir:dir,
    probe:async()=>({duration:4,streams:[{codec_type:'video',codec_name:'h264'}]}),
    execute:async(input,output,options,onProgress)=>{
      executed.push({input,output,options});
      assert.ok(fs.existsSync(input));
      onProgress(42);
      fs.writeFileSync(output,Buffer.from('actual worker output'));
    }
  });
  const server=app.listen(0,'127.0.0.1');
  await once(server,'listening');
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base='http://127.0.0.1:'+server.address().port;
  const health=await (await fetch(base+'/api/health')).json();
  assert.equal(health.mode,'ffmpeg');
  const form=new FormData();
  form.append('file',new Blob([Buffer.from('test video bytes')],{type:'video/mp4'}),'example.mp4');
  const uploadedResponse=await fetch(base+'/api/upload',{method:'POST',body:form});
  assert.equal(uploadedResponse.status,201);
  const uploaded=await uploadedResponse.json();
  assert.equal(uploaded.metadata.duration,4);
  const invalid=await fetch(base+'/api/jobs',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({uploadId:uploaded.id,start:3,end:2})});
  assert.equal(invalid.status,400);
  const created=await fetch(base+'/api/jobs',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({uploadId:uploaded.id,operation:'trim',start:1,end:3,format:'mp4'})});
  assert.equal(created.status,202);
  const job=await created.json();
  assert.equal(job.status,'queued');
  let latest;
  for(let i=0;i<50;i++){
    latest=await (await fetch(base+'/api/jobs/'+job.id)).json();
    if(latest.status==='completed')break;
    await new Promise(resolve=>setTimeout(resolve,20));
  }
  assert.equal(latest.status,'completed');
  assert.equal(latest.progress,100);
  assert.equal(executed.length,1);
  assert.equal(executed[0].options.duration,2);
  const download=await fetch(base+latest.downloadUrl);
  assert.equal(download.status,200);
  assert.equal(await download.text(),'actual worker output');
  const stored=JSON.parse(fs.readFileSync(path.join(dir,'jobs.json'),'utf8'));
  assert.equal(stored[0].status,'completed');
  const restarted=createApp({dataDir:dir});
  const next=restarted.listen(0,'127.0.0.1');
  await once(next,'listening');
  t.after(()=>new Promise(resolve=>next.close(resolve)));
  const listing=await (await fetch('http://127.0.0.1:'+next.address().port+'/api/jobs')).json();
  assert.equal(listing[0].status,'completed');
});
test('AI clone endpoint does not fabricate completed media',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ovc-test-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const server=createApp({dataDir:dir}).listen(0,'127.0.0.1');
  await once(server,'listening');
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base='http://127.0.0.1:'+server.address().port;
  const response=await fetch(base+'/api/clone',{method:'POST'});
  assert.equal(response.status,501);
  assert.equal((await fetch(base+'/api/jobs/missing/download')).status,404);
});
