'use client';

import { useState } from 'react';
import { FiTag, FiSearch, FiPrinter, FiArrowLeft, FiXCircle, FiPhone, FiMapPin } from 'react-icons/fi';

type Don = {
  maDH: string; maVD: string; maGD: string;
  tenKH: string; sdt: string; diaChi: string;
  tuyen: string; tongKg: number; tongM3: number;
  items: string[];
};

type Bao = {
  maBao: string; line: string; trangThai: string;
  tongKg: number; tongM3: number; soKien: number;
  orders: string[];
};

// Bảng mẫu vạch Code128 (theo chuẩn), chỉ số 0..106; phần tử cuối là mã Stop.
const C128 = ["212222","222122","222221","121223","121322","131222","122213","122312","132212","221213","221312","231212","112232","122132","122231","113222","123122","123221","223211","221132","221231","213212","223112","312131","311222","321122","321221","312212","322112","322211","212123","212321","232121","111323","131123","131321","112313","132113","132311","211313","231113","231311","112133","112331","132131","113123","113321","133121","313121","211331","231131","213113","213311","213131","311123","311321","331121","312113","312311","332111","314111","221411","431111","111224","111422","121124","121421","141122","141221","112214","112412","122114","122411","142112","142211","241211","221114","413111","241112","134111","111242","121142","121241","114212","124112","124211","411212","421112","421211","212141","214121","412121","111143","111341","131141","114113","114311","411113","411311","113141","114131","311141","411131","211412","211214","211232","2331112"];

// Sinh mã vạch Code128 (bộ B) — máy quét đọc được, không cần thư viện ngoài hay Internet.
function code128B(text: string): { bars: { x: number; w: number }[]; width: number } {
  const s = (text || '').replace(/[^\x20-\x7E]/g, ''); // chỉ nhận ký tự in được ASCII 32..126
  const codes: number[] = [104]; // Start B
  let sum = 104;
  for (let i = 0; i < s.length; i++) {
    const v = s.charCodeAt(i) - 32;
    codes.push(v);
    sum += v * (i + 1);
  }
  codes.push(sum % 103); // ký tự kiểm tra
  codes.push(106); // Stop
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  for (const c of codes) {
    const pat = C128[c];
    for (let i = 0; i < pat.length; i++) {
      const w = parseInt(pat[i], 10);
      if (i % 2 === 0) bars.push({ x, w }); // vị trí chẵn = vạch đen
      x += w;
    }
  }
  return { bars, width: x };
}

function Barcode({ value, height = 44 }: { value: string; height?: number }) {
  const { bars, width } = code128B(value);
  if (!value || width === 0) return null;
  const mod = 2;      // độ rộng 1 module (px cơ sở)
  const quiet = 10;   // vùng trắng 2 bên
  const totalW = (width + quiet * 2) * mod;
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${totalW} ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <rect x={0} y={0} width={totalW} height={height} fill="#fff" />
      {bars.map((b, i) => (
        <rect key={i} x={(b.x + quiet) * mod} y={0} width={b.w * mod} height={height} fill="#000" />
      ))}
    </svg>
  );
}

