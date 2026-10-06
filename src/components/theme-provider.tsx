'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from './ui';

type Appearance = { mode: 'light' | 'dark'; tint: boolean };
const defaults: Appearance = { mode: 'dark', tint: true };
const ThemeContext = createContext({ ...defaults, ready: false, update: (_patch: Partial<Appearance>) => {} });
export const useTheme = () => useContext(ThemeContext);
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearance] = useState(defaults);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const mode = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
    setAppearance({ mode, tint: document.documentElement.dataset.starTint !== 'off' });
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', mode === 'light' ? '#F4F1E9' : '#121A25');
    setReady(true);
  }, []);
  function update(patch: Partial<Appearance>) {
    const next = { ...appearance, ...patch };
    setAppearance(next);
    document.documentElement.dataset.theme = next.mode;
    document.documentElement.dataset.starTint = next.tint ? 'on' : 'off';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next.mode === 'light' ? '#F4F1E9' : '#121A25');
    try { localStorage.setItem('workspace-appearance-v1', JSON.stringify(next)); } catch { /* Appearance still works when storage is unavailable. */ }
  }
  return <ThemeContext.Provider value={{ ...appearance, ready, update }}>{children}</ThemeContext.Provider>;
}
export function ThemeToggle() {
  const { mode, ready, update } = useTheme();
  return <Button variant="ghost" className="icon-button theme-toggle" disabled={!ready} aria-label={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`} title={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`} onClick={() => update({ mode: mode === 'dark' ? 'light' : 'dark' })}>{mode === 'dark' ? <Sun size={20} aria-hidden="true"/> : <Moon size={20} aria-hidden="true"/>}</Button>;
}
export function AppearanceSettings() {
  const { mode, tint, ready, update } = useTheme();
  return <fieldset className="appearance-settings" disabled={!ready}><legend>Appearance</legend><div role="group" aria-label="Colour mode"><Button aria-pressed={mode === 'light'} onClick={() => update({mode:'light'})}>Light</Button><Button aria-pressed={mode === 'dark'} onClick={() => update({mode:'dark'})}>Dark</Button></div><label><input type="checkbox" checked={tint} onChange={event => update({tint:event.target.checked})}/>Tint the sidebar and header with my star</label><p>Saved on this browser. Star colours currently follow your star preview, not task progress.</p></fieldset>;
}
