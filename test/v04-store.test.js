'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {openStore}=require('../sqlite-store');
test('SQLite snapshot transaction and compare-and-set transition',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ovc04-'));try{
 const s=openStore(dir),one={id:'x',status:'queued',projectId:'p'};
 s.saveAll({projects:[{id:'p',name:'Private'}],uploads:[],jobs:[one]});
 assert.equal(s.load('jobs')[0].status,'queued');
 assert.equal(s.transition('x',['processing'],{status:'completed'}),null);
 assert.equal(s.transition('x',['queued'],{status:'processing'}).status,'processing');
 assert.equal(s.transition('x',['queued'],{status:'cancelled'}),null);
 assert.throws(()=>s.saveAll({projects:[{id:'same'},{id:'same'}]}));
 assert.equal(s.load('projects').length,1);
 s.close();const s2=openStore(dir);assert.equal(s2.load('jobs')[0].status,'processing');s2.close();
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
const {dockerBase}=require('../sandbox-worker');
test('Docker worker declares security limits',()=>{
 const a=dockerBase('/tmp/source.mp4','/tmp','ovc-123');
 for(const token of ['--network','none','--read-only','--cap-drop','ALL','--pids-limit','--memory','--cpus','--security-opt','no-new-privileges'])assert.ok(a.includes(token));
 assert.ok(a.includes('type=bind,src=/tmp/source.mp4,dst=/input/video,readonly'));
});
