'use client';

import { useEffect, useState } from 'react';

type Choice = 'auto' | 'light' | 'dark';
const storageKey = 'zaray-theme';

/** Explicit choice is persisted; auto follows the OS without duplicating app theme state. */
export default function ThemeSelector() {
  const [choice,setChoice] = useState<Choice>('auto');
  useEffect(() => {
    try {
      const stored=window.localStorage.getItem(storageKey);
      if(stored==='light'||stored==='dark'){document.documentElement.dataset.theme=stored;setChoice(stored);}
      else {delete document.documentElement.dataset.theme;setChoice('auto');}
    } catch { setChoice('auto'); }
  },[]);
  function select(value: string) {
    if(value!=='auto'&&value!=='light'&&value!=='dark')return;
    const next=value as Choice;
    setChoice(next);
    if(next==='auto')delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme=next;
    try {
      if(next==='auto')window.localStorage.removeItem(storageKey);
      else window.localStorage.setItem(storageKey,next);
    }catch { /* Private browsing: visual preference still applies this session. */ }
  }
  return <label className="theme-selector">
    <span>Thème</span>
    <select aria-label="Thème de ZARAY" value={choice} onChange={e=>select(e.target.value)}>
      <option value="auto">Auto</option>
      <option value="light">Clair</option>
      <option value="dark">Sombre</option>
    </select>
  </label>;
}
