const {test,expect}=require('@playwright/test');
const {spawnSync}=require('node:child_process');
test('authenticated project studio: create, upload, process and download real media',async({page,request})=>{
 const key=process.env.OVC_API_KEY,base='http://127.0.0.1:3000';
 await page.goto(base+'/secure.html');
 await page.locator('#token').fill(key);await page.getByRole('button',{name:'Connect'}).click();
 await expect(page.getByText('Authenticated; project records loaded')).toBeVisible();
 await page.locator('#new-project').fill('E2E '+Date.now());await page.getByRole('button',{name:'Create',exact:true}).click();
 const file=require('node:path').resolve('test/fixture.mp4');
 const result=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','testsrc=size=160x90:rate=12','-t','2','-c:v','mpeg4',file]);
 expect(result.status).toBe(0);
 await page.locator('#file').setInputFiles(file);await page.getByRole('button',{name:'Upload & inspect'}).click();
 await expect(page.locator('#metadata')).toContainText('duration');
 await page.getByRole('button',{name:'Create FFmpeg job'}).click();
 await expect(page.locator('#jobs tr').first()).toContainText('completed',{timeout:120000});
 await expect(page.getByRole('button',{name:'Download'})).toBeVisible();
 await page.getByRole('button',{name:'Add selected clip'}).click();await page.getByRole('button',{name:'Render timeline'}).click();
 await expect(page.locator('#jobs tr').first()).toContainText('completed',{timeout:120000});
});