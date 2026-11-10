import React, { useRef, useState } from 'react';
import { apiCall } from '../api';
import { toast } from '../toast';

const MAX_BYTES = 3 * 1024 * 1024;
const COMPRESS_BYTES = 300 * 1024;
const IMG_RE = /^data:image\/(png|jpe?g|gif|webp)/i;

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX_EDGE = 1024;
      let { width, height } = img;
      if (width > MAX_EDGE || height > MAX_EDGE) {
        const scale = MAX_EDGE / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        resolve(blob || file);
      }, 'image/jpeg', 0.75);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Invalid image')); };
    img.src = url;
  });
}

export default function PicUpload({ formId, rowId, onDone, onError, showLabel }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const pick = () => fileRef.current?.click();

  const onPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\/(png|jpe?g|gif|webp)$/i.test(file.type)) {
      toast('Please select an image file (png/jpg/gif/webp)', 'error');
      onError?.(new Error('Not an image'));
      return;
    }
    if (file.size > MAX_BYTES) {
      toast('Image too large (max 3MB)', 'error');
      onError?.(new Error('Image too large'));
      return;
    }
    let target = file;
    if (file.size > COMPRESS_BYTES) {
      try {
        target = await compressImage(file);
      } catch (err) {
        toast('Could not read image', 'error');
        onError?.(err);
        return;
      }
    }
    const dataUrl = await new Promise((resolve, reject) => {
      const rd = new FileReader();
      rd.onload = () => resolve(String(rd.result));
      rd.onerror = () => reject(new Error('File read failed'));
      rd.readAsDataURL(target);
    });
    const m = dataUrl.match(IMG_RE);
    const ext = (m && m[1] === 'jpeg' ? 'jpg' : (m && m[1]) || 'jpg');
    setBusy(true);
    try {
      const r = await apiCall('_PIC_UPLOAD', formId, {
        id: rowId,
        params: {
          data: dataUrl.split(',')[1] || '',
          ext,
        },
      });
      if (r?.error) { toast(r.error, 'error'); onError?.(new Error(r.error)); return; }
      toast('Picture uploaded', 'success');
      onDone?.(r?.path);
    } catch (err) {
      toast('Upload failed', 'error');
      onError?.(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onPick} />
      <button className="btn-row pic pic-upload-btn" title="Upload picture" onClick={pick} disabled={busy}>
        <i className={busy ? 'bi bi-arrow-repeat spin' : 'bi bi-cloud-arrow-up'} />
        <span className="pic-upload-label">Upload</span>
      </button>
    </>
  );
}