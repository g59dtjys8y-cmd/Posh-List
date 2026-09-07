export function BackIcon({ color = '#14171C', size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M15 18l-6-6 6-6" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MenuIcon({ color = '#14171C', size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M4 7h11M4 12h8M4 17h5" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path
        d="M19 5v14M19 5l-3.5 3.5M19 5l3.5 3.5M19 19l-3.5-3.5M19 19l3.5-3.5"
        stroke={color}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CheckIcon({ color = '#fff', size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M5 13l4 4L19 7" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MicIcon({ color = '#fff', size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 15a3 3 0 003-3V6a3 3 0 10-6 0v6a3 3 0 003 3z"
        stroke={color}
        strokeWidth="1.8"
      />
      <path d="M6 11a6 6 0 0012 0M12 19v3" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function PencilIcon({ color = '#14171C', size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M4 20l1-4.5L15.5 5 19 8.5 8.5 19 4 20z" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M13.5 6.5l4 4" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function CopyIcon({ color = '#5C646E', size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="9" y="9" width="12" height="12" rx="2" stroke={color} strokeWidth="1.8" />
      <path d="M6 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v2" stroke={color} strokeWidth="1.8" />
    </svg>
  );
}

export function SendIcon({ color = '#fff', size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M22 2L11 13" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 2l-7 20-4-9-9-4 20-7z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DragHandleIcon({ color = '#C7CBD1', size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <circle cx="9" cy="6" r="1.6" />
      <circle cx="15" cy="6" r="1.6" />
      <circle cx="9" cy="12" r="1.6" />
      <circle cx="15" cy="12" r="1.6" />
      <circle cx="9" cy="18" r="1.6" />
      <circle cx="15" cy="18" r="1.6" />
    </svg>
  );
}

export function PlusIcon({ color = '#5C646E', size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function CrossIcon({ color = 'rgba(255,255,255,0.85)', size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M6 6l12 12M18 6L6 18" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function HomeIcon({ color = '#14171C', size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M4 11.5L12 4l8 7.5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 10v9a1 1 0 001 1h10a1 1 0 001-1v-9" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 20v-5h4v5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ListIcon({ color = '#14171C', size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="4" y="5" width="4" height="4" rx="1" stroke={color} strokeWidth="1.8" />
      <path d="M11 7h9" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <rect x="4" y="15" width="4" height="4" rx="1" stroke={color} strokeWidth="1.8" />
      <path d="M11 17h9" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function StackIcon({ color = '#14171C', size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="5" y="3" width="12" height="14" rx="2" stroke={color} strokeWidth="1.8" />
      <path d="M8 20h12a1 1 0 001-1V7" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function TrolleyTagIcon({ color = '#fff', size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M20.59 13.41L12 22l-9-9V4h9l9 9c.78.78.78 2.05 0 2.83z"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="7.5" cy="7.5" r="1.2" fill={color} />
    </svg>
  );
}
