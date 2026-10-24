'use strict';
const {spawnSync}=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {dockerBase}=require('../sandbox-worker');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ovc-sandbox-gate-'));
try{
 const input=path.join(dir,'input.bin'),output=path.join(dir,'output');
 fs.writeFileSync(input,Buffer.from('test'));fs.mkdirSync(output);
 const name='ovc-gate-'+process.pid;
 const script=[
 'test -r /input/video',
 'test "$(id -u)" -ne 0',
 'if echo bad > /etc/sandbox-escape 2>/dev/null; then echo writable-root; exit 10; fi',
 'if grep -q "00000000" /proc/net/route; then echo default-route-present; exit 11; fi',
 'grep -q "CapEff:[[:space:]]*0000000000000000" /proc/self/status || { echo caps-present; exit 12; }',
 'echo SANDBOX_NEGATIVE_TESTS_PASS'
 ].join('; ');
 const args=[...dockerBase(input,output,name),'sh','-c',script];
 const run=spawnSync('docker',args,{encoding:'utf8',timeout:30000});
 if(run.status!==0||!run.stdout.includes('SANDBOX_NEGATIVE_TESTS_PASS')) {
  console.error('Docker confinement gate failed:',run.status,run.stdout,run.stderr);
  process.exitCode=1;
 }else console.log('Docker confinement gate passed: nonroot, readonly host-inaccessible root, no default route, dropped caps');
}finally{fs.rmSync(dir,{recursive:true,force:true})}
