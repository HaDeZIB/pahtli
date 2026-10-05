import { useEffect, useState, type ReactNode } from 'react';
import { useApp, type ModelStatus } from '../components/AppContext';
import { t } from '../i18n/strings';
import { Card, TopBar } from '../components/ui';
import { Check, Info, Lock, Shield } from '../components/Icons';
import { go } from '../components/router';
import { STT_MODELS, LLM_MODELS, LLM_DEFAULT } from '../ai/models';
import { ALL_RULES } from '../triage/rules';
import { SRC } from '../triage/rules/sources';
import { DEFAULT_RETENTION_DAYS, getRetentionDays } from '../privacy/retention';
import { LOCK_AFTER_MS } from '../privacy/pin';

const GITHUB = 'https://github.com/HaDeZIB/pahtli';

// Métricas de eval/results.json si existe al compilar (solo la clave `metrics`, sin los textos de los casos).
type Rate = { count?: number; hits?: number; of?: number; rate?: number };
interface SplitMetrics { n?: number; accuracy?: number; correct?: number; urgencia_under_triage?: Rate; referral_sensitivity?: Rate; over_triage?: Rate }
const evalMetrics = Object.values(import.meta.glob('/eval/results.json', { eager: true, import: 'metrics' }))[0] as
  | { dev?: SplitMetrics; test_v1?: SplitMetrics; test_v2?: SplitMetrics } | undefined;
const evalDate = Object.values(import.meta.glob('/eval/results.json', { eager: true, import: 'generated_at' }))[0] as string | undefined;

/** Respaldo: números de docs/eval.md (split test_v2, separado, 3-oct-2026). */
const FALLBACK_TEST: SplitMetrics = {
  n: 40, accuracy: 0.925, correct: 37,
  urgencia_under_triage: { count: 3, of: 16, rate: 0.1875 },
  referral_sensitivity: { hits: 29, of: 30, rate: 0.967 },
  over_triage: { count: 0, rate: 0 },
};

const pct = (r?: number) => (typeof r === 'number' ? `${(r * 100).toFixed(1).replace('.0', '')}%` : '—');

function fmtBytes(b?: number): string {
  if (!b) return '0 MB';
  if (b > 1e9) return `${(b / 1e9).toFixed(2)} GB`;
  return `${Math.round(b / 1e6)} MB`;
}

function Section({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <Card>
      <h2 className="flex items-center gap-2 text-[18px] font-extrabold">{icon}{title}</h2>
      <div className="mt-2 text-[15px] leading-relaxed">{children}</div>
    </Card>
  );
}

