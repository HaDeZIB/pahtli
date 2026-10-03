import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

/**
 * Voz sin internet (opcional: descarga Whisper base ~79 MB de Hugging Face).
 *   E2E_VOICE=1 npm run e2e
 * Solo macOS: el audio se sintetiza con `say` (voz es_MX) y se inyecta como micrófono falso,
 * porque Chromium headless no entrega un getUserMedia real en macOS.
 */
const enabled = process.env.E2E_VOICE === '1' && process.platform === 'darwin';
test.skip(!enabled, 'Activar con E2E_VOICE=1 (macOS, descarga ~79 MB)');

const PHRASE = 'Niña de un año, tiene calentura desde ayer, respira muy rápido y se le hunde el pecho.';

test('Whisper se carga desde caché y transcribe en modo avión', async ({ page, context }) => {
  test.setTimeout(420_000);
  const dir = mkdtempSync(join(tmpdir(), 'pahtli-voice-'));
  const wav = join(dir, 'clip.wav');
  execFileSync('say', ['-v', 'Paulina', '-o', wav, '--data-format=LEI16@16000', PHRASE]);
  const b64 = readFileSync(wav).toString('base64');

  // Micrófono falso: reproduce el WAV hacia un MediaStream.
  await context.grantPermissions(['microphone']);
  await context.addInitScript((data: string) => {
    const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    navigator.mediaDevices.getUserMedia = async () => {
      const ac = new AudioContext();
      const buf = await ac.decodeAudioData(bytes.buffer.slice(0));
      const src = ac.createBufferSource();
      src.buffer = buf;
      const dest = ac.createMediaStreamDestination();
      src.connect(dest);
      src.start();
      return dest.stream;
    };
  }, b64);

  await page.goto('/#/config');
  await page.waitForFunction(async () => !!(await navigator.serviceWorker.ready).active && !!navigator.serviceWorker.controller);
  await page.getByRole('button', { name: 'Descargar' }).first().click();
  await expect(page.getByText('Listo').first()).toBeVisible({ timeout: 300_000 });

  await context.setOffline(true);
  await page.goto('/#/');
  await page.reload();
  await page.getByRole('button', { name: 'Toque para hablar' }).click();
  await page.waitForTimeout(7_500);
  await page.getByRole('button', { name: /Escuchando/ }).click();
  await expect(page.locator('#transcript')).toHaveValue(/hunde el pecho/i, { timeout: 120_000 });

  await page.getByRole('main').getByRole('button', { name: 'Evaluar', exact: true }).click();
  await page.waitForURL(/#\/resultado/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/urgencia/i);
});
