import React from 'react';

function Svg({ children, className }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

export function Icon({ name, className }) {
  const common = { className };
  switch (name) {
    case 'settings':
      return (
        <Svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.55V21h-4v-.08A1.7 1.7 0 0 0 8.97 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.52-1.03H3v-4h.08A1.7 1.7 0 0 0 4.6 8.94a1.7 1.7 0 0 0-.34-1.88L4.2 7l2.83-2.83.06.06a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 10 3.05V3h4v.08a1.7 1.7 0 0 0 1.03 1.52 1.7 1.7 0 0 0 1.88-.34l.06-.06L19.8 7l-.06.06a1.7 1.7 0 0 0-.34 1.88A1.7 1.7 0 0 0 20.92 10H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z" />
        </Svg>
      );
    case 'more':
      return (
        <Svg {...common}>
          <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
        </Svg>
      );
    case 'upload':
      return (
        <Svg {...common}>
          <path d="M12 16V4m0 0-4 4m4-4 4 4" />
          <path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" />
        </Svg>
      );
    case 'blank':
      return (
        <Svg {...common}>
          <rect x="4" y="4" width="16" height="16" rx="3" />
          <path d="M12 8v8M8 12h8" />
        </Svg>
      );
    case 'download':
      return (
        <Svg {...common}>
          <path d="M12 4v12m0 0 4-4m-4 4-4-4" />
          <path d="M4 20h16" />
        </Svg>
      );
    case 'image':
      return (
        <Svg {...common}>
          <rect x="3" y="4" width="18" height="16" rx="3" />
          <circle cx="9" cy="10" r="2" />
          <path d="m5 18 4-4 3 3 2-2 5 3" />
        </Svg>
      );
    case 'grid':
      return (
        <Svg {...common}>
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
        </Svg>
      );
    case 'beads':
      return (
        <Svg {...common}>
          <circle cx="8" cy="8" r="3" />
          <circle cx="16" cy="8" r="3" />
          <circle cx="8" cy="16" r="3" />
          <circle cx="16" cy="16" r="3" />
        </Svg>
      );
    case 'close':
      return (
        <Svg {...common}>
          <path d="M6 6l12 12M18 6L6 18" />
        </Svg>
      );
    case 'share':
      return (
        <Svg {...common}>
          <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
          <path d="M16 6l-4-4-4 4" />
          <path d="M12 2v14" />
        </Svg>
      );
    case 'chevron-down':
      return (
        <Svg {...common}>
          <path d="M6 9l6 6 6-6" />
        </Svg>
      );
    case 'file-text':
      return (
        <Svg {...common}>
          <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
          <path d="M14 3v6h6" />
          <path d="M8 13h8M8 17h5" />
        </Svg>
      );
    case 'table':
      return (
        <Svg {...common}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 10h18M9 4v16" />
        </Svg>
      );
    default:
      return null;
  }
}

export function BrandMark() {
  return (
    <div className="commercial-brand" aria-label="队长拼豆 品牌图标">
      <div className="commercial-brand-grid">
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
