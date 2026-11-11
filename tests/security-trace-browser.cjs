'use strict';
const assert=require('node:assert/strict');
const http=require('node:http');
const {mkdtempSync,mkdirSync,rmSync}=require('node:fs');
const {tmpdir}=require('node:os');
const {join}=require('node:path');
const {chromium,expect}=require('playwright/test');
const G=require('../apps/security-trace/archive.js');

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
    async function recordsTab(){
      if(await page.locator('.case-strip').count())await action('archive').first().click();
      await page.locator('[data-action=archive-tab][data-tab=records]').click();
      await action('clear-search').click();
    }
    async function prepareRecord(id){
      const r=G.records.find(r=>r.id===id);
      await recordsTab();
      await page.locator('[data-action=read-doc][data-doc=rooms]').click();
      while(await page.locator('.comparison-desk [data-action=pin-doc]').count()){
        await page.locator('.comparison-desk [data-action=pin-doc]').first().click();
      }
      for(const doc of r.evidence){
        await page.locator('[data-action=read-doc][data-doc="'+doc+'"]').click();
        await page.locator('.document-reader [data-action=pin-doc]').click();
      }
      await page.locator('[data-action=archive-tab][data-tab=registry]').click();
      await page.locator('[data-action=select-record][data-case="'+id+'"]').click();
      await page.locator('#draft-person').selectOption(r.person);
      await page.locator('#draft-team').selectOption(r.team);
      await page.locator('#draft-outcome').selectOption(r.outcome);
      await action('attach-evidence').click();
      await action('check-record').click();
      await expect(page.locator('.registry-actions [data-action=open]')).toBeEnabled();
      await open(id);
    }

    await page.goto('http://127.0.0.1:'+server.address().port+'/trace');
    await expect(page.locator('.document-index [data-action=read-doc]')).toHaveCount(6);
    await page.locator('#recordSearch').fill('회중시계');
    await page.getByRole('button',{name:'검색',exact:true}).click();
    await expect(page.locator('.document-index [data-action=read-doc]')).toHaveCount(3);
    await action('clear-search').click();
    await page.locator('#docNote').fill('시계와 손수건을 대조할 것');
    await page.reload();
    await expect(page.locator('#docNote')).toHaveValue('시계와 손수건을 대조할 것');
    await shot('01-home-desktop');
    await prepareRecord('cipher');
    await submit();
    await expect(page.locator('#feedback')).toContainText('/ 8');
    for(const [index,value] of [7,3,1,8,4,6,2,5].entries()){
      for(let i=0;i<value;i++)await page.locator('#key-up-'+index).click();
    }
    await shot('02-cipher-desktop');
    await submit();await closed();
    await expect(page.locator('.source-list a')).toHaveAttribute('href',/nsa.gov/);
    await page.reload();
    await expect(page.locator('.archive-progress')).toContainText('1 / 7');
    await prepareRecord('ledger');
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
    await prepareRecord('trust');
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

    await prepareRecord('mitm');
    await page.locator('#front-forged').click();
    await page.locator('#back-real').click();
    await action('relay').click();
    await expect(page.locator('.packet-response')).toContainText('전보상자 7');
    await action('switch').click();
    await submit();
    await expect(page.locator('.packet-test.fail')).not.toHaveCount(0);
    await page.locator('#root-ROOT-D').click();
    await page.locator('#verify-host').click();
    await shot('05-mitm-mobile');
    await submit();await closed();

    await prepareRecord('heartbeat');
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

    await prepareRecord('ddos');
    await page.locator('#defense-limit').click();
    await action('traffic-test').click();
    await expect(page.locator('#feedback')).toContainText('정상 이용자');
    await page.locator('#defense-limit').click();
    for(const id of ['challenge','ticket','cache'])await page.locator('#defense-'+id).click();
    await action('traffic-test').click();
    await expect(page.locator('#feedback')).toContainText('네 차례');
    await shot('06-ddos-mobile');
    await submit();await closed();

    await prepareRecord('outbreak');
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
    await expect(page.locator('.archive-progress')).toContainText('7 / 7');
    await expect(page.locator('.guild-ending')).toBeVisible();
    await page.reload();
    await expect(page.locator('.guild-ending')).toBeVisible();
    await page.locator('[data-action=archive-tab][data-tab=people]').click();
    await expect(page.locator('.person-file .recovered')).toHaveCount(7);
    await page.setViewportSize({width:1440,height:1050});
    await shot('07-completed-desktop');
    const legacy=await browser.newPage();
    legacy.on('pageerror',error=>errors.push(error.message));
    await legacy.addInitScript(()=>{
      localStorage.setItem('rice_trace_v1',JSON.stringify({
        version:1,current:'cipher',completed:['cipher'],
        cases:{cipher:{board:{key:[7,3,1,8,4,6,2,5]},hints:2}}
      }));
    });
    await legacy.goto('http://127.0.0.1:'+server.address().port+'/trace');
    await expect(legacy.locator('.secretary-note small')).toContainText('현장 검증 1 / 7');
    await legacy.locator('[data-action=archive-tab][data-tab=registry]').click();
    await legacy.locator('.registry-actions [data-action=open]').click();
    await expect(legacy.locator('.solved-banner')).toBeVisible();
    assert.deepEqual(errors,[],'the game must not produce browser exceptions');
    console.log('All seven cases, archive searches, notes, evidence comparisons, roster deductions, document unlocks, and final epilogue passed.');
  }finally{
    await browser?.close();
    server.closeAllConnections();
    await new Promise(resolve=>server.close(resolve));
    rmSync(dataDir,{recursive:true,force:true});
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
