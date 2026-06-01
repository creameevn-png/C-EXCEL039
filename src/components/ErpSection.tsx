'use client';

import { useState, type ReactNode } from 'react';
import { FiPlus, FiMinus } from 'react-icons/fi';

/** Section card gập được theo phong cách document ERPAG. */
export default function ErpSection({ icon, title, right, defaultOpen = true, children }: {
  icon: ReactNode; title: string; right?: ReactNode; defaultOpen?: boolean; children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="erp-sec">
      <div className="erp-sec-head" onClick={() => setOpen((o) => !o)}>
        <span className="erp-sec-toggle">{open ? <FiMinus /> : <FiPlus />}</span>
        <span className="erp-sec-ic">{icon}</span>
        <span className="erp-sec-title">{title}</span>
        {right && <div className="erp-sec-right" onClick={(e) => e.stopPropagation()}>{right}</div>}
      </div>
      {open && <div className="erp-sec-body">{children}</div>}
    </div>
  );
}
