import { useAppStore } from './store';
import { IntakeScreen } from './components/IntakeScreen';
import { PreviewEditor } from './components/PreviewEditor';
import { Teleprompter } from './components/Teleprompter';

export default function App() {
  const screen = useAppStore((s) => s.screen);
  return (
    <div className="app">
      {screen === 'intake' && <IntakeScreen />}
      {screen === 'preview' && <PreviewEditor />}
      {screen === 'prompter' && <Teleprompter />}
    </div>
  );
}