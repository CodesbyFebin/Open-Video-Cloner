'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {ffprobe,runFfmpeg,parseOptions}=require('../media');
const available=spawnSync('ffmpeg',['-version'],{encoding:'utf8'}).status===0 &&
  spawnSync('ffprobe',['-version'],{encoding:'utf8'}).status===0;
test('real FFmpeg/FFprobe: inspect, trim/transcode and produce playable media',{skip:!available},async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ovc-ffmpeg-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const input=path.join(dir,'input.avi'),output=path.join(dir,'output.mp4');
  const fixture=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=blue:s=160x90:r=10','-t','2','-c:v','mpeg4','-y',input],{encoding:'utf8',timeout:30000});
  assert.equal(fixture.status,0,fixture.stderr);
  const source=await ffprobe(input);
  assert.ok(source.duration>=1.9);
  const opts=parseOptions({operation:'trim',start:0.25,end:1.25,format:'mp4'},source.duration);
  const progress=[];
  await runFfmpeg(input,output,opts,p=>progress.push(p));
  assert.ok(fs.statSync(output).size>0);
  const result=await ffprobe(output);
  assert.ok(result.duration>0.8&&result.duration<1.4);
  assert.ok(progress.every(p=>p>=0&&p<=99));
});
