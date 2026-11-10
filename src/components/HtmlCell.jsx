import React from 'react';

export default function HtmlCell({ value, className, style }) {
  if (value === null || value === undefined) return <td className={className} style={style}></td>;
  const str = String(value);
  if (str.indexOf('<') !== -1) return <td className={className} style={style} dangerouslySetInnerHTML={{ __html: str }} />;
  return <td className={className} style={style}>{str}</td>;
}
