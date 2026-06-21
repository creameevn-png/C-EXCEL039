'use client';

import { useState } from 'react';
import { FiTag, FiSearch, FiPrinter, FiArrowLeft, FiXCircle, FiPhone, FiMapPin } from 'react-icons/fi';

type Don = {
  maDH: string; maVD: string; maGD: string;
  tenKH: string; sdt: string; diaChi: string;
  tuyen: string; tongKg: number; tongM3: number;
  items: string[];
};

export default function InTemClient({ initialMa, initialDon }: { initialMa: string; initialDon: Don | null }) {
  const [ma, setMa] = useState(initialMa);
  const [don] = useState<Don | null>(initialDon);

  function printNow() { window.print(); }

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .tem-print { box-shadow: none !important; page-break-after: always; }
        }
      `}</style>
      <div className="no-print">
        <header className="topbar">
          <div className="tb-icon"><FiTag /></div>
          <div className="tb-title"><h1>In tem đơn hàng</h1><p>Dán lên kiện hàng</p></div>
          <div className="tb-right">
            <a href="/dashboard" className="btn btn-secondary btn-sm"><FiArrowLeft /> Về Dashboard</a>
          </div>
        </header>
        <div className="page">
          <div className="form-section">
            <div className="form-grid">
              <div className="form-field">
                <label className="required">Mã đơn</label>
                <input type="text" value={ma} onChange={(e) => setMa(e.target.value)} placeholder="DH-260529-001" />
              </div>
              <div className="form-field">
                <label>&nbsp;</label>
                <a href={ma ? `/in-tem?ma=${ma.trim().toUpperCase()}` : '#'} className="btn btn-primary"><FiSearch /> Tải đơn</a>
              </div>
            </div>
          </div>

          {!don && initialMa && (
            <div className="form-section">
              <div className="empty-state"><FiXCircle /><p>Không tìm thấy đơn {initialMa}</p></div>
            </div>
          )}
        </div>
      </div>

      {don && (
        <div style={{ padding: 20, background: '#F1F5F9' }}>
          <div className="no-print" style={{ textAlign: 'center', marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={printNow}><FiPrinter /> In tem ngay</button>
          </div>
          <div className="tem-print" style={{
            background: 'white', maxWidth: 400, margin: '0 auto',
            padding: 16, borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            fontFamily: 'monospace', fontSize: 13
          }}>
            <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: 8, marginBottom: 8 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>QUẢN LÝ SHIP TRUNG VIỆT</div>
              <div style={{ fontSize: 11 }}>SHIP TQ → VN</div>
            </div>

            <div style={{ fontSize: 22, fontWeight: 800, textAlign: 'center', margin: '10px 0', padding: '8px 0', background: '#000', color: 'white' }}>
              {don.maDH}
            </div>

            <div style={{ marginBottom: 6 }}><b>Mã VĐ:</b> {don.maVD || '—'}</div>
            <div style={{ marginBottom: 6 }}><b>Mã GD:</b> {don.maGD || '—'}</div>

            <div style={{ borderTop: '1px dashed #000', paddingTop: 8, marginTop: 8 }}>
              <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700 }}>KHÁCH HÀNG</div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>{don.tenKH}</div>
              {don.sdt && <div className="icon-inline"><FiPhone /> {don.sdt}</div>}
              {don.diaChi && <div className="icon-inline"><FiMapPin /> {don.diaChi}</div>}
            </div>

            <div style={{ borderTop: '1px dashed #000', paddingTop: 8, marginTop: 8 }}>
              <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700 }}>TUYẾN: {don.tuyen === 'HCM' ? 'HCM' : 'HÀ NỘI'}</div>
              <div>KG: <b>{don.tongKg.toFixed(2)}</b> | M³: <b>{don.tongM3.toFixed(4)}</b></div>
            </div>

            {don.items.length > 0 && (
              <div style={{ borderTop: '1px dashed #000', paddingTop: 8, marginTop: 8 }}>
                <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700 }}>NỘI DUNG ({don.items.length} SP)</div>
                <ol style={{ paddingLeft: 18, fontSize: 11 }}>
                  {don.items.slice(0, 6).map((it, i) => <li key={i}>{it}</li>)}
                  {don.items.length > 6 && <li>… và {don.items.length - 6} SP khác</li>}
                </ol>
              </div>
            )}

            <div style={{ textAlign: 'center', borderTop: '2px solid #000', paddingTop: 8, marginTop: 8, fontSize: 10, color: '#475569' }}>
              In ngày: {new Date().toLocaleString('vi-VN')}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
