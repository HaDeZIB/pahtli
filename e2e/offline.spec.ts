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
  await expect(page.getByText('Sin internet — todo funciona en este celular')).toBeVisible();

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

  // 5) La promotora confirma la sugerencia ("Pahtli sugiere. Usted decide.") → queda en la cola local.
  await expect(page.getByTestId('decision')).toContainText('Pahtli sugiere. Usted decide.');
  await page.getByRole('button', { name: 'Estoy de acuerdo · Guardar caso' }).click();
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
  expect(sent[0]).toMatchObject({ decision: { final_level: 'urgencia', overridden: false } });
  // Privacidad: el texto libre no sale del celular.
  expect(JSON.stringify(sent)).not.toContain('calentura');
  expect(sent[0]).not.toHaveProperty('transcript');

  expect(errors).toEqual([]);
});

/** Lee los casos guardados en IndexedDB (Dexie, base "pahtli", tabla "cases") sin depender del código de la app. */
async function storedCases(page: Page): Promise<Record<string, unknown>[]> {
  return page.evaluate(() => new Promise<Record<string, unknown>[]>((resolve, reject) => {
    const open = indexedDB.open('pahtli');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const req = open.result.transaction('cases', 'readonly').objectStore('cases').getAll();
      req.onsuccess = () => { resolve(req.result as Record<string, unknown>[]); open.result.close(); };
      req.onerror = () => reject(req.error);
    };
  }));
}

test('"No sé" → aviso "No estoy segura", la promotora decide antes de guardar y se ve la referencia', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const syncBodies: { cases: Record<string, unknown>[] }[] = [];
  await context.route('**/api/sync', async (route) => {
    const body = route.request().postDataJSON() as { cases: Record<string, unknown>[] };
    syncBodies.push(body);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ stored: false, demo: true, accepted: body.cases.map((c) => c.case_id), rejected: [] }) });
  });

  await page.goto('/#/config');
  await page.getByLabel('Comunidad').fill('San Miguel Tzinacapan');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Guardado' })).toBeVisible();

  // Caso sin signos de alarma: antes de "Atender aquí" el motor revisa los signos de peligro (lista para 5 años o más,
  // sin palabras de bebé). A esa revisión y a la siguiente pregunta Sí/No se responde "No sé".
  await page.goto('/#/');
  await page.getByRole('tab', { name: 'Escribir' }).click();
  await page.locator('#transcript').fill('Niña de 5 años con calentura desde ayer, dice su mamá que comió poquito.');
  await page.getByRole('main').getByRole('button', { name: 'Evaluar', exact: true }).click();
  await page.waitForURL(/#\/preguntas/);
  await expect(page.getByRole('heading', { name: '¿Tiene alguno de estos signos de peligro?' })).toBeVisible();
  const signs = page.getByTestId('question-list');
  await expect(signs).toContainText('Le cuesta mucho trabajo respirar');
  await expect(signs).not.toContainText('mamar');
  await page.getByRole('button', { name: 'No sé', exact: true }).click();
  await expect(signs).toHaveCount(0);
  await page.getByRole('button', { name: 'No sé', exact: true }).click();
  // Las demás preguntas (si las hay) se contestan "No".
  for (let i = 0; i < 4 && page.url().includes('#/preguntas'); i++) {
    await page.getByRole('button', { name: 'No', exact: true }).click();
    await page.waitForTimeout(150);
  }
  await page.waitForURL(/#\/resultado/);

  // Fail-safe: estado gris "No estoy segura", con el motivo, y el nivel de las reglas sigue visible.
  await expect(page.getByTestId('result-uncertain')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/no estoy segura/i);
  const unc = page.getByTestId('uncertainty');
  await expect(unc).toContainText('No estoy segura — consulte al personal de salud');
  await expect(unc).toContainText('No se confirmó si tiene signos de peligro.');
  await expect(unc).toContainText('“No sé”');
  await expect(page.getByText('Con los datos que hay, las reglas dicen:')).toBeVisible();

  // Referencia: aunque las reglas digan "aquí", si no está segura muestra el centro de salud más cercano.
  const referral = page.getByTestId('referral');
  await expect(referral).toContainText('Centro de salud más cercano para consultar');
  await expect(referral).toContainText('en línea recta');

  // La promotora decide: no se guarda nada hasta que confirma o cambia el nivel.
  expect(await storedCases(page)).toHaveLength(0);
  const decision = page.getByTestId('decision');
  await expect(decision).toContainText('Pahtli sugiere. Usted decide.');
  await decision.getByRole('button', { name: 'Cambiar nivel' }).click();
  await decision.getByRole('radio', { name: 'Centro hoy' }).click();
  await decision.getByRole('button', { name: 'Guardar con mi decisión' }).click();
  await expect(decision.getByRole('alert')).toHaveText('Elija un motivo.');
  expect(await storedCases(page)).toHaveLength(0);
  await decision.getByLabel('¿Por qué? (obligatorio)').selectOption('indicacion_personal');
  await decision.getByLabel('Nota (opcional, sin nombres del paciente)').fill('Rosa, casa junto a la iglesia');
  await decision.getByRole('button', { name: 'Guardar con mi decisión' }).click();
  await expect(decision.getByRole('button', { name: 'Caso guardado' })).toBeVisible();
  await expect(decision).toContainText('Su decisión');

  const saved = await storedCases(page);
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({
    uncertain: true,
    result: { level: 'aqui' },
    decision: { final_level: 'centro_hoy', overridden: true, reason: 'indicacion_personal', note: 'Rosa, casa junto a la iglesia' },
  });
  expect(saved[0].uncertainty_codes).toEqual(expect.arrayContaining(['answered_unknown', 'danger_signs_unchecked']));

  // Historial: nivel cambiado + etiqueta "No segura". Al enviar, la nota y el texto libre se quedan en el celular.
  await page.getByRole('button', { name: 'Nuevo paciente' }).click();
  await page.goto('/#/historial');
  await expect(page.getByText('⚪ No estoy segura', { exact: true })).toBeVisible();
  await expect(page.getByText('Nivel cambiado por la promotora', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Enviar ahora' }).click();
  await expect.poll(() => syncBodies.flatMap((b) => b.cases).length).toBe(1);
  const sent = syncBodies.flatMap((b) => b.cases)[0];
  expect(sent).toMatchObject({
    level: 'aqui',
    decision: { final_level: 'centro_hoy', overridden: true, reason: 'indicacion_personal' },
    uncertain: true,
  });
  expect(sent.uncertainty_reasons).toEqual(expect.arrayContaining(['answered_unknown', 'danger_signs_unchecked']));
  const wire = JSON.stringify(sent);
  expect(wire).not.toContain('Rosa');
  expect(wire).not.toContain('calentura');
  expect(wire).not.toContain('No sé');
  expect(sent.lat).toBe(Math.round((sent.lat as number) * 100) / 100);

  expect(errors).toEqual([]);
});
