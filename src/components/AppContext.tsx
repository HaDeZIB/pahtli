import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { CaseDecision, DeviceTier, ExtractionResult, Findings, Lang, TriageResult } from '../types';
import { detectTier } from '../ai/capability';
import { loadSTT, sttReady } from '../ai/stt';
import { loadLLM, llmReady } from '../ai/llm';
import { triage } from '../triage/engine';
import type { AnsweredQuestion } from '../triage/uncertainty';
import { lsGet, lsSet } from './storage';

export type ModelState = 'idle' | 'loading' | 'ready' | 'error' | 'unavailable';
export interface ModelStatus { state: ModelState; progress: number; msg: string }

export interface Session {
  transcript: string;
  findings: Findings | null;
  extraction: ExtractionResult | null;
  result: TriageResult | null;
  asked: string[];
  /** Respuestas a las preguntas de seguimiento (known=false = "No sé"). Alimenta el fail-safe de incertidumbre. */
  answers?: AnsweredQuestion[];
  savedId?: string;
  /** Decisión de la promotora (se fija al guardar). */
  decision?: CaseDecision;
  triageMs?: number;
}

const emptySession: Session = { transcript: '', findings: null, extraction: null, result: null, asked: [], answers: [] };

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  tier: DeviceTier | null;
  session: Session;
  setSession: (s: Session | ((prev: Session) => Session)) => void;
  resetSession: () => void;
  /** Recalcula el triaje con los hallazgos dados, respetando el nivel sugerido por el modelo. */
  retriage: (f: Findings) => TriageResult;
  stt: ModelStatus;
  llm: ModelStatus;
  ensureSTT: () => Promise<boolean>;
  ensureLLM: () => Promise<boolean>;
}

const AppCtx = createContext<Ctx | null>(null);

const STT_FLAG = 'pahtli:stt-downloaded';
const LLM_FLAG = 'pahtli:llm-downloaded';

export function AppProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => (lsGet('pahtli:lang') === 'nah' ? 'nah' : 'es'));
  const [tier, setTier] = useState<DeviceTier | null>(null);
  const [session, setSession] = useState<Session>(emptySession);
  const [stt, setStt] = useState<ModelStatus>({ state: 'idle', progress: 0, msg: '' });
  const [llm, setLlm] = useState<ModelStatus>({ state: 'idle', progress: 0, msg: '' });
  const sttPromise = useRef<Promise<boolean> | null>(null);
  const llmPromise = useRef<Promise<boolean> | null>(null);
  const tierRef = useRef<DeviceTier | null>(null);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    lsSet('pahtli:lang', l);
    document.documentElement.lang = l === 'nah' ? 'nah' : 'es-MX';
  }, []);

  const getTier = useCallback(async (): Promise<DeviceTier> => {
    if (tierRef.current) return tierRef.current;
    let t: DeviceTier = 'C';
    try { t = await detectTier(); } catch { t = 'C'; }
    tierRef.current = t;
    setTier(t);
    return t;
  }, []);

  const ensureSTT = useCallback(async () => {
    if (sttReady()) { setStt({ state: 'ready', progress: 1, msg: '' }); return true; }
    if (sttPromise.current) return sttPromise.current;
    const p = (async () => {
      const t = await getTier();
      if (t === 'C') { setStt({ state: 'unavailable', progress: 0, msg: '' }); return false; }
      setStt({ state: 'loading', progress: 0, msg: '' });
      try {
        await loadSTT(t, (progress: number, msg: string) => setStt({ state: 'loading', progress, msg }));
        setStt({ state: 'ready', progress: 1, msg: '' });
        lsSet(STT_FLAG, '1');
        return true;
      } catch (e) {
        console.error('[stt]', e);
        setStt({ state: 'error', progress: 0, msg: e instanceof Error ? e.message : String(e) });
        sttPromise.current = null;
        return false;
      }
    })();
    sttPromise.current = p;
    return p;
  }, [getTier]);

  const ensureLLM = useCallback(async () => {
    if (llmReady()) { setLlm({ state: 'ready', progress: 1, msg: '' }); return true; }
    if (llmPromise.current) return llmPromise.current;
    const p = (async () => {
      const t = await getTier();
      if (t === 'C') { setLlm({ state: 'unavailable', progress: 0, msg: '' }); return false; }
      setLlm({ state: 'loading', progress: 0, msg: '' });
      try {
        const ok = await loadLLM(t, (progress: number, msg: string) => setLlm({ state: 'loading', progress, msg }));
        if (!ok) { setLlm({ state: 'unavailable', progress: 0, msg: '' }); llmPromise.current = null; return false; }
        setLlm({ state: 'ready', progress: 1, msg: '' });
        lsSet(LLM_FLAG, '1');
        return true;
      } catch (e) {
        console.error('[llm]', e);
        setLlm({ state: 'error', progress: 0, msg: e instanceof Error ? e.message : String(e) });
        llmPromise.current = null;
        return false;
      }
    })();
    llmPromise.current = p;
    return p;
  }, [getTier]);

  // Al abrir: detectar nivel y, si los modelos ya se descargaron antes, cargarlos desde caché (funciona offline).
  useEffect(() => {
    document.documentElement.lang = lang === 'nah' ? 'nah' : 'es-MX';
    try {
      if (sttReady()) setStt({ state: 'ready', progress: 1, msg: '' });
      if (llmReady()) setLlm({ state: 'ready', progress: 1, msg: '' });
    } catch { /* módulos aún no listos */ }
    getTier().then((t) => {
      if (t === 'C') {
        setStt({ state: 'unavailable', progress: 0, msg: '' });
        setLlm({ state: 'unavailable', progress: 0, msg: '' });
        return;
      }
      // Solo la voz se recarga sola. El LLM (experimental, ~0.9 GB de GPU) se activa a mano en Ajustes:
      // en iPhone, Safari puede cerrar la pestaña si Whisper y el LLM están en memoria a la vez.
      if (lsGet(STT_FLAG)) void ensureSTT();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const retriage = useCallback((f: Findings) => {
    return triage(f, session.extraction?.model_level_hint);
  }, [session.extraction]);

  const resetSession = useCallback(() => setSession(emptySession), []);

  const value = useMemo<Ctx>(() => ({
    lang, setLang, tier, session, setSession, resetSession, retriage, stt, llm, ensureSTT, ensureLLM,
  }), [lang, setLang, tier, session, resetSession, retriage, stt, llm, ensureSTT, ensureLLM]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error('useApp outside AppProvider');
  return c;
}
