'use strict';

const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { mkdtempSync, rmSync, mkdirSync } = require('node:fs');
const http = require('node:http');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { chromium, expect, request } = require('playwright/test');
const { story } = require('../mystery-content/d1-gaming.case.json');

async function makeStudyRoom(baseURL, clients) {
  for (const character of story.characters) {
    clients.push(await request.newContext({ baseURL }));
  }
  async function post(player, route, data = {}) {
    const response = await clients[player].post(route, { data });
    assert.ok(response.ok(), route + ': ' + await response.text());
    return response.json();
  }
  const { code } = await post(0, '/api/rooms', { storyId: story.id, name: 'Browser test host' });
  const room = '/api/rooms/' + code;
  for (let i = 1; i < clients.length; i++) {
    await post(i, room + '/join', { name: 'Guest ' + i });
  }
  for (const client of clients) assert.ok((await client.get(room)).ok());
  await post(0, room + '/start');
  for (let i = 0; i < clients.length; i++) await post(i, room + '/read');
  await post(0, room + '/advance');
  for (const [i, { id }] of story.characters.entries()) {
    await post(i, room + '/character', { characterId: id });
  }
  assert.equal((await post(0, room + '/advance')).phase, 'study');
  return {
    code,
    async advance() {
      for (let i = 0; i < clients.length; i++) await post(i, room + '/study-ready');
      assert.equal((await post(0, room + '/advance')).phase, 'investigation1');
    }
  };
}

async function dismissPhaseIntro(page) {
  await page.locator('#phaseIntro button').click({ timeout: 5000 });
}

function mapGeometry(page) {
  return page.locator('#mapTiles').evaluate(node => {
    const rect = node.getBoundingClientRect();
    return [rect.x + scrollX, rect.y + scrollY, rect.width, rect.height];
  });
}

async function checkStudy(page, viewport) {
  await page.setViewportSize(viewport);
  const dock = page.locator('.hud-actions');
  await dock.scrollIntoViewIfNeeded();
  const before = await mapGeometry(page);
  for (const tab of ['context', 'whisper', 'progress']) {
    await dock.locator('[data-action="' + tab + '-toggle"]').click();
    const panel = page.locator('.left-utility');
    await expect(panel).toBeVisible();
    assert.deepEqual(await mapGeometry(page), before, tab + ' shifts or resizes the map');
    await panel.locator('[data-action=panel-close]').click();
    assert.deepEqual(await mapGeometry(page), before, tab + ' close shifts or resizes the map');
  }

  await dock.locator('[data-action=book-toggle]').click();
  const paging = page.getByRole('navigation', { name: '책자 페이지 이동' });
  const panelBody = page.locator('.scene-panel-body');
  const count = paging.locator('span');
  const previous = paging.getByRole('button', { name: '← 이전 장' });
  const next = paging.getByRole('button', { name: '다음 장 →' });
  const start = await count.innerText();
  const total = start.split(' / ')[1];
  await expect(previous).toBeDisabled();
  await page.keyboard.press('ArrowRight');
  await expect(count).toHaveText('2 / ' + total);
  await page.keyboard.press('ArrowLeft');
  await expect(count).toHaveText(start);
  await next.click();
  await expect(count).toHaveText('2 / ' + total);
  await panelBody.evaluate(node => { node.scrollTop = node.scrollHeight; });
  assert.ok(await paging.evaluate(node =>
    node.getBoundingClientRect().top >= node.parentElement.getBoundingClientRect().top),
  'page buttons stay inside the visible panel after scrolling');
  await previous.click();
  await expect(count).toHaveText(start);
  await page.locator('.scene-panel-header [data-action=panel-close]').click();
  assert.deepEqual(await mapGeometry(page), before, 'booklet changes the map geometry');
}

