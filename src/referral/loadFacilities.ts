/**
 * Loads the facility registry (CLUES subset) shipped with the PWA at /data/facilities.json.
 * The service worker precaches it, so this works offline after first install.
 * Result is memoized for the session; a failed load is not cached (so it can be retried).
 */
import type { Facility } from './nearest';

let cache: Promise<Facility[]> | null = null;

export function loadFacilities(url = `${import.meta.env?.BASE_URL ?? '/'}data/facilities.json`): Promise<Facility[]> {
  if (!cache) {
    cache = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`facilities.json HTTP ${r.status}`);
        return r.json() as Promise<Facility[]>;
      })
      .catch((err) => {
        cache = null;
        throw err;
      });
  }
  return cache;
}

/** Test helper / allow forcing a reload. */
export function resetFacilitiesCache(): void {
  cache = null;
}
