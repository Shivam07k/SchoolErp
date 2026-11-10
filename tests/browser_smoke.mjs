import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { SCHOOL_MENU } from '../src/school/menu.js';

const apiPort = 3100;
const webPort = 5173;
const root = process.cwd();
const smokeUser = process.env.SMOKE_USERID || 'ADMIN';
const smokePassword = process.env.SMOKE_PASSWORD;
if (!smokePassword) {
  console.error('Set SMOKE_PASSWORD to the local ADMIN password before running the smoke test.');
  process.exit(2);
}
const processes = [];
const errors = [];
const apiFailures = [];
const httpFailures = [];

const builtRoutes = SCHOOL_MENU.flatMap((module) => [
  ...(module.built && module.path ? [module.path] : []),
  ...(module.children || []).filter((child) => child.built).map((child) => child.path),
]);

function start(command, args, cwd, env) {
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr.on('data', (chunk) => process.stderr.write(chunk));
  processes.push(child);
  return child;
}

async function waitFor(url) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return;
    } catch { /* retry while the process starts */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

try {
  start(process.execPath, ['src/index.js'], `${root}\\server`, {
    PORT: String(apiPort),
    CLUSTER_WORKERS: '1',
    RATE_LIMIT_MAX: '100000',
  });
  start(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(webPort)], root, {});
  await waitFor(`http://127.0.0.1:${apiPort}/api/healthz`);
  await waitFor(`http://127.0.0.1:${webPort}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('Failed to load resource')) {
      errors.push(`console: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('response', (response) => {
    if (response.url().includes('/api/') && response.status() >= 500) {
      apiFailures.push(`${response.status()} ${response.url()}`);
    }
    if (response.status() >= 400) {
      httpFailures.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.goto(`http://127.0.0.1:${webPort}`, { waitUntil: 'networkidle' });
  await page.getByText('Welcome back').waitFor();
  await page.getByPlaceholder('Enter user ID').fill(smokeUser);
  await page.getByPlaceholder('Enter password').fill(smokePassword);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/#\/school\/dashboard/);
  await page.locator('.school-sidebar').waitFor();
  await page.getByRole('heading', { level: 1 }).waitFor();
  const dashboardA11y = await new AxeBuilder({ page }).analyze();
  assert.deepEqual(
    dashboardA11y.violations,
    [],
    `dashboard accessibility violations: ${dashboardA11y.violations.map((violation) => violation.id).join(', ')}`,
  );

  for (const route of builtRoutes) {
    await page.goto(`http://127.0.0.1:${webPort}/#${route}`, { waitUntil: 'domcontentloaded' });
    await page.locator('.main-content').waitFor();
    assert.equal(await page.locator('.main-content').count(), 1, `main content missing for ${route}`);
    await page.waitForTimeout(100);
  }

  await page.goto(`http://127.0.0.1:${webPort}/#/school/settings/users`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /add user/i }).click();
  const groupPicker = page.locator('#user-groups');
  await groupPicker.waitFor();
  const apiGroupCount = await page.evaluate(async () => {
    const token = sessionStorage.getItem('xerp_token');
    const response = await fetch('/api/school/groups', { headers: { Authorization: `Bearer ${token}` } });
    const data = await response.json();
    return data.groups?.length || 0;
  });
  assert.equal(
    await groupPicker.locator('option:not([disabled])').count(),
    apiGroupCount,
    'user group selector contains every available group',
  );
  const apiRoleCount = await page.evaluate(async () => {
    const token = sessionStorage.getItem('xerp_token');
    const response = await fetch('/api/school/roles', { headers: { Authorization: `Bearer ${token}` } });
    const data = await response.json();
    return data.roles?.length || 0;
  });
  const roleCheckboxes = page.locator('.modal-dialog input[type="checkbox"]');
  assert.equal(await roleCheckboxes.count(), apiRoleCount, 'user form contains every available role');
  const firstRole = roleCheckboxes.first();
  if (await firstRole.count()) {
    await firstRole.check();
    assert.equal(await firstRole.isChecked(), true, 'first user role can be selected');
    await firstRole.uncheck();
  }
  const firstGroup = groupPicker.locator('option:not([disabled])').first();
  if (await firstGroup.count()) {
    const groupValue = await firstGroup.getAttribute('value');
    await groupPicker.selectOption(groupValue);
    assert.equal(await groupPicker.inputValue(), groupValue, 'first user group can be selected');
  }
  await page.getByRole('button', { name: 'Cancel' }).click();

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`http://127.0.0.1:${webPort}/#/school/dashboard`, { waitUntil: 'networkidle' });
  const hamburger = page.getByRole('button', { name: 'Toggle menu' });
  await hamburger.waitFor();
  await hamburger.click();
  await page.locator('.school-sidebar.mobile-open').waitFor();
  await page.keyboard.press('Escape');

  await browser.close();
  assert.deepEqual(errors, [], `browser runtime errors: ${errors.join('; ')}`);
  assert.deepEqual(apiFailures, [], `browser API 5xx responses: ${apiFailures.join('; ')}`);
  assert.deepEqual(httpFailures, [], `browser HTTP failures: ${httpFailures.join('; ')}`);
  console.log(`Browser route audit passed: login, dashboard, ${builtRoutes.length} built routes, responsive sidebar, no console/page errors or HTTP/API failures`);
} finally {
  for (const child of processes) {
    if (!child.killed) child.kill();
  }
}
