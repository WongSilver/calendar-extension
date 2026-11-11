import { createRoot } from 'react-dom/client';
import { ChineseCalendar } from '@/components/ChineseCalendar';
import { ThemeProvider } from '@/components/theme-provider';
import '@/index.css';

function App() {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <main className="app-shell">
        <ChineseCalendar />
      </main>
    </ThemeProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <App />,
);
