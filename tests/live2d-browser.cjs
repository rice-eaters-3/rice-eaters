'use strict';
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {chromium,expect}=require('playwright/test');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'live2d-browser-'));process.env.DATA_DIR=dir;const {handler}=require('../server');const server=http.createServer(handler);let browser;
 try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({channel:'chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const page=await browser.newPage({viewport:{width:1440,height:1080}});page.setDefaultTimeout(20000);const errors=[];page.on('pageerror',e=>errors.push(e.message));fs.mkdirSync('live2d-browser-artifacts',{recursive:true});
  await page.goto('http://127.0.0.1:'+server.address().port+'/live2d');await expect(page.locator('#canvas-message')).toBeHidden();await expect(page.locator('#parameters input')).toHaveCount(13);await expect(page.locator('#generate')).toBeDisabled();await expect(page.locator('#download')).toBeEnabled();
  await page.locator('#fit').click();await page.screenshot({path:'live2d-browser-artifacts/studio-desktop.png',fullPage:true});
  const before=await page.locator('#model-canvas').evaluate(c=>c.toDataURL());for(const [id,value] of [['ParamMouthOpenY','1'],['ParamAngleX','25'],['ParamEyeLOpen','0']])await page.locator('#param-'+id).evaluate((el,v)=>{el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));},value);await page.waitForTimeout(200);const after=await page.locator('#model-canvas').evaluate(c=>c.toDataURL());assert.notEqual(before,after,'runtime pose must actually alter pixels');await page.screenshot({path:'live2d-browser-artifacts/studio-pose.png',fullPage:true});
  const stats=await page.locator('#model-canvas').evaluate(c=>{const g=c.getContext('webgl'),p=new Uint8Array(c.width*c.height*4);g.readPixels(0,0,c.width,c.height,g.RGBA,g.UNSIGNED_BYTE,p);let n=0;for(let i=3;i<p.length;i+=4)if(p[i]>10)n++;return {pixels:n,error:g.getError()};});assert.ok(stats.pixels>20000,'model has visible mesh pixels');assert.equal(stats.error,0,'WebGL rendering has no errors');
  const downloadEvent=page.waitForEvent('download');await page.locator('#download').click();const download=await downloadEvent;assert.equal(download.suggestedFilename(),'Lumi.zip');await download.saveAs('live2d-browser-artifacts/Lumi.zip');
  await page.locator('#connect').click();await expect(page.locator('#api-dialog')).toBeVisible();await expect(page.locator('#api-key')).toHaveAttribute('type','password');await page.locator('#close-api').click();
  await page.locator('#fit').click();await page.locator('#model-canvas').screenshot({path:'live2d-browser-artifacts/lumi-model.png'});
  await page.locator('#idle').check();for(let i=0;i<12;i++){await page.waitForTimeout(160);await page.locator('#model-canvas').screenshot({path:'live2d-browser-artifacts/lumi-frame-'+String(i).padStart(2,'0')+'.png'});}
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'live2d-browser-artifacts/studio-mobile.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);console.log('Live2D browser: actual WebGL mesh pixels, 13 controls, pose changes, sample ZIP, API gate, desktop/mobile passed');
 }finally{await browser?.close();await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
