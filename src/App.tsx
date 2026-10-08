import { useBootStore, type BootPhase } from './stores/useBootStore';
import {
  PowerOffScreen,
  McorpSplash,
  SystemBootSequence,
  MimiOSSplash,
  LoginScreen,
  WelcomeScreen,
  BootError,
} from './components/boot';
import { Desktop } from './components/desktop/Desktop';
import { Wallpaper } from './components/desktop/Wallpaper';
import './App.css';

export type AppPhase = BootPhase;

function App() {
  const { phase, errorMessage, setPhase, setError } = useBootStore();

  switch (phase) {
    case 'powered_off':
      return <PowerOffScreen onPowerOn={() => setPhase('mcorp_splash')} />;

    case 'mcorp_splash':
      return <McorpSplash onComplete={() => setPhase('system_boot')} />;

    case 'system_boot':
      return (
        <SystemBootSequence
          onComplete={() => setPhase('mimios_splash')}
          onError={(err) => setError(err)}
        />
      );

    case 'mimios_splash':
      return <MimiOSSplash onComplete={() => setPhase('login')} />;

    case 'error':
      return (
        <BootError
          message={errorMessage}
          onRetry={() => setPhase('mcorp_splash')}
          onBypass={() => setPhase('desktop')}
        />
      );

    case 'login':
    case 'welcome':
    case 'desktop':
    default:
      return (
        <div className="mimios-os-root">
          <Wallpaper />

          {(phase === 'welcome' || phase === 'desktop') && (
            <Desktop />
          )}

          {phase === 'welcome' && (
            <WelcomeScreen onComplete={() => setPhase('desktop')} />
          )}

          {phase === 'login' && (
            <LoginScreen
              onLoginSuccess={() => setPhase('welcome')}
              onPowerOff={() => setPhase('powered_off')}
            />
          )}
        </div>
      );
  }
}

export default App;