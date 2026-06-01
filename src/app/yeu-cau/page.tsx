'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  FiShoppingCart, FiCheckCircle, FiSend, FiClock, FiArrowLeft, FiAlertCircle, FiPlus, FiX, FiClipboard
} from 'react-icons/fi';
import { callServer } from '@/lib/client';
import { detectWeb } from '@/lib/source';

type Item = { tempId: number; link: string; ten: string; soLuong: number; ghiChu: string };
let SEQ = 1;
const mk = (link = ''): Item => ({ tempId: SEQ++, link, ten: '', soLuong: 1, ghiChu: '' });

export default function YeuCauMuaPage() {
  const [hoTen, setHoTen] = useState('');
  const [sdt, setSdt] = useState('');
  const [email, setEmail] = useState('');
  const [maKH, setMaKH] = useState('');
  const [tuyen, setTuyen] = useState<'HaNoi' | 'HCM'>('HaNoi');
  const [ghiChu, setGhiChu] = useState('');
  const [items, setItems] = useState<Item[]>([mk()]);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState('');

  // Dán nhiều link cùng lúc
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');

  useEffect(() => {
    const url = new URL(window.location.href);
    const m = url.searchParams.get('ma'); if (m) setMaKH(m);
  }, []);

  function patch(id: number, p: Partial<Item>) { setItems((prev) => prev.map((x) => x.tempId === id ? { ...x, ...p } : x)); }
  function add() { setItems((p) => [...p, mk()]); }
  function rm(id: number) { setItems((p) => p.length > 1 ? p.filter((x) => x.tempId !== id) : p); }

  // Enter ở dòng cuối => thêm dòng mới (và chặn submit nhầm)
  function onRowKey(idx: number) {
    return (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (idx === items.length - 1) add();
      }
    };
  }

  const bulkLinks = useMemo(
    () => bulkText.split('\n').map((s) => s.trim()).filter(Boolean),
    [bulkText]
  );
  function applyBulk() {
    if (!bulkLinks.length) { setBulkOpen(false); return; }
    setItems((prev) => {
      const base = (prev.length === 1 && !prev[0].link.trim() && !prev[0].ten.trim()) ? [] : prev;
      return [...base, ...bulkLinks.map((l) => mk(l))];
    });
    setBulkText(''); setBulkOpen(false);
  }

  const filledItems = items.filter((it) => it.link.trim() || it.ten.trim());
  const totalQty = filledItems.reduce((s, it) => s + (Number(it.soLuong) || 0), 0);

  const valid = useMemo(
    () => hoTen.trim() && sdt.trim() && filledItems.length > 0,
    [hoTen, sdt, filledItems.length]
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (!hoTen.trim()) return setErr('Vui lòng nhập họ tên');
    if (!sdt.trim()) return setErr('Vui lòng nhập số điện thoại');
    if (filledItems.length === 0) return setErr('Nhập ít nhất 1 sản phẩm (link hoặc tên)');
    setSending(true);
    const r = await callServer('createYeuCauMua', {
      hoTen, sdt, email, maKH, tuyen, ghiChu,
      sanPham: items.map((it) => ({ link: it.link, ten: it.ten, soLuong: it.soLuong, ghiChu: it.ghiChu }))
    });
    setSending(false);
    if (r?.success) setDone(r.maYC);
    else setErr(r?.message || 'Có lỗi xảy ra');
  }

  if (done) {
    return (
      <div className="auth-shell">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 52, color: 'var(--success)', display: 'flex', justifyContent: 'center' }}><FiCheckCircle /></div>
          <h2 style={{ color: 'var(--success-dark)', marginTop: 10 }}>Đã gửi yêu cầu mua hàng</h2>
          <p style={{ marginTop: 10, color: '#475569' }}>Mã yêu cầu: <b>{done}</b></p>
          <p style={{ marginTop: 6, fontSize: 13, color: 'var(--text-muted)' }}>Nhân viên CSKH sẽ liên hệ báo giá & xác nhận trong thời gian sớm nhất.</p>
          <a href="/tra-cuu" className="btn btn-primary" style={{ marginTop: 18 }}><FiArrowLeft /> Về trang tra cứu</a>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell" style={{ alignItems: 'flex-start', padding: '40px 20px' }}>
      <div style={{ maxWidth: 980, width: '100%', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', color: 'white', marginBottom: 22 }}>
          <div className="auth-logo"><FiShoppingCart /></div>
          <h1 style={{ fontSize: 26, marginBottom: 4, fontWeight: 800 }}>Yêu cầu mua hàng</h1>
          <p style={{ fontSize: 13, opacity: 0.85 }}>Gửi link/sản phẩm muốn order — CSKH sẽ báo giá & lên đơn giúp bạn</p>
        </div>

        <div style={{ background: 'white', borderRadius: 16, padding: 24, boxShadow: 'var(--shadow-lg)' }}>
          <form onSubmit={submit}>
            <div className="yc-contact">
              <div className="form-field"><label className="required">Họ tên</label>
                <input value={hoTen} onChange={(e) => setHoTen(e.target.value)} placeholder="VD: Nguyễn Văn A" autoFocus /></div>
              <div className="form-field"><label className="required">Số điện thoại</label>
                <input value={sdt} onChange={(e) => setSdt(e.target.value)} placeholder="0901234567" /></div>
              <div className="form-field"><label>Email (nếu có)</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@gmail.com" /></div>
              <div className="form-field"><label>Mã KH</label>
                <input value={maKH} onChange={(e) => setMaKH(e.target.value)} placeholder="KH001" style={{ textTransform: 'uppercase' }} /></div>
              <div className="form-field"><label>Tuyến</label>
                <select value={tuyen} onChange={(e) => setTuyen(e.target.value as any)}>
                  <option value="HaNoi">Hà Nội</option><option value="HCM">HCM</option>
                </select></div>
            </div>

            <div style={{ marginTop: 18 }}>
              <div className="flex-between" style={{ marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                <b className="icon-inline"><FiShoppingCart /> Sản phẩm muốn mua ({filledItems.length}{totalQty > 0 ? ` · ${totalQty} món` : ''})</b>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setBulkOpen((v) => !v)}><FiClipboard /> Dán nhiều link</button>
                  <button type="button" className="btn btn-success btn-sm" onClick={add}><FiPlus /> Thêm SP</button>
                </div>
              </div>

              {bulkOpen && (
                <div style={{ border: '1px dashed var(--border-strong)', borderRadius: 10, padding: 12, marginBottom: 10, background: 'var(--surface-2)' }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>Dán mỗi dòng 1 link — hệ thống tự tách thành từng sản phẩm</label>
                  <textarea
                    rows={4}
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    placeholder={'https://item.taobao.com/...\nhttps://detail.1688.com/...\nhttps://detail.tmall.com/...'}
                    style={{ marginTop: 6 }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setBulkText(''); setBulkOpen(false); }}>Đóng</button>
                    <button type="button" className="btn btn-primary btn-sm" disabled={!bulkLinks.length} onClick={applyBulk}><FiPlus /> Thêm {bulkLinks.length} dòng</button>
                  </div>
                </div>
              )}

              <div className="yc-rows">
                <div className="yc-row-head">
                  <div>#</div><div>Link sản phẩm</div><div>Tên / mô tả</div><div>SL</div><div>Ghi chú</div><div></div>
                </div>
                {items.map((it, idx) => {
                  const src = detectWeb(it.link);
                  return (
                    <div key={it.tempId} className="yc-row">
                      <div className="yc-cell-stt stt">{idx + 1}</div>
                      <div className="yc-cell-link">
                        <input value={it.link} onChange={(e) => patch(it.tempId, { link: e.target.value })} onKeyDown={onRowKey(idx)} placeholder="Link Taobao / 1688 / Tmall..." />
                        {src && <span className="yc-src">● {src}</span>}
                      </div>
                      <div className="yc-cell-ten">
                        <input value={it.ten} onChange={(e) => patch(it.tempId, { ten: e.target.value })} onKeyDown={onRowKey(idx)} placeholder="VD: Áo khoác nam, đen, size L" />
                      </div>
                      <div className="yc-cell-sl">
                        <input type="number" min={1} aria-label="Số lượng" title="Số lượng" value={it.soLuong} onChange={(e) => patch(it.tempId, { soLuong: parseInt(e.target.value) || 1 })} />
                      </div>
                      <div className="yc-cell-note">
                        <input value={it.ghiChu} onChange={(e) => patch(it.tempId, { ghiChu: e.target.value })} onKeyDown={onRowKey(idx)} placeholder="Màu/size/yêu cầu riêng" />
                      </div>
                      <div className="yc-cell-rm">
                        {items.length > 1 && <button type="button" className="btn btn-danger btn-sm" title="Xóa dòng" onClick={() => rm(it.tempId)}><FiX /></button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="form-field" style={{ marginTop: 14 }}>
              <label>Yêu cầu / ghi chú chung</label>
              <textarea rows={3} value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} placeholder="VD: Cần hàng trước Tết, ưu tiên line nhanh..." />
            </div>

            {err && <div className="login-error" style={{ marginTop: 12 }}><FiAlertCircle /> {err}</div>}

            <button type="submit" className="btn btn-primary" disabled={sending || !valid} style={{ width: '100%', marginTop: 16, padding: 12 }}>
              {sending ? <><FiClock /> Đang gửi...</> : <><FiSend /> Gửi yêu cầu mua hàng</>}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 16 }}>
          <a href="/tra-cuu" className="icon-inline" style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}><FiArrowLeft /> Quay lại tra cứu</a>
        </p>
      </div>
    </div>
  );
}
