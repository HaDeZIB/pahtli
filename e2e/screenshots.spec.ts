import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/**
 * Capturas reproducibles para docs/screenshots/ (390×844, iPhone 12–15 en vertical).
 *   npm run screenshots
 * Se salta en `npm run e2e` normal para no reescribir las imágenes en cada corrida.
 * SHOTS_FULL_DIR=<carpeta> guarda además la página completa (para revisar el diseño).
 */
const enabled = process.env.SCREENSHOTS === '1';
test.skip(!enabled, 'Activar con SCREENSHOTS=1 (npm run screenshots)');

const OUT = join(process.cwd(), 'docs', 'screenshots');
const FULL = process.env.SHOTS_FULL_DIR;

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

async function shot(page: Page, name: string) {
  await page.waitForTimeout(450); // animación de entrada (animate-rise)
  // Sin scroll horizontal de la página a 390 px (las tablas anchas deben desplazarse dentro de su contenedor).
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${name}: scroll horizontal`).toBeLessThanOrEqual(0);
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  if (FULL) await page.screenshot({ path: join(FULL, `${name}.png`), fullPage: true });
}

async function evaluate(page: Page, text: string, answers: ('No sé' | 'No' | 'Sí')[] = [], onQuestion?: () => Promise<void>) {
  await page.goto('/#/');
  await page.getByRole('tab', { name: 'Escribir' }).click();
  await page.locator('#transcript').fill(text);
  await page.getByRole('main').getByRole('button', { name: 'Evaluar', exact: true }).click();
  await page.waitForURL(/#\/(resultado|preguntas)/);
  for (let i = 0; i < 4 && page.url().includes('#/preguntas'); i++) {
    if (i === 0 && onQuestion) await onQuestion();
    await page.getByRole('button', { name: answers[i] ?? 'No', exact: true }).click();
    await page.waitForTimeout(150);
  }
  await page.waitForURL(/#\/resultado/);
}

async function agree(page: Page) {
  await page.getByRole('button', { name: 'Estoy de acuerdo · Guardar caso' }).click();
  await expect(page.getByRole('button', { name: 'Caso guardado' })).toBeVisible();
}

test('capturas de pantalla (390×844)', async ({ page, context }) => {
  test.setTimeout(180_000);
  mkdirSync(OUT, { recursive: true });
  if (FULL) mkdirSync(FULL, { recursive: true });
  // Sin servidor real: /api/* responde como despliegue de demostración. Teselas del mapa sí cargan si hay red.
  await context.route('**/api/sync', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ demo: true, accepted: [] }) }));
  await context.route('**/api/cases**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ mode: 'aggregate', buckets: [], source: 'demo' }) }));

  await page.goto('/#/config');
  // Esperar al aviso "ya funciona sin internet" (service worker) y a que desaparezca, para capturas limpias.
  await page.getByText('Pahtli ya funciona sin internet').waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {});
  await page.getByText('Pahtli ya funciona sin internet').waitFor({ state: 'detached', timeout: 10_000 }).catch(() => {});
  await page.getByLabel('Comunidad').fill('San Miguel Tzinacapan');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Guardado' })).toBeVisible();

  await page.goto('/#/');
  await expect(page.getByRole('heading', { name: 'Nuevo paciente' })).toBeVisible();
  await shot(page, '01-captura');

  // Urgencia: niña con respiración rápida y tiraje.
  await evaluate(page, 'Niña de 1 año, tiene calentura desde ayer, respira muy rápido y se le hunde el pecho.');
  await expect(page.getByTestId('result-urgencia')).toBeVisible();
  await shot(page, '03-resultado-urgencia');
  await agree(page);

  // Centro de salud hoy: diarrea de 15 días, sin signos de peligro.
  await evaluate(page, 'Niño de 3 años con diarrea desde hace 15 días.');
  await expect(page.getByTestId('result-centro_hoy')).toBeVisible();
  await shot(page, '04-resultado-centro-hoy');
  await agree(page);

  // Atender aquí.
  await evaluate(page, 'Señora de 35 años con gripa y dolor de garganta desde ayer, sin calentura.');
  await expect(page.getByTestId('result-aqui')).toBeVisible();
  await shot(page, '05-resultado-aqui');
  await agree(page);

  // No estoy segura: "No sé" en la primera pregunta (se captura la pregunta antes de responder).
  await evaluate(page, 'Niña de 5 años con calentura desde ayer, dice su mamá que comió poquito.', ['No sé', 'No'], () => shot(page, '02-pregunta'));
  await expect(page.getByTestId('result-uncertain')).toBeVisible();
  await shot(page, '06-resultado-no-segura');
  // La promotora cambia el nivel (motivo obligatorio).
  await page.getByRole('button', { name: 'Cambiar nivel' }).click();
  await page.getByRole('radio', { name: 'Centro hoy' }).click();
  await page.getByLabel('¿Por qué? (obligatorio)').selectOption('indicacion_personal');
  await page.getByTestId('decision').scrollIntoViewIfNeeded();
  await shot(page, '07-decision-promotora');
  await page.getByRole('button', { name: 'Guardar con mi decisión' }).click();
  await expect(page.getByRole('button', { name: 'Caso guardado' })).toBeVisible();

  await page.goto('/#/historial');
  await expect(page.getByText('⚪ No estoy segura', { exact: true })).toBeVisible();
  await shot(page, '08-historial');

  await page.goto('/#/config');
  await expect(page.getByRole('heading', { name: 'Ajustes' })).toBeVisible();
  await shot(page, '09-ajustes');

  await page.goto('/#/acerca');
  await expect(page.getByRole('heading', { name: 'Acerca de la IA' })).toBeVisible();
  await shot(page, '10-acerca-ia');

  await page.goto('/#/tablero');
  await expect(page.getByRole('heading', { name: 'Tablero del Centro de Salud' })).toBeVisible();
  await page.waitForTimeout(1500); // teselas
  await shot(page, '11-tablero');
});
