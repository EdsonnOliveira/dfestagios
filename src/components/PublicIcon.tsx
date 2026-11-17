import type { ReactNode } from 'react';

export type PublicIconName =
  | 'chevronDown' | 'user' | 'userPlus' | 'graduation' | 'building'
  | 'id' | 'calendar' | 'phone' | 'mail' | 'mapPin' | 'home'
  | 'briefcase' | 'headset' | 'megaphone' | 'chart' | 'coins' | 'handshake'
  | 'users' | 'shield' | 'arrowRight' | 'lock';

const shapes: Record<PublicIconName, ReactNode> = {
  chevronDown: <path d="m6 9 6 6 6-6" />,
  user: <><circle cx="12" cy="7.5" r="3.5" /><path d="M5 21v-2.4A5.6 5.6 0 0 1 10.6 13h2.8A5.6 5.6 0 0 1 19 18.6V21H5Z" /></>,
  userPlus: <><circle cx="10" cy="7.5" r="3.4" /><path d="M3.5 20v-1.4A5.6 5.6 0 0 1 9.1 13h1.8a5.6 5.6 0 0 1 5.3 3.8M19 13v7m-3.5-3.5h7" /></>,
  graduation: <><path d="M2 9 12 4l10 5-10 5L2 9Z" fill="currentColor" stroke="none" /><path d="M5.5 12v5c4 3 9 3 13 0v-5" fill="currentColor" stroke="none" /><path d="M21 10v7" /></>,
  building: <><path d="M3 21V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v17H3Zm11 0V10a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v11h-7Z" fill="currentColor" stroke="none" /><path d="M6 7h2m2 0h1M6 11h2m2 0h1M6 15h2m2 0h1M17 13h2m-2 4h2" stroke="#fff" strokeWidth="1.8" /></>,
  id: <><rect x="2.5" y="5" width="19" height="14" rx="2" /><circle cx="8.5" cy="10.5" r="2" /><path d="M5.5 16c.6-1.5 1.7-2.2 3-2.2s2.4.7 3 2.2M14.5 10h4m-4 4h4" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 2v6m10-6v6M3 10h18" /></>,
  phone: <><path d="M20.5 11.5a8.5 8.5 0 0 1-12.4 7.6L3 21l1.9-5.1A8.5 8.5 0 1 1 20.5 11.5Z" /><path d="M8 8.5c.4-.5.8-.5 1.1 0l1.1 1.6c.2.4.1.7-.3 1l-.6.4a8.1 8.1 0 0 0 3.2 3.2l.4-.6c.3-.4.6-.5 1-.3l1.6 1.1c.5.3.5.7 0 1.1-.6.6-1.5 1-2.2.8-2.3-.7-5.2-3.6-5.9-5.9-.2-.7.2-1.6.6-2.2Z" /></>,
  mail: <><rect x="2" y="4.5" width="20" height="15" rx="2" /><path d="m3 6 9 7 9-7" /></>,
  mapPin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
  home: <><path d="m2 10 10-8 10 8v11H2V10Z" /><path d="M9 21v-7h6v7" /></>,
  briefcase: <><rect x="2" y="6" width="20" height="16" rx="2" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M2 12c5 3 15 3 20 0M10 13v3h4v-3" /></>,
  headset: <><path d="M3 13v-2a9 9 0 0 1 18 0v2M3 13v5a2 2 0 0 0 2 2h2v-8H5a2 2 0 0 0-2 2Zm18 0v5a2 2 0 0 1-2 2h-2v-8h2a2 2 0 0 1 2 2ZM17 21c-1.4 1-3 1-5 1" /></>,
  megaphone: <><path d="M3 10v4a2 2 0 0 0 2 2h3l2 5h3l-2-5h1l8 4V4l-8 4H5a2 2 0 0 0-2 2Z" /><path d="M20 10c1.5.3 2 1.3 2 2s-.5 1.7-2 2" /></>,
  chart: <><path d="M4 21v-7h4v7M10 21V9h4v12M16 21V4h4v17" /></>,
  coins: <><ellipse cx="8" cy="6" rx="6" ry="2.5" /><path d="M2 6v5c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V6M2 11v5c0 1.4 2.7 2.5 6 2.5 1.2 0 2.3-.1 3.2-.4" /><path d="M10 15c0-1.4 2.7-2.5 6-2.5s6 1.1 6 2.5-2.7 2.5-6 2.5-6-1.1-6-2.5Zm0 0v4c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-4" /></>,
  handshake: <><path d="m2 10 4-4 4 2 3-1 5 4-4 4-3-2-3 3-6-6Zm20 0-4-4-3 1m-9 8 3 3 2-1 2 2 2-1 2 1 3-3" /><path d="m12 10 3 2" /></>,
  users: <><circle cx="9" cy="8" r="3" /><path d="M2 20v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2H2Z" /><path d="M16 5a3 3 0 0 1 0 6m2 2a5 5 0 0 1 4 5v2h-4" /></>,
  shield: <><path d="m12 2 9 4v6c0 5-3.5 8-9 10-5.5-2-9-5-9-10V6l9-4Z" /><path d="m8 12 3 3 5-6" /></>,
  arrowRight: <><path d="M4 12h16m-6-6 6 6-6 6" /></>,
  lock: <><rect x="4" y="10" width="16" height="12" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v3" /></>,
};

export default function PublicIcon({ name, size = 24, className = '' }: { name: PublicIconName; size?: number; className?: string }) {
  return <svg className={className} aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{shapes[name]}</svg>;
}
