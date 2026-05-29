'use client';

import { useState, ReactNode } from 'react';

export type TabDef = { id: string; label: ReactNode; content: ReactNode };

export default function Tabs({ tabs, initial }: { tabs: TabDef[]; initial?: string }) {
  const [active, setActive] = useState(initial || tabs[0]?.id);
  return (
    <>
      <div className="tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`tab ${active === t.id ? 'active' : ''}`}
            onClick={() => setActive(t.id)}
            type="button"
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} className={`tab-content ${active === t.id ? 'active' : ''}`}>
          {t.content}
        </div>
      ))}
    </>
  );
}
