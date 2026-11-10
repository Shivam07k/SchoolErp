import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiCall } from '../api';
import { toast } from '../toast';

export default function PicCell({ formId, rowId, config, src, onReload }) {
  const [zoom, setZoom] = useState(false);
  const picField = config?.picField || 'imgurl';
  const picTable = config?.picTable || '';

  useEffect(() => {
    if (!zoom) return;
    const onKey = (e) => { if (e.key === 'Escape') setZoom(false); };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKey); };
  }, [zoom]);

  const clearPic = async () => {
    if (!window.confirm('Delete this picture?')) return;
    setZoom(false);
    try {
      await apiCall('_PIC_CLEAR', formId, { id: rowId, params: { tbl: picTable, fld: picField } });
      toast('Picture removed', 'success');
      onReload?.();
    } catch {
      toast('Delete failed', 'error');
    }
  };

  if (!src) {
    return <i className="bi bi-image pic-placeholder"></i>;
  }

  return (
    <>
      <img
        className="pic-thumb pic-thumb-click"
        src={src}
        alt=""
        title="Click to enlarge"
        onClick={() => setZoom(true)}
      />
      {zoom && createPortal(
        <div className="pic-zoom-overlay" onClick={() => setZoom(false)}>
          <div className="pic-zoom-box" onClick={(e) => e.stopPropagation()}>
            <img className="pic-zoom-img" src={src} alt="" />
            <button className="pic-zoom-close" title="Close" onClick={() => setZoom(false)}>
              <i className="bi bi-x-lg"></i>
            </button>
            <button className="pic-zoom-delete" title="Delete picture" onClick={clearPic}>
              <i className="bi bi-trash"></i>
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}