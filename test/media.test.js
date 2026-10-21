'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {parseOptions,buildArgs}=require('../media');

test('accepts supported transcode and trim options',()=>{
  assert.deepEqual(parseOptions({operation:'trim',format:'webm',start:3,end:6},10),{
    operation:'trim',format:'webm',start:3,end:6,duration:3
  });
  const args=buildArgs('/tmp/input.mp4','/tmp/output.webm',parseOptions({operation:'trim',format:'webm',start:3,end:6},10));
  assert.equal(args[args.indexOf('-ss')+1],'3');
  assert.equal(args[args.indexOf('-t')+1],'3');
  assert.ok(args.includes('libvpx-vp9'));
  assert.ok(!args.includes('shell'));
});
test('frame extraction uses a single actual frame',()=>{
  const opts=parseOptions({operation:'frame',start:2},10);
  assert.equal(opts.format,'jpg');
  const args=buildArgs('in.mp4','out.jpg',opts);
  assert.ok(args.includes('-frames:v'));
  assert.equal(args[args.indexOf('-frames:v')+1],'1');
});
test('rejects invalid inputs instead of passing unchecked arguments',()=>{
  const invalid=[
    [{operation:'unknown'},10],
    [{format:'exe'},10],
    [{operation:'trim',start:-1,end:3},10],
    [{operation:'trim',start:7,end:6},10],
    [{operation:'trim',start:0,end:99},10],
    [{operation:'trim',start:'abc'},10],
    [{operation:'frame',start:10},10],
  ];
  for(const [body,duration] of invalid)assert.throws(()=>parseOptions(body,duration));
});
