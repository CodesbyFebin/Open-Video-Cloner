const REPO = 'CodesbyFebin/Open-Video-Cloner';
export const tasks = Object.freeze({
  tests: {
    label: 'Test and verification',
    prompt: 'Inspect the Open-Video-Cloner repository. Add reproducible automated tests for the actual Express API and media.js FFmpeg argument/validation behavior. Include error-path tests, test fixtures, and a GitHub Actions test workflow. Do not report success without running tests. Do not invent real video processing, screenshots, agent statuses, or metrics. Keep changes minimal and submit a PR with test evidence.'
  },
  ffmpeg: {
    label: 'FFmpeg integration',
    prompt: 'Integrate existing media.js into the Express application with secure local file upload, FFprobe validation, a durable job queue, real FFmpeg progress, completed media download and end-to-end tests. Connect actual job state to the existing dashboard. Avoid URL-based SSRF, shell interpolation, fake progress, arbitrary paths and unauthenticated public exposure. Keep AI cloning endpoints clearly unsupported. Submit a PR with actual test results.'
  },
  audit: {
    label: 'Repository audit',
    prompt: 'Audit Open-Video-Cloner for security, simulated or hard-coded UI values, broken features, tests and dependency risks. Replace demonstrably fake success claims with truthful status. Add a reproducible audit report and tests for critical issues. Do not invent outcomes or implement AI model capabilities unless genuinely wired and tested. Submit a PR with evidence.'
  }
});
export function validateTask({preset,prompt,branch='main',autoPr=true}) {
  if(typeof branch!=='string'|| !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,99}$/.test(branch)||branch.includes('..')||branch.endsWith('/')||branch.startsWith('-'))
    throw new Error('Invalid base branch');
  if(preset && !Object.hasOwn(tasks,preset))throw new Error('Unknown preset');
  const taskPrompt = prompt ?? (preset && tasks[preset].prompt);
  if(typeof taskPrompt!=='string'||taskPrompt.trim().length<20||taskPrompt.length>12000)
    throw new Error('Provide a task prompt between 20 and 12000 characters or a valid preset');
  if(autoPr!==true)throw new Error('This integration requires PR review; autoPr must remain enabled');
  return {prompt:taskPrompt,source:{github:REPO,baseBranch:branch},autoPr:true};
}
export function formatActivity(activity){
  const record={type:String(activity?.type||'unknown'),at:String(activity?.createTime||new Date().toISOString())};
  if(typeof activity?.title==='string')record.title=activity.title.slice(0,300);
  if(typeof activity?.message==='string')record.message=activity.message.slice(0,1200);
  if(activity?.type==='planGenerated')record.steps=activity.plan?.steps?.map(s=>String(s.title||'Step')).slice(0,30)||[];
  if(Array.isArray(activity?.artifacts)) {
    record.artifacts=activity.artifacts.slice(0,25).map(a=>{
      if(a.type==='changeSet'){
        try{
          const files=a.parsed().files||[];
          return {type:'changeSet',files:files.slice(0,60).map(f=>({path:String(f.path),additions:f.additions,deletions:f.deletions}))};
        }catch{return {type:'changeSet',unavailable:true};}
      }
      // No arbitrary shell output or media blobs in console JSON (could contain secrets).
      return {type:String(a.type||'other')};
    });
  }
  return record;
}
export async function startSession(client,input) {
  return client.session(validateTask(input));
}
export async function readStatus(client,id){
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(id||''))throw new Error('Invalid session ID');
  return client.session(id).info();
}
export async function approvePlan(client,id){
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(id||''))throw new Error('Invalid session ID');
  return client.session(id).approve();
}
