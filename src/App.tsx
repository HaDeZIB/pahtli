import { lazy, Suspense, type ComponentType } from 'react';
import { AppProvider } from './components/AppContext';
import { StatusBar } from './components/StatusBar';
import { BottomNav, ErrorBoundary } from './components/ui';
import { useRoute } from './components/router';
import Capture from './screens/Capture';
import FollowUp from './screens/FollowUp';
import Result from './screens/Result';
import History from './screens/History';
import Config from './screens/Config';

// El tablero (mapa + Leaflet) se carga aparte para no pesar en la captura.
const Dashboard = lazy(() =>
  import('./screens/Dashboard').then((m) => {
    const mod = m as unknown as { default?: ComponentType; Dashboard?: ComponentType };
    return { default: (mod.default ?? mod.Dashboard) as ComponentType };
  }),
);

function Shell() {
  const route = useRoute();
  const fullScreen = route === 'resultado' || route === 'preguntas';

  let screen;
  switch (route) {
    case 'preguntas': screen = <FollowUp />; break;
    case 'resultado': screen = <Result />; break;
    case 'historial': screen = <History />; break;
    case 'config': screen = <Config />; break;
    case 'tablero':
      screen = (
        <Suspense fallback={<div className="p-8 text-center text-muted">Cargando tablero…</div>}>
          <div className="pb-24"><Dashboard /></div>
        </Suspense>
      );
      break;
    default: screen = <Capture />;
  }

  return (
    <div className="min-h-dvh">
      <div className="safe-top sticky top-0 z-40 bg-cream">
        <StatusBar />
      </div>
      <main>
        <ErrorBoundary key={route}>{screen}</ErrorBoundary>
      </main>
      {!fullScreen && <BottomNav current={route} />}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