export default function InTemClient({ initialMa, initialBaoMa, initialDon, initialBao, anKH }: { initialMa: string; initialBaoMa?: string; initialDon: Don | null; initialBao?: Bao | null; anKH?: boolean }) {
  const [ma, setMa] = useState(initialMa);
  const [maBao, setMaBao] = useState(initialBaoMa || '');
  const [don] = useState<Don | null>(initialDon);
  const [bao] = useState<Bao | null>(initialBao || null);

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
              <div className="form-field">
                <label>Mã bao tổng</label>
                <input type="text" value={maBao} onChange={(e) => setMaBao(e.target.value)} placeholder="BAO0001" />
              </div>
              <div className="form-field">
                <label>&nbsp;</label>
                <a href={maBao ? `/in-tem?bao=${maBao.trim().toUpperCase()}` : '#'} className="btn btn-primary"><FiSearch /> Tải bao</a>
              </div>
            </div>
          </div>

          {!don && initialMa && (
            <div className="form-section">
              <div className="empty-state"><FiXCircle /><p>Không tìm thấy đơn {initialMa}</p></div>
            </div>
          )}

          {!bao && initialBaoMa && (
            <div className="form-section">
              <div className="empty-state"><FiXCircle /><p>Không tìm thấy bao tổng {initialBaoMa}</p></div>
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

            <div style={{ fontSize: 22, fontWeight: 800, textAlign: 'center', margin: '10px 0 4px', padding: '8px 0', background: '#000', color: 'white' }}>
              {don.maDH}
            </div>
            <div style={{ margin: '0 0 8px' }}>
              <Barcode value={don.maDH} height={38} />
            </div>

            <div style={{ marginBottom: 6 }}><b>Mã VĐ:</b> {don.maVD || '—'}</div>
            {don.maVD && (
              <div style={{ margin: '4px 0 8px' }}>
                <Barcode value={don.maVD} />
                <div style={{ textAlign: 'center', fontSize: 10, letterSpacing: 1 }}>{don.maVD}</div>
              </div>
            )}
            <div style={{ marginBottom: 6 }}><b>Mã GD:</b> {don.maGD || '—'}</div>

            {!anKH && (
              <div style={{ borderTop: '1px dashed #000', paddingTop: 8, marginTop: 8 }}>
                <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700 }}>KHÁCH HÀNG</div>
                <div style={{ fontWeight: 800, fontSize: 15 }}>{don.tenKH}</div>
                {don.sdt && <div className="icon-inline"><FiPhone /> {don.sdt}</div>}
                {don.diaChi && <div className="icon-inline"><FiMapPin /> {don.diaChi}</div>}
              </div>
            )}

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

      {bao && (
        <div style={{ padding: 20, background: '#F1F5F9' }}>
          <div className="no-print" style={{ textAlign: 'center', marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={printNow}><FiPrinter /> In tem bao ngay</button>
          </div>
          <div className="tem-print" style={{
            background: 'white', maxWidth: 400, margin: '0 auto',
            padding: 16, borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            fontFamily: 'monospace', fontSize: 13
          }}>
            <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: 8, marginBottom: 8 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>QUẢN LÝ SHIP TRUNG VIỆT</div>
              <div style={{ fontSize: 11 }}>BAO TỔNG · SHIP TQ → VN</div>
            </div>

            <div style={{ fontSize: 24, fontWeight: 800, textAlign: 'center', margin: '10px 0 4px', padding: '8px 0', background: '#000', color: 'white' }}>
              {bao.maBao}
            </div>
            <div style={{ margin: '0 0 8px' }}>
              <Barcode value={bao.maBao} />
              <div style={{ textAlign: 'center', fontSize: 10, letterSpacing: 1 }}>{bao.maBao}</div>
            </div>

            <div style={{ borderTop: '1px dashed #000', paddingTop: 8, marginTop: 8 }}>
              <div>LINE: <b>{bao.line}</b></div>
              <div>SỐ ĐƠN: <b>{bao.orders.length}</b> | SỐ KIỆN: <b>{bao.soKien}</b></div>
              <div>KG: <b>{bao.tongKg.toFixed(2)}</b> | M³: <b>{bao.tongM3.toFixed(4)}</b></div>
            </div>

            {bao.orders.length > 0 && (
              <div style={{ borderTop: '1px dashed #000', paddingTop: 8, marginTop: 8 }}>
                <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700 }}>ĐƠN TRONG BAO ({bao.orders.length})</div>
                <ol style={{ paddingLeft: 18, fontSize: 11 }}>
                  {bao.orders.slice(0, 12).map((o, i) => <li key={i}>{o}</li>)}
                  {bao.orders.length > 12 && <li>… và {bao.orders.length - 12} đơn khác</li>}
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
