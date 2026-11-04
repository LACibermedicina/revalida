import React, { useId } from 'react';

/** Logomarca do Revalida Prático: cruz médica facetada com o pulso de ECG (docs/marca/). */
export default function Logo({ tamanho = 30 }) {
  const id = useId().replace(/[^a-z0-9]/gi, '');
  const cx = `rv-cx-${id}`;
  return (
    <svg className="logo" width={tamanho} height={tamanho} viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      <clipPath id={cx}><path d="M82 12H118L130 24V70H176L188 82V118L176 130H130V176L118 188H82L70 176V130H24L12 118V82L24 70H70V24Z" /></clipPath>
      <g clipPath={`url(#${cx})`}>
        <polygon points="70,70 70,12 130,70" fill="#8CD3B6" /><polygon points="70,12 130,12 130,70" fill="#4FA68B" />
        <polygon points="70,70 12,70 70,130" fill="#A9E2CB" /><polygon points="12,70 12,130 70,130" fill="#6BBFA2" />
        <polygon points="130,70 188,130 130,130" fill="#2D7A68" /><polygon points="130,70 188,70 188,130" fill="#3E8F7A" />
        <polygon points="70,130 130,188 130,130" fill="#1F5F52" /><polygon points="70,130 70,188 130,188" fill="#2D7A68" />
        <polygon points="70,70 130,70 100,100" fill="#6BBFA2" /><polygon points="70,70 100,100 70,130" fill="#8CD3B6" />
        <polygon points="130,70 130,130 100,100" fill="#2D7A68" /><polygon points="70,130 100,100 130,130" fill="#154A40" />
      </g>
      <polyline className="logo-pulso" points="22,100 64,100 76,100 86,78 100,126 112,86 120,100 178,100" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
