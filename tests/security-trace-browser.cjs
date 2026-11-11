'use strict';
const assert=require('node:assert/strict');
const http=require('node:http');
const {mkdtempSync,mkdirSync,rmSync}=require('node:fs');
const {tmpdir}=require('node:os');
const {join}=require('node:path');
const {chromium,expect}=require('playwright/test');

async function main(){
  const dataDir=mkdtempSync(join(tmpdir(),'trace-browser-'));
  process.env.DATA_DIR=dataDir;
  const {handler}=require('../server.js');
  const server=http.createServer(handler);
  let browser;
  try{
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    browser=await chromium.launch({channel:'chrome'});
    const page=await browser.newPage({viewport:{width:1440,height:1050}});
    await page.emulateMedia({reducedMotion:'reduce'});
    page.setDefaultTimeout(8000);
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    const directory='trace-browser-artifacts';
    mkdirSync(directory,{recursive:true});
    async function shot(name){
      await page.screenshot({path:directory+'/'+name+'.png',fullPage:true});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,
        name+' must not overflow the viewport');
    }
    const action=name=>page.locator('[data-action="'+name+'"]');
    const open=id=>page.locator('[data-action=open][data-case="'+id+'"]').first().click();
    const submit=()=>page.locator('#submit').click();
    const closed=()=>expect(page.locator('.solved-banner')).toBeVisible();

    await page.goto('http://127.0.0.1:'+server.address().port+'/trace');
    await expect(page.locator('.case-card')).toHaveCount(5);
    await shot('01-home-desktop');
    await open('cipher');
    await submit();
    await expect(page.locator('#feedback')).toContainText('/ 8');
    for(const [index,value] of [7,3,1,8,4,6,2,5].entries()){
      for(let i=0;i<value;i++)await page.locator('#key-up-'+index).click();
    }
    await shot('02-cipher-desktop');
    await submit();await closed();
    await expect(page.locator('.source-list a')).toHaveAttribute('href',/nsa.gov/);
    await page.reload();
    await expect(page.locator('.archive-progress')).toContainText('1 / 5');
    await open('ledger');
    await page.locator('#session-S-04').click();
    await page.locator('#job-J-62').click();
    await page.locator('#print-P-4').click();
    await submit();
    await expect(page.locator('#feedback')).toContainText('다른 기록');
    await page.locator('#print-P-3').click();
    await page.locator('#jobShift').selectOption('-3');
    await page.locator('#printShift').selectOption('2');
    await shot('03-ledger-desktop');
    await submit();await closed();

    await page.setViewportSize({width:390,height:844});
    await open('trust');
    await expect(page.locator('#node-lab')).toBeDisabled();
    for(const id of ['mail','lab','backup','archive'])await page.locator('#node-'+id).click();
    await expect(page.locator('.path-list')).toContainText('기록실');
    await action('undo').click();
    await expect(page.locator('.path-list')).not.toContainText('기록실');
    await page.locator('#node-archive').click();
    await action('switch').click();
    await expect(page.locator('.role-pill')).toContainText('방어자');
    await page.locator('#edge-m-l').click();
    await submit();
    await expect(page.locator('#feedback')).toContainText('경로가 남아');
    await page.locator('#edge-m-p').click();
    await shot('04-trust-mobile');
    await submit();await closed();

    await open('heartbeat');
    const range=page.locator('#claimed');
    await range.focus();await page.keyboard.press('End');
    await action('probe').click();
    await expect(page.locator('#feedback')).toContainText('8칸');
    await range.focus();await page.keyboard.press('Home');
    for(let i=0;i<8;i++)await page.keyboard.press('ArrowRight');
    await expect(page.locator('#lengthValue')).toHaveText('8');
    await action('probe').click();
    await expect(page.locator('.packet-response')).toContainText('4 7 2 9');
    await shot('05-heartbeat-mobile');
    await action('switch').click();
    await submit();
    await expect(page.locator('.packet-test.fail')).not.toHaveCount(0);
    await page.locator('#operator').selectOption('≤');
    await submit();await closed();

    await open('outbreak');
    await action('simulate').click();
    await expect(page.locator('#feedback')).toContainText('도달');
    await page.locator('#node-hub').click();
    await action('simulate').click();
    await expect(page.locator('#feedback')).toContainText('병동');
    await page.locator('#edge-l-w').click();
    await action('simulate').click();
    await expect(page.locator('#feedback')).toContainText('보호');
    await expect(page.locator('#node-ward')).not.toHaveClass(/infected/);
    await expect(page.locator('#edge-d-h')).toBeDisabled();
    await shot('06-containment-mobile');
    await submit();await closed();
    await action('archive').first().click();
    await expect(page.locator('.archive-progress')).toContainText('5 / 5');
    await page.reload();
    await expect(page.locator('.completed-tag')).toHaveCount(5);
    await page.setViewportSize({width:1440,height:1050});
    await shot('07-completed-desktop');
    assert.deepEqual(errors,[],'the game must not produce browser exceptions');
    console.log('All five case solutions, rejected hypotheses, undo, perspective switches, mobile layout, and saved progress passed.');
  }finally{
    await browser?.close();
    server.closeAllConnections();
    await new Promise(resolve=>server.close(resolve));
    rmSync(dataDir,{recursive:true,force:true});
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
