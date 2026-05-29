'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FiCamera, FiX, FiCheck } from 'react-icons/fi';

type Pending = {
  title: string;
  maDH: string;
  onConfirm: (imageBase64: string | null) => void;
};

export default function ImageUploadModalHost() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [img, setImg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const open = useCallback((title: string, maDH: string, onConfirm: (img: string | null) => void) => {
    setPending({ title, maDH, onConfirm });
    setImg(null);
  }, []);

  useEffect(() => {
    (window as any).openImageUploadModal = open;
    return () => { delete (window as any).openImageUploadModal; };
  }, [open]);

  function close() { setPending(null); setImg(null); }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImg(reader.result as string);
    reader.readAsDataURL(file);
  }

  function confirm(withImage: boolean) {
    if (!pending) return;
    const onC = pending.onConfirm;
    const data = withImage ? img : null;
    setPending(null); setImg(null);
    onC(data);
  }

  return (
    <div className={`modal-overlay ${pending ? 'show' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2><FiCamera />{pending?.title || ''}</h2>
          <button className="modal-close" onClick={close}><FiX /></button>
        </div>
        <div className="modal-body">
          <div style={{ fontSize: 13, color: '#64748B', marginBottom: 10 }}>
            Đơn: <b>{pending?.maDH}</b>
          </div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onPick} style={{ display: 'none' }} />
          <div className="img-preview" onClick={() => fileRef.current?.click()}>
            {img ? <img src={img} alt="preview" /> : <><FiCamera /><span>Bấm để chọn ảnh (tùy chọn)</span></>}
          </div>
        </div>
        <div className="btn-row">
          <button className="btn btn-secondary" onClick={close}>Hủy</button>
          <button className="btn" onClick={() => confirm(false)}>Bỏ qua ảnh</button>
          <button className="btn btn-success" onClick={() => confirm(true)} disabled={!img}><FiCheck /> Xác nhận</button>
        </div>
      </div>
    </div>
  );
}
