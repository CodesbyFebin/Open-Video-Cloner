'use strict';
const express = require('express');
const multer = require('multer');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { ffprobe, parseOptions, runFfmpeg } = require('./media');

function createApp({ dataDir = process.env.DATA_DIR || path.join(__dirname, 'data'), probe = ffprobe, execute = runFfmpeg } = {}) {
  const root = path.resolve(dataDir);
  const inputs = path.join(root,'inputs');
  const outputs = path.join(root,'outputs');
  fs.mkdirSync(inputs,{recursive:true}); fs.mkdirSync(outputs,{recursive:true});
  const dbFile = path.join(root,'jobs.json');
  let jobs = fs.existsSync(dbFile) ? JSON.parse(fs.readFileSync(dbFile,'utf8')) : [];
  for (const job of jobs) if (['processing','queued'].includes(job.status)) {
    job.status='interrupted'; job.error='Server restarted during processing'; job.updatedAt=new Date().toISOString();
  }
  const clients = new Set();
  const save = () => {
    const tmp=dbFile+'.tmp';
    fs.writeFileSync(tmp,JSON.stringify(jobs,null,2));
    fs.renameSync(tmp,dbFile);
    for (const res of clients) res.write('data: '+JSON.stringify({type:'state'})+'\n\n');
  };
  save();
  const display = j => ({
    id:j.id, source:j.source, status:j.status, operation:j.operation, format:j.format,
    progress:j.progress, duration:j.duration, error:j.error || null,
    createdAt:j.createdAt, updatedAt:j.updatedAt,
    downloadUrl:j.status==='completed'?'/api/jobs/'+j.id+'/download':null
  });
  let busy=false;
  async function work() {
    if(busy)return;
    busy=true;
    try {
      while(true) {
        const job=jobs.find(j=>j.status==='queued');
        if(!job)break;
        job.status='processing';job.updatedAt=new Date().toISOString();save();
        const output=path.join(outputs,job.id+'.'+job.format);
        try {
          await execute(path.join(inputs,job.inputId),output,job.options,progress=>{
            const next=Math.max(0,Math.min(99,Math.floor(progress)));
            if(next>job.progress) {job.progress=next;job.updatedAt=new Date().toISOString();save();}
          });
          if(!fs.existsSync(output)||fs.statSync(output).size===0)throw Error('No output file was created');
          job.status='completed';job.progress=100;job.updatedAt=new Date().toISOString();save();
        } catch(e) {
          job.status='failed';job.error=String(e.message).slice(0,400);job.updatedAt=new Date().toISOString();save();
          try {fs.unlinkSync(output);} catch {}
        }
      }
    } finally {busy=false;}
  }
  const upload=multer({
    storage:multer.diskStorage({
      destination:(_req,_file,cb)=>cb(null,inputs),
      filename:(_req,_file,cb)=>cb(null,crypto.randomUUID())
    }),
    limits:{fileSize:Math.min(1024**3,Number(process.env.MAX_UPLOAD_BYTES)||256*1024**2),files:1},
    fileFilter:(_req,file,cb)=>/\.(mp4|mkv|mov|webm|m4v|avi)$/i.test(file.originalname)
      ?cb(null,true):cb(new Error('Unsupported video extension'))
  }).single('file');
  const app=express();
  app.disable('x-powered-by');
  app.use(express.json({limit:'16kb'}));
  app.use(express.static(path.join(__dirname,'public')));
  app.get('/api/health',(_req,res)=>res.json({status:'ok',mode:'ffmpeg',busy}));
  app.get('/api/state',(_req,res)=>res.json({
    mode:'ffmpeg',agents:[],tools:[],
    jobs:jobs.map(j=>({...display(j),agents:0,duration:j.duration+'s',date:j.createdAt})),
    pipelineProgress:jobs[0]?.progress||0,
    logs:jobs.slice(0,100).map(j=>({time:new Date(j.updatedAt).toLocaleTimeString('en-GB',{hour12:false}),
      type:j.status==='failed'?'error':j.status==='completed'?'success':'info',
      msg:j.operation+' '+j.status+' — '+j.source+(j.error?' ('+j.error+')':'')}))
  }));
  app.get('/api/progress',(_req,res)=>res.json({progress:jobs[0]?.progress||0,busy}));
  app.get('/api/events',(req,res)=>{
    res.setHeader('Content-Type','text/event-stream');res.setHeader('Cache-Control','no-cache');
    res.setHeader('Connection','keep-alive');res.flushHeaders();
    res.write('data: {"type":"connected"}\n\n');
    clients.add(res);
    const timer=setInterval(()=>res.write(': heartbeat\n\n'),20000);
    req.on('close',()=>{clearInterval(timer);clients.delete(res);});
  });
  app.post('/api/upload',(req,res)=>upload(req,res,async err=>{
    if(err)return res.status(400).json({error:err.message});
    if(!req.file)return res.status(400).json({error:'Video file is required'});
    try {
      const metadata=await probe(req.file.path);
      const record={id:req.file.filename,name:req.file.originalname,metadata};
      fs.writeFileSync(path.join(inputs,record.id+'.json'),JSON.stringify(record));
      res.status(201).json(record);
    } catch(e) {
      try{fs.unlinkSync(req.file.path);}catch{}
      res.status(422).json({error:e.message});
    }
  }));
  app.post('/api/jobs',(req,res)=>{
    const id=req.body?.uploadId;
    if(typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id))
      return res.status(400).json({error:'Valid uploadId required'});
    let source;
    try{source=JSON.parse(fs.readFileSync(path.join(inputs,id+'.json'),'utf8'));}
    catch{return res.status(404).json({error:'Upload not found'});}
    let options;
    try{options=parseOptions(req.body,source.metadata.duration);}
    catch(e){return res.status(400).json({error:e.message});}
    const now=new Date().toISOString();
    const job={id:crypto.randomUUID(),inputId:source.id,source:source.name,
      operation:options.operation,format:options.format,duration:options.duration,
      options,status:'queued',progress:0,createdAt:now,updatedAt:now};
    jobs.unshift(job);save();setImmediate(work);
    res.status(202).json(display(job));
  });
  app.get('/api/jobs',(_req,res)=>res.json(jobs.map(display)));
  app.get('/api/jobs/:id',(req,res)=>{
    const job=jobs.find(j=>j.id===req.params.id);
    if(!job)return res.status(404).json({error:'Job not found'});
    res.json(display(job));
  });
  app.get('/api/jobs/:id/download',(req,res)=>{
    const job=jobs.find(j=>j.id===req.params.id && j.status==='completed');
    if(!job)return res.status(404).json({error:'Completed job not found'});
    res.download(path.join(outputs,job.id+'.'+job.format),'video-'+job.id+'.'+job.format);
  });
  app.post('/api/clone',(_req,res)=>res.status(501).json({error:'AI cloning not implemented. FFmpeg tools are available.'}));
  app.post('/api/export',(_req,res)=>res.status(501).json({error:'Download the output from a completed media job.'}));
  app.post('/api/logs',(_req,res)=>res.status(405).json({error:'Logs are derived from real jobs'}));
  app.delete('/api/logs',(_req,res)=>res.status(405).json({error:'Logs are derived from real jobs'}));
  return app;
}
if(require.main===module) {
  const host=process.env.HOST||'127.0.0.1';
  const port=Number(process.env.PORT||3000);
  createApp().listen(port,host,()=>console.log('Open Video Cloner: http://'+host+':'+port));
}
module.exports={createApp};