async function checkInvestigationKeys(page) {
  const utility = page.locator('#hudUtility');
  const selected = utility.locator('[aria-current=true]');
  const prompt = page.locator('#choicePrompt');
  const clue = page.locator('#clueModalRoot');
  const press = key => page.keyboard.press(key);
  const location = () => page.evaluate(() => {
    const { room } = window.MysteryRoomState;
    return room.players.find(player => player.id === room.me).position;
  });
  const walk = async (key, points) => {
    for (const [x, y] of points) {
      // The multiplayer server throttles successive moves to 140 ms.
      await page.waitForTimeout(160);
      await press(key);
      await expect.poll(location).toMatchObject({ x, y });
    }
  };

  await walk('ArrowRight', Array.from({ length: 8 }, (_, i) => [i + 3, 6]));
  const stairs = await location();
  await press('e');
  await expect(selected).toContainText('아래층');
  await press('ArrowDown');
  await expect(selected).toContainText('위층');
  await press('ArrowUp');
  await expect(selected).toContainText('아래층');
  assert.deepEqual(await location(), stairs, 'arrows must not move the player in the E menu');
  await press('f');
  await expect(prompt).toContainText('아래층');
  await press('Escape');
  await expect(selected).toContainText('아래층');
  assert.deepEqual(await location(), stairs, 'opening or cancelling a stair action must not move the player');
  await press('Escape');

  await walk('ArrowLeft', Array.from({ length: 5 }, (_, i) => [9 - i, 6]));
  await page.waitForTimeout(160);
  await press('Shift+ArrowUp');
  await expect(page.locator('#sceneLocation')).toContainText('위쪽');
  await press('e');
  await expect(selected).toContainText('닫기');
  await press('f');
  await expect(prompt).toContainText('닫기');
  await press('f');
  await expect(selected).toContainText('열기');
  await press('f');
  await press('f');
  await expect(selected).toContainText('닫기');
  await press('Escape');
  await walk('ArrowUp', [[5, 5], [5, 4], [5, 3]]);
  await walk('ArrowLeft', [[4, 3]]);

  const tokens = page.locator('#hudStatus .token-count');
  const initialTokens = Number(await tokens.innerText());
  await press('e');
  await expect(utility.locator('[data-card=time_practice_live]')).toBeDisabled();
  await expect(utility.locator('[data-card=time_practice_live]')).toContainText('조사 불가');
  await press('ArrowRight');
  await expect(selected).toHaveAttribute('data-card', 'cult_old_team_photo');
  await press('f');
  await expect(clue).toBeVisible();
  await press('f');
  await expect(prompt).toContainText('조사 토큰 1개');
  await press('Escape');
  await expect(prompt).toHaveCount(0);
  await expect(tokens).toHaveText(String(initialTokens));
  await press('f');
  await press('f');
  await expect(clue.locator('.show-back')).toBeVisible();
  await expect(tokens).toHaveText(String(initialTokens - 1));
  await press('Escape');
  await expect(selected).toHaveAttribute('data-card', 'cult_old_team_photo');
  await press('e');
  await expect(utility).toHaveCount(0);
  await press('p');
  await expect(selected).toBeVisible();
  await press('Escape');
}

