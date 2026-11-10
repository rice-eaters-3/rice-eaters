'use strict';

const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { mkdtempSync, rmSync } = require('node:fs');
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
    browser = await chromium.launch();
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
    console.log('Live room and Studio passed desktop and mobile map and booklet checks.');
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
