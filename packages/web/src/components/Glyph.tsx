// The SpkForge mark: an anvil struck once, three sparks flying off the face.
// With `strike`, the sparks fly when the component mounts and whenever
// `strikeKey` changes (the hero replays it after a successful copy).

import './Glyph.css';

interface GlyphProps {
  className?: string;
  strike?: boolean;
  strikeKey?: number;
  title?: string;
}

export function Glyph({ className = '', strike = false, strikeKey = 0, title }: GlyphProps) {
  return (
    <svg
      className={`glyph ${strike ? 'glyph-strike' : ''} ${className}`}
      viewBox="0 0 48 48"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <g className="glyph-sparks" key={strikeKey}>
        <path className="spark s1" d="M27 15.5L27 5" />
        <path className="spark s2" d="M30 16l7.5-7.5" />
        <path className="spark s3" d="M24 16l-6-6.5" />
        <circle className="ember e1" cx="35" cy="5.5" r="1.1" />
        <circle className="ember e2" cx="16.5" cy="6.5" r="0.9" />
      </g>
      <path
        className="glyph-anvil"
        d="M3.5 19.5c4-1.2 7.5-1.8 11-1.8H43v4.6c-2.8.6-5 1.6-6.6 3.2l-3.6 5.3h2.4l2.6 4.6h2.4V40H15.8v-4.6h2.4l2.6-4.6h2.4l-3.6-5.3c-1-1-2.3-1.6-3.8-1.9-4.4-.6-8.3-1.8-12.3-4.1z"
      />
      <path className="glyph-face" d="M14.5 17.7H43" />
    </svg>
  );
}
