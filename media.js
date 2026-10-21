'use strict';
const { spawn } = require('node:child_process');
const path = require('node:path');

const FORMATS = Object.freeze({
  mp4: { extension: 'mp4', args: ['-c:v','libx264','-preset','veryfast','-pix_fmt','yuv420p','-c:a','aac','-movflags','+faststart'] },
  webm: { extension: 'webm', args: ['-c:v','libvpx-vp9','-deadline','realtime','-cpu-used','5','-c:a','libopus'] },
  mov: { extension: 'mov', args: ['-c:v','libx264','-preset','veryfast','-pix_fmt','yuv420p','-c:a','aac'] },
});
const OPERATIONS = new Set(['transcode','trim','frame']);

function parseOptions(body, sourceDuration) {
  const operation = body.operation || 'transcode';
  if (!OPERATIONS.has(operation)) throw new Error('Unsupported operation');
  const format = body.format || 'mp4';
  if (operation !== 'frame' && !FORMATS[format]) throw new Error('Unsupported output format');
  const start = body.start === undefined ? 0 : Number(body.start);
  const end = body.end === undefined || body.end === '' ? sourceDuration : Number(body.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > sourceDuration + 0.02)
    throw new Error('Invalid trim range');
  if (operation === 'frame' && start >= sourceDuration) throw new Error('Frame time is out of range');
  return { operation, format: operation === 'frame' ? 'jpg' : format, start, end, duration: end - start };
}

function ffprobe(file, executable = process.env.FFPROBE_PATH || 'ffprobe') {
  return new Promise((resolve,reject) => {
    let output = '', errors = '';
    const child = spawn(executable,['-v','error','-show_format','-show_streams','-of','json',file],{stdio:['ignore','pipe','pipe']});
    const timer = setTimeout(()=>child.kill('SIGKILL'),15000);
    child.stdout.on('data',d=>{output+=d; if(output.length>1024*1024)child.kill('SIGKILL');});
    child.stderr.on('data',d=>{errors+=d;});
    child.on('error',reject);
    child.on('close',code=>{
      clearTimeout(timer);
      if(code!==0) return reject(new Error('FFprobe failed: '+errors.slice(-400)));
      try {
        const parsed = JSON.parse(output);
        const duration = Number(parsed.format?.duration);
        if (!Number.isFinite(duration)||duration<=0||duration>24*60*60||!parsed.streams?.some(s=>s.codec_type==='video'))
          throw Error('File is not a supported video or has invalid duration');
        resolve({ duration, streams:parsed.streams.map(s=>({codec_type:s.codec_type,codec_name:s.codec_name,width:s.width,height:s.height})) });
      } catch(e){reject(e);}
    });
  });
}

function buildArgs(input, output, options) {
  const args=['-hide_banner','-nostdin','-y','-v','error'];
  if(options.operation==='frame') {
    return [...args,'-ss',String(options.start),'-i',input,'-frames:v','1','-update','1',output];
  }
  args.push('-ss',String(options.start),'-i',input);
  if(options.operation==='trim'||options.end!==undefined) args.push('-t',String(options.duration));
  args.push('-map','0:v:0','-map','0:a?','-progress','pipe:1','-nostats',...FORMATS[options.format].args,output);
  return args;
}

function runFfmpeg(input, output, options, onProgress, executable=process.env.FFMPEG_PATH||'ffmpeg') {
  return new Promise((resolve,reject)=>{
    const child=spawn(executable,buildArgs(input,output,options),{stdio:['ignore','pipe','pipe']});
    let stderr='',progressBuffer='';
    child.stdout.on('data',data=>{
      progressBuffer+=data.toString();
      const lines=progressBuffer.split('\n');
      progressBuffer=lines.pop();
      for(const line of lines) {
        const match=/^out_time_(?:ms|us)=(\d+)$/.exec(line.trim());
        if(match) onProgress(Math.min(99,Math.max(0,Number(match[1])/1000000/options.duration*100)));
      }
    });
    child.stderr.on('data',data=>{stderr=(stderr+data.toString()).slice(-5000);});
    child.on('error',reject);
    child.on('close',code=>code===0?resolve():reject(new Error('FFmpeg failed (exit '+code+'): '+stderr.slice(-700))));
  });
}

module.exports={FORMATS,OPERATIONS,parseOptions,ffprobe,buildArgs,runFfmpeg};
