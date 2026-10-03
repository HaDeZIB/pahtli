import { expect, test, type Page } from '@playwright/test';

/**
 * Prueba de "modo avión" de punta a punta:
 *  instalar SW con señal → cortar la red → recargar (la app sale del precache) →
 *  triaje por texto de un niño con signos respiratorios graves → URGENCIA en rojo →
 *  guardar caso → volver la señal → la cola se envía a /api/sync (simulado) y queda en 0.
 */

const URGENT_CHILD = 'Niña de 1 año, tiene calentura desde ayer, respira muy rápido y se le hunde el pecho.';

async function waitForServiceWorker(page: Page) {
  await page.waitForFunction(async () => {
    if (!('serviceWorker' in navigator)) return false;
    const reg = await navigator.serviceWorker.ready;
    return !!reg.active && reg.active.state === 'activated' && !!navigator.serviceWorker.controller;
  }, undefined, { timeout: 90_000 });
}

test('triaje completo sin internet y sincronización al volver la señal', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  // /api/sync simulado: acepta todos los case_id recibidos (como el servidor en modo demo).
  const syncBodies: { cases: Record<string, unknown>[] }[] = [];
  await context.route('**/api/sync', async (route) => {
    const body = route.request().postDataJSON() as { cases: Record<string, unknown>[] };
    syncBodies.push(body);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ stored: false, demo: true, accepted: body.cases.map((c) => c.case_id), rejected: [] }),
    });
  });

  // 1) Con señal: abrir la app y esperar a que el service worker precachee todo.
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Nuevo paciente' })).toBeVisible();
  await waitForServiceWorker(page);

  // Comunidad del piloto (llena coordenadas) para que el resultado muestre el centro más cercano.
  await page.goto('/#/config');
  await page.getByLabel('Comunidad').fill('San Miguel Tzinacapan');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Guardado' })).toBeVisible();

  // El precache incluye el runtime de voz (wasm) y el chunk lazy del tablero.
  const precached = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      if (!name.includes('precache')) continue;
      for (const req of await (await caches.open(name)).keys()) urls.push(new URL(req.url).pathname);
    }
    return urls;
  });
  expect(precached.some((u) => /ort-wasm-simd-threaded\.asyncify-.*\.wasm$/.test(u))).toBe(true);
  expect(precached.some((u) => /\/assets\/Dashboard-.*\.js$/.test(u))).toBe(true);
  expect(precached.some((u) => u.endsWith('/data/facilities.json'))).toBe(true);

  // 2) Modo avión. Recargar demuestra que la app completa sale del caché del SW.
  await context.setOffline(true);
  await page.goto('/#/');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Nuevo paciente' })).toBeVisible();
  await expect(page.getByText('Sin internet — todo corre en tu celular')).toBeVisible();

  // 3) Triaje por texto.
  await page.getByRole('tab', { name: 'Escribir' }).click();
  await page.locator('#transcript').fill(URGENT_CHILD);
  await page.getByRole('main').getByRole('button', { name: 'Evaluar', exact: true }).click();

  // Si el motor pidiera datos, se saltan (el caso ya trae los signos de alarma).
  await page.waitForURL(/#\/(resultado|preguntas)/);
  if (page.url().includes('#/preguntas')) await page.getByRole('button', { name: 'Saltar' }).click();
  await page.waitForURL(/#\/resultado/);

  // 4) Resultado: URGENCIA a pantalla completa en rojo, con la regla AIEPI citada.
  const title = page.getByRole('heading', { level: 1 });
  await expect(title).toHaveText(/urgencia/i);
  const bg = await page.locator('div.min-h-dvh[style]').first().evaluate((el) => getComputedStyle(el).backgroundColor);
  const [r, g, b] = (bg.match(/\d+/g) ?? []).map(Number);
  expect(r).toBeGreaterThan(150);
  expect(g).toBeLessThan(80);
  expect(b).toBeLessThan(80);
  await expect(page.getByText('IMCI-RESP-03')).toBeVisible();
  // Referencia offline (catálogo CLUES precacheado): hospital más cercano.
  await expect(page.getByTestId('referral')).toContainText('Hospital más cercano');

  // 5) Guardar caso → queda en la cola local.
  await page.getByRole('button', { name: 'Guardar caso' }).click();
  await expect(page.getByRole('button', { name: 'Caso guardado' })).toBeVisible();
  await page.getByRole('button', { name: 'Nuevo paciente' }).click();
  await expect(page.getByRole('button', { name: '1 caso por enviar' })).toBeVisible();

  await page.goto('/#/historial');
  await expect(page.getByText('Por enviar').first()).toBeVisible();
  expect(syncBodies).toHaveLength(0);

  // El tablero (chunk lazy) también abre sin señal y ya cuenta el caso local pendiente.
  await page.goto('/#/tablero');
  await expect(page.getByRole('heading', { name: 'Tablero del Centro de Salud' })).toBeVisible();
  await expect(page.getByText('Pendientes de sincronizar')).toBeVisible();
  await expect(page.getByText('Posible brote', { exact: false }).first()).toBeVisible();
  await page.goto('/#/historial');

  // 6) Vuelve la señal → sincronización automática → cola en 0.
  await context.setOffline(false);
  await expect(page.getByRole('button', { name: 'Todo enviado' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Enviado', { exact: true }).first()).toBeVisible();

  expect(syncBodies.length).toBeGreaterThanOrEqual(1);
  const sent = syncBodies.flatMap((b) => b.cases);
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatchObject({ level: 'urgencia', comunidad: 'San Miguel Tzinacapan', syndrome: 'respiratorio' });
  expect(sent[0].rule_ids).toContain('IMCI-RESP-03');
  // Privacidad: el texto libre no sale del celular.
  expect(JSON.stringify(sent)).not.toContain('calentura');
  expect(sent[0]).not.toHaveProperty('transcript');

  expect(errors).toEqual([]);
});
