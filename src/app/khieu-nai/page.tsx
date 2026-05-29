'use client';

import { useEffect, useState } from 'react';
import { FiAlertTriangle, FiCheckCircle, FiSend, FiClock, FiArrowLeft, FiAlertCircle } from 'react-icons/fi';
import { callServer } from '@/lib/client';

export default function KhieuNaiPage() {
  const [maKH, setMaKH] = useState('');
  const [maDH, setMaDH] = useState('');
  const [nguoiTao, setNguoiTao] = useState('');
  const [loai, setLoai] = useState('HangLoi');
  const [moTa, setMoTa] = useState('');
  const [anh, setAnh] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    const url = new URL(window.location.href);
    const m = url.searchParams.get('ma'); if (m) setMaKH(m);
    const d = url.searchParams.get('don'); if (d) setMaDH(d);
  }, []);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => setAnh(r.result as string);
    r.readAsDataURL(f);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr('');
    if (!moTa.trim()) { setErr('Vui lòng mô tả'); return; }
    setSending(true);
    const r = await callServer('createKhieuNai', { maKH: maKH || null, maDH: maDH || null, nguoiTao, loai, moTa, anhBangChung: anh });
    setSending(false);
    if (r?.success) setDone(r.maKN);
    else setErr(r?.message || 'Có lỗi');
  }

  if (done) {
    return (
      <div className="auth-shell">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 52, color: 'var(--success)' }}><FiCheckCircle style={{ margin: '0 auto' }} /></div>
          <h2 style={{ color: 'var(--success-dark)', marginTop: 10 }}>Đã gửi khiếu nại</h2>
          <p style={{ marginTop: 10, color: '#475569' }}>Mã khiếu nại: <b>{done}</b></p>
          <p style={{ marginTop: 6, fontSize: 13, color: 'var(--text-muted)' }}>CSKH sẽ liên hệ bạn trong 24h.</p>
          <a href="/tra-cuu" className="btn btn-primary" style={{ marginTop: 18 }}><FiArrowLeft /> Về trang tra cứu</a>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell" style={{ alignItems: 'flex-start', padding: '40px 20px' }}>
      <div style={{ maxWidth: 540, width: '100%', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', color: 'white', marginBottom: 20 }}>
          <div className="auth-logo" style={{ background: 'linear-gradient(135deg, #f43f5e, #e11d48)' }}><FiAlertTriangle /></div>
          <h1 style={{ fontSize: 26, marginBottom: 4, fontWeight: 800 }}>Gửi khiếu nại</h1>
          <p style={{ fontSize: 13, opacity: 0.85 }}>Cho đơn hàng có vấn đề</p>
        </div>
        <div style={{ background: 'white', borderRadius: 16, padding: 24, boxShadow: 'var(--shadow-lg)' }}>
          <form onSubmit={submit}>
            <div className="form-grid">
              <div className="form-field"><label>Mã KH</label>
                <input type="text" value={maKH} onChange={(e) => setMaKH(e.target.value)} placeholder="VD: KH001" style={{ textTransform: 'uppercase' }} /></div>
              <div className="form-field"><label>Mã đơn liên quan</label>
                <input type="text" value={maDH} onChange={(e) => setMaDH(e.target.value)} placeholder="VD: DH-260529-001" /></div>
            </div>
            <div className="form-field" style={{ marginTop: 12 }}>
              <label>Họ tên / SĐT liên hệ</label>
              <input type="text" value={nguoiTao} onChange={(e) => setNguoiTao(e.target.value)} placeholder="VD: Nguyễn Văn A - 0901..." />
            </div>
            <div className="form-field" style={{ marginTop: 12 }}>
              <label className="required">Loại khiếu nại</label>
              <select value={loai} onChange={(e) => setLoai(e.target.value)}>
                <option value="HangLoi">Hàng lỗi</option>
                <option value="ThieuHang">Thiếu hàng</option>
                <option value="GiaoSai">Giao sai</option>
                <option value="KhongNhan">Không nhận được</option>
                <option value="Khac">Khác</option>
              </select>
            </div>
            <div className="form-field" style={{ marginTop: 12 }}>
              <label className="required">Mô tả chi tiết</label>
              <textarea value={moTa} onChange={(e) => setMoTa(e.target.value)} rows={5} placeholder="Mô tả vấn đề càng chi tiết càng tốt..." />
            </div>
            <div className="form-field" style={{ marginTop: 12 }}>
              <label>Ảnh bằng chứng (tùy chọn)</label>
              <input type="file" accept="image/*" onChange={onPick} />
              {anh && <img src={anh} alt="preview" style={{ marginTop: 8, maxHeight: 160, borderRadius: 6 }} />}
            </div>
            {err && <div className="login-error" style={{ marginTop: 12 }}><FiAlertCircle /> {err}</div>}
            <button type="submit" className="btn btn-primary" disabled={sending} style={{ width: '100%', marginTop: 16, padding: 12 }}>
              {sending ? <><FiClock /> Đang gửi...</> : <><FiSend /> Gửi khiếu nại</>}
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