async function main() {
  const clients = [];
  const dataDir = mkdtempSync(join(tmpdir(), 'rice-mystery-browser-'));
  process.env.DATA_DIR = dataDir;
  const password = randomBytes(24).toString('hex');
  process.env.STUDIO_ADMIN_PASSWORD = password;
  const { handler } = require('../server.js');
  const server = http.createServer(handler);
  let browser;
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const baseURL = 'http://127.0.0.1:' + server.address().port;
    const game = await makeStudyRoom(baseURL, clients);
    browser = await chromium.launch({ channel: 'chrome' });
    const live = await browser.newContext({ baseURL, storageState: await clients[0].storageState() });
    const page = await live.newPage();
    await page.goto('/mystery?room=' + game.code);
    await dismissPhaseIntro(page);
    const viewports = [{ width: 1360, height: 900 }, { width: 390, height: 844 }];
    for (const viewport of viewports) await checkStudy(page, viewport);
    await game.advance();
    await dismissPhaseIntro(page);
    await page.locator('[data-action=research-toggle]').click();
    const before = await mapGeometry(page);
    await page.locator('.scene-panel-body [data-action=clue-open]').first().click();
    await expect(page.locator('#clueModalRoot')).toBeVisible();
    assert.deepEqual(await mapGeometry(page), before, 'clue popup changes the map geometry');
    await page.keyboard.press('Escape');
    await expect(page.locator('#clueModalRoot')).toHaveCount(0);
    assert.deepEqual(await mapGeometry(page), before, 'closing clue popup changes the map geometry');
    await page.keyboard.press('Escape');
    await checkInvestigationKeys(page);

    const studio = await browser.newContext({
      baseURL,
      httpCredentials: { username: 'operator', password, origin: baseURL }
    });
    const preview = await studio.newPage();
    await preview.goto('/mystery-test');
    await preview.locator('#testSource').selectOption('server:' + story.id);
    await preview.locator('#testLoad').click();
    await preview.locator('#testPhase').selectOption('study');
    await dismissPhaseIntro(preview);
    for (const viewport of viewports) await checkStudy(preview, viewport);
    await preview.locator('#testPhase').selectOption('investigation1');
    await dismissPhaseIntro(preview);
    await checkInvestigationKeys(preview);
    const screenshots=join(process.cwd(),'artifacts/mystery');
    mkdirSync(screenshots,{recursive:true});
    await preview.setViewportSize(viewports[0]);
    await preview.locator('#testSource').selectOption('server:jeju-lab-conference');
    await preview.locator('#testLoad').click();
    await preview.locator('#testPhase').selectOption('study');
    await dismissPhaseIntro(preview);
    await preview.locator('[data-action=book-toggle]').click();
    await expect(preview.locator('image[href$="/seoha.webp"]').first()).toBeAttached();
    await preview.screenshot({path:join(screenshots,'jeju-study-desktop.png'),fullPage:true});
    await preview.keyboard.press('Escape');
    const jeju=require('../mystery-content/jeju-lab-conference.case.json');
    const artFiles=['backgrounds/jeju-lab-conference-background.webp',
      ...[...jeju.story.characters,jeju.story.victim].map(c=>'portraits/'+jeju.story.id+'/'+c.id+'.webp'),
      ...jeju.game.investigation.cards.map(c=>'clues/'+jeju.story.id+'/'+c.id+'.webp')];
    for(const file of artFiles){
      const response=await studio.request.get('/apps/murder-mystery/assets/'+file);
      assert.equal(response.status(),200,file);assert.ok((await response.body()).length>5000,file);
    }
    await preview.locator('#testPhase').selectOption('investigation1');
    await dismissPhaseIntro(preview);
    await preview.locator('[data-action=research-toggle]').click();
    await preview.screenshot({path:join(screenshots,'jeju-investigation-desktop.png'),fullPage:true});
    const qa=await browser.newContext({baseURL});const qaPage=await qa.newPage();
    await qaPage.goto('/mystery');
    await qaPage.locator('#storySelection').selectOption('multiplayer-test');
    await qaPage.locator('#testPlayerCount').selectOption('3');
    await qaPage.locator('#displayName').fill('브라우저 테스트');
    await qaPage.locator('[data-action=create]').click();
    await expect(qaPage.getByText('1 / 3명 참가',{exact:true})).toBeVisible();
    await qaPage.screenshot({path:join(screenshots,'qa-three-player-lobby.png'),fullPage:true});
    console.log('Jeju real assets and variable-capacity QA room creation passed.');
    console.log('Live room and Studio passed map, booklet, and keyboard investigation checks.');
  } finally {
    await browser?.close();
    for (const client of clients) await client.dispose();
    if (server.listening) {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
    rmSync(dataDir, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
