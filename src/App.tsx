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

    case 'login':
      return (
        <LoginScreen
          onLoginSuccess={() => setPhase('welcome')}
          onPowerOff={() => setPhase('powered_off')}
        />
      );

    case 'welcome':
      return (
        <WelcomeScreen
          onComplete={() => setPhase('desktop')}
        />
      );

    case 'error':
      return (
        <BootError
          message={errorMessage}
          onRetry={() => setPhase('mcorp_splash')}
          onBypass={() => setPhase('desktop')}
        />
      );

    case 'desktop':
    default:
      return <Desktop />;
  }
}

export default App;