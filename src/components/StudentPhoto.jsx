import React, { useEffect, useState } from 'react';
import { getToken } from '../api';

export default function StudentPhoto({ photoUrl, name, className = '' }) {
  const [imageUrl, setImageUrl] = useState('');
  const [failed, setFailed] = useState(false);
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
  const source = typeof photoUrl === 'string' ? photoUrl : '';

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setImageUrl('');
    setFailed(false);

    if (!source) return () => { active = false; };
    if (!source.startsWith('/api/school/uploads/')) {
      setImageUrl(source);
      return () => { active = false; };
    }

    fetch(source, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load student photo: ${response.status}`);
        return response.blob();
      })
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (active) setImageUrl(objectUrl);
        else URL.revokeObjectURL(objectUrl);
      })
      .catch(() => {
        if (active) setFailed(true);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [source]);

  return imageUrl && !failed
    ? <img className={`student-photo ${className}`} src={imageUrl} alt={`${name || 'Student'} photo`} />
    : <span className={`student-photo student-photo-fallback ${className}`} aria-label={`${name || 'Student'} photo unavailable`}>{initial}</span>;
}