function StatusTag({ s }: { s: ModelStatus }) {
  const label = s.state === 'ready' ? 'Descargado' : s.state === 'loading' ? `${Math.round(s.progress * 100)} %` : s.state === 'unavailable' ? 'No disponible aquí' : 'No descargado';
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-bold ${s.state === 'ready' ? 'bg-brand-soft text-brand-dark' : 'bg-sand text-muted'}`}>
      {s.state === 'ready' && <Check size={12} className="-mt-0.5 mr-0.5 inline" />}{label}
    </span>
  );
}

function Metric({ value, label, sub }: { value: string; label: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-sand p-3">
      <div className="whitespace-nowrap text-[22px] font-black tabular-nums leading-none">{value}</div>
      <div className="mt-1 text-[13px] font-bold leading-tight">{label}</div>
      {sub && <div className="mt-0.5 text-[12px] text-muted">{sub}</div>}
    </div>
  );
}

export default function About() {
  const { lang, tier, stt, llm } = useApp();
  const [usage, setUsage] = useState<{ usage?: number; quota?: number } | null>(null);

  useEffect(() => {
    (async () => {
      try { const e = await navigator.storage?.estimate?.(); setUsage(e ? { usage: e.usage, quota: e.quota } : null); } catch { setUsage(null); }
    })();
  }, [stt.state, llm.state]);

  const whisper = STT_MODELS['whisper-base'];
  const llama = LLM_MODELS[LLM_DEFAULT];
  const test = evalMetrics?.test_v2 ?? FALLBACK_TEST;
  const fromFile = !!evalMetrics?.test_v2;
  const nSources = Object.keys(SRC).length;
  const retention = getRetentionDays();

  return (
    <div className="pb-28">
      <TopBar title={t('about_title', lang)} onBack={() => (window.history.length > 1 ? window.history.back() : go('config'))} />
      <div className="mx-auto flex max-w-xl flex-col gap-4 px-4">
        <div className="rounded-3xl bg-ink p-5 text-white">
          <p className="text-[22px] font-black leading-tight">Pahtli sugiere. Usted decide.</p>
          <p className="mt-2 text-[15px] opacity-90">
            Pahtli ayuda a la promotora a ordenar lo que ve y a encontrar los signos de alarma de las guías oficiales.
            Todo corre en este celular, sin internet. La última palabra siempre es de una persona.
          </p>
        </div>

        <Card>
          <p className="text-[13px] font-bold uppercase tracking-wider text-muted">Aviso de actualización</p>
          <p className="mt-1 text-[15px] leading-relaxed">
            Esta versión se actualizó el 4 de octubre de 2026, <b>después de la entrega</b> al Hack-Nation 7th Global AI Hackathon.
            Corrige errores de seguridad clínica encontrados al seguir probando y agrega más molestias comunes.
            El código exacto que se entregó está en la etiqueta <b>v1.0-entrega</b> de GitHub.
          </p>
          <p className="mt-2 text-[15px] font-bold">
            <a className="text-brand-dark underline" href="https://github.com/HaDeZIB/pahtli/blob/main/CHANGELOG.md" target="_blank" rel="noopener">Ver qué cambió</a>
            {' · '}
            <a className="text-brand-dark underline" href="https://github.com/HaDeZIB/pahtli/tree/v1.0-entrega" target="_blank" rel="noopener">Versión entregada</a>
          </p>
        </Card>

        <Section title="Qué IA corre en este celular" icon={<Info size={20} />}>
          <ul className="flex flex-col divide-y divide-line">
            <li className="flex items-start gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="font-bold">Voz a texto: Whisper base (OpenAI, cuantizado q8)</p>
                <p className="text-[13px] text-muted">~{whisper.sizeMB} MB · corre en WebAssembly dentro del navegador · se descarga una vez con WiFi</p>
              </div>
              <StatusTag s={stt} />
            </li>
            <li className="flex items-start gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="font-bold">Lectura de síntomas por palabras clave</p>
                <p className="text-[13px] text-muted">0 MB · reglas de texto en español coloquial · funciona en todos los celulares</p>
              </div>
              <span className="shrink-0 rounded-full bg-brand-soft px-2.5 py-0.5 text-[12px] font-bold text-brand-dark">Siempre</span>
            </li>
            <li className="flex items-start gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="font-bold">Motor de reglas clínicas citadas</p>
                <p className="text-[13px] text-muted">{ALL_RULES.length} reglas · {nSources} fuentes citadas (OMS/AIEPI, NOM-007, NOM-031, OPS, IMSS, CDC, NICE) · cada resultado muestra su regla y su fuente</p>
              </div>
              <span className="shrink-0 rounded-full bg-brand-soft px-2.5 py-0.5 text-[12px] font-bold text-brand-dark">Siempre</span>
            </li>
            <li className="flex items-start gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="font-bold">Opcional, experimental: Llama 3.2 1B (Meta)</p>
                <p className="text-[13px] text-muted">~{llama?.sizeMB ?? 705} MB · solo celulares con WebGPU · apagado por defecto · solo puede SUBIR el nivel, nunca bajarlo</p>
              </div>
              <StatusTag s={llm} />
            </li>
          </ul>
          <p className="mt-2 rounded-xl bg-sand px-3 py-2 text-[14px]">
            <span className="font-bold">Espacio usado por Pahtli en este celular:</span>{' '}
            <span className="tabular-nums">{usage ? `${fmtBytes(usage.usage)}${usage.quota ? ` de ${fmtBytes(usage.quota)} disponibles` : ''}` : '—'}</span>
            {tier && <span className="text-muted"> · nivel de equipo {tier}</span>}
          </p>
        </Section>

        <Section title="Qué hace y qué NO hace">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="font-extrabold text-brand-dark">Sí hace</p>
              <ul className="mt-1 list-disc pl-5">
                <li>Pasa la voz a texto y encuentra edad, síntomas y signos.</li>
                <li>Aplica reglas de guías oficiales y dice cuál regla disparó y por qué.</li>
                <li>Hace hasta 4 preguntas cuando falta un dato que cambia el resultado.</li>
                <li>Antes de decir “Atender aquí”, pregunta por los signos de peligro según la edad.</li>
                <li>Avisa “No estoy segura” cuando los datos no alcanzan.</li>
                <li>Muestra el centro de salud u hospital más cercano (catálogo CLUES).</li>
              </ul>
            </div>
            <div>
              <p className="font-extrabold text-red-800">No hace</p>
              <ul className="mt-1 list-disc pl-5">
                <li>No diagnostica enfermedades.</li>
                <li>No receta medicamentos ni dosis.</li>
                <li>No decide por la promotora: ella confirma o cambia el nivel.</li>
                <li>No inventa: si no reconoce un síntoma, lo dice.</li>
                <li>No manda audio ni texto libre a ningún servidor.</li>
              </ul>
            </div>
          </div>
        </Section>

        <Section title="Cuándo dice “No estoy segura”">
          <ul className="list-disc pl-5">
            <li>No entendió ningún síntoma, o la descripción es muy corta o parece mal transcrita.</li>
            <li>Falta la edad y con alguna edad el nivel podría subir.</li>
            <li>Se respondió “No sé” o se saltaron preguntas que podían subir el nivel.</li>
            <li>Iba a decir “Atender aquí”, pero no se confirmó que no tenga signos de peligro.</li>
            <li>La IA de lenguaje y las palabras clave no coinciden en un signo de alarma.</li>
            <li>Bebé de menos de 2 meses o embarazo con pocos datos (si no es ya urgencia).</li>
          </ul>
          <p className="mt-2 text-muted">Nunca baja el nivel: si las reglas dicen urgencia, se ve la urgencia y además el aviso.</p>
        </Section>

        <Section title="Qué tan bien funciona (y qué no sabemos)">
          <div className="grid grid-cols-3 gap-2">
            <Metric value={pct(test.accuracy)} label="Nivel correcto" sub={`${test.correct ?? '—'}/${test.n ?? '—'} casos`} />
            <Metric value={pct(test.urgencia_under_triage?.rate)} label="Urgencias que salieron más leves" sub={`${test.urgencia_under_triage?.count ?? '—'}/${test.urgencia_under_triage?.of ?? '—'}`} />
            <Metric value={pct(test.referral_sensitivity?.rate)} label="Casos a referir que sí salieron" sub={`${test.referral_sensitivity?.hits ?? '—'}/${test.referral_sensitivity?.of ?? '—'}`} />
          </div>
          <p className="mt-3 text-[14px] text-muted">
            Conjunto de prueba (test_v2): {test.n ?? 40} viñetas en español coloquial escritas antes de ajustar el extractor, sin LLM ni voz
            {fromFile && evalDate ? ` · eval/results.json del ${evalDate.slice(0, 10)}` : ' · docs/eval.md'}.
            Son <span className="font-bold">viñetas sintéticas, no pacientes reales</span>, y falta la validación clínica.
            El mismo equipo escribió las viñetas y el vocabulario nuevo, así que la cifra es optimista: sin las frases que aparecen
            tal cual en la prueba, el nivel correcto baja a 85 %. Con tan pocos casos, el margen de error es amplio. El punto débil es el vocabulario:
            una frase que no reconoce puede bajar el nivel; por eso existe el aviso “No estoy segura”.
          </p>
        </Section>

        <Section title="Privacidad" icon={<Shield size={20} />}>
          <ul className="flex flex-col gap-2">
            <li><span className="font-bold">Dónde están los datos:</span> en este celular (IndexedDB del navegador). El audio no se guarda.</li>
            <li><span className="font-bold">Qué sale del celular:</span> al haber señal se envían edad (en años desde los 2 años), sexo, síntomas, nivel sugerido, su decisión (nivel y motivo de una lista), si Pahtli no estaba segura y las reglas. La transcripción, sus notas y su nombre nunca salen. La ubicación viaja redondeada a ~1 km. No se pide nombre del paciente.</li>
            <li><span className="font-bold">Quién lo lee:</span> el equipo del centro de salud en el tablero. Los casos uno por uno requieren la clave del tablero; sin clave solo se ven conteos por día y comunidad. (Pendiente para un despliegue real: cuentas por persona en vez de una clave compartida.)</li>
            <li><span className="font-bold">Si se pierde o se presta el celular:</span> PIN opcional al abrir y tras {Math.round(LOCK_AFTER_MS / 60000)} minutos fuera; los casos ya enviados se borran solos a los {retention} días (por defecto {DEFAULT_RETENTION_DAYS}); y un botón borra todo.</li>
          </ul>
          <p className="mt-2 flex items-start gap-2 rounded-xl bg-sand px-3 py-2 text-[13px]">
            <Lock size={16} className="mt-0.5 shrink-0" />
            El PIN protege del acceso casual. Los datos no están cifrados con el PIN: alguien con herramientas técnicas y el celular desbloqueado podría leerlos.
          </p>
        </Section>

        <Section title="Límites conocidos">
          <ul className="list-disc pl-5">
            <li>No sustituye la valoración médica. Las reglas esperan validación clínica.</li>
            <li>La voz se probó con pocas voces; no hay estudios de Whisper con acentos rurales o indígenas de México.</li>
            <li>No entiende voz en náhuatl. En la interfaz solo se usan palabras náhuatl verificadas.</li>
            <li>Las distancias son en línea recta, no por carretera, y el catálogo no dice si hay personal en ese momento.</li>
            <li>El catálogo de establecimientos cubre 4 estados por ahora.</li>
            <li>Las reglas cubren signos de peligro de niños (AIEPI), embarazo, puerperio y adultos. Molestias sin regla (muela, oído, piojos…) no tienen nivel propio: Pahtli avisa “No estoy segura”.</li>
            <li>El modelo de lenguaje opcional es experimental y puede cerrar la pestaña en algunos iPhone.</li>
          </ul>
        </Section>

        <a href={GITHUB} target="_blank" rel="noreferrer" className="flex min-h-14 items-center justify-center rounded-2xl border-2 border-line bg-white text-[16px] font-bold active:bg-sand">
          Código y documentación en GitHub
        </a>
        <p className="pb-4 text-center text-[13px] text-muted">Fuentes, evaluación y datos: docs/clinical-sources.md · docs/eval.md · docs/data.md</p>
      </div>
    </div>
  );
}
