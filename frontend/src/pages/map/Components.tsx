import React from 'react';

// ── Types ─────────────────────────────────────────────────────
export interface Onu {
  id: number;
  mac_address: string;
  customer: string;
  latitude: string;
  longitude: string;
  rx_power: string;
  status?: string;
  updated_at?: string;
  odp_id?: number | null;
  port_number?: number | null;
  upload_speed?: string;
  download_speed?: string;
  path_geometry?: string;
}
export interface Odp {
  id: number;
  name: string;
  type: 'ODP' | 'ODC';
  latitude: string;
  longitude: string;
  total_port: number;
  odc_id: number | null;
  onus?: any[];
  path_geometry?: string;
}
export interface Infra {
  hostid: string;
  name: string;
  interfaces?: { type: string; available: string }[];
  inventory: { location_lat: string; location_lon: string };
}

// ── Wrapper bulat / rounded ──────────────────────────────────
interface IconWrapProps {
  size?: number;
  pulse?: boolean;
  rounded?: boolean; // false = pakai border-radius 9px (untuk ODC)
  borderColor?: string;
  shadowColor?: string;
  children: React.ReactNode;
}

export function IconWrap({
  size = 36,
  pulse = false,
  rounded = true,
  borderColor = '#e4e7ef',
  shadowColor = 'rgba(0,0,0,0.14)',
  children,
}: IconWrapProps) {
  const radius = rounded ? '50%' : '9px';
  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {pulse && (
        <>
          <span style={{
            position: 'absolute', inset: -6, borderRadius: radius,
            border: '2.5px solid #ef4444', opacity: 0,
            animation: 'mapPulse 1.5s ease-out infinite',
            pointerEvents: 'none',
          }} />
          <span style={{
            position: 'absolute', inset: -6, borderRadius: radius,
            border: '2.5px solid #ef4444', opacity: 0,
            animation: 'mapPulse 1.5s ease-out .5s infinite',
            pointerEvents: 'none',
          }} />
        </>
      )}
      <div style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: '#ffffff',
        border: `2px solid ${borderColor}`,
        boxShadow: `0 3px 8px ${shadowColor}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}>
        {children}
      </div>
    </div>
  );
}

// ── OLT icon (Optical Line Terminal - Rackmount Chassis) ───────
export function OltIcon({ down }: { down: boolean }) {
  const c = down
    ? { bg: '#FEF2F2', stroke: '#EF4444', main: '#DC2626', sub: '#FCA5A5', led: '#EF4444', border: '#F87171' }
    : { bg: '#EFF6FF', stroke: '#2563EB', main: '#1D4ED8', sub: '#93C5FD', led: '#10B981', border: '#60A5FA' };

  return (
    <IconWrap size={40} pulse={down} borderColor={c.border} rounded={false}>
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        {/* Rackmount Main Chassis */}
        <rect x="2" y="7" width="24" height="14" rx="2" fill={c.bg} stroke={c.stroke} strokeWidth="1.5" />
        {/* Rack Ear Mounts */}
        <line x1="2" y1="9" x2="2" y2="19" stroke={c.stroke} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="26" y1="9" x2="26" y2="19" stroke={c.stroke} strokeWidth="2.5" strokeLinecap="round" />
        {/* PON Slot Modules */}
        <rect x="5.5" y="10" width="4.5" height="4" rx="0.8" fill={c.main} />
        <rect x="11.5" y="10" width="4.5" height="4" rx="0.8" fill={c.main} />
        <rect x="17.5" y="10" width="4.5" height="4" rx="0.8" fill={c.sub} />
        {/* Fiber Feed Lines */}
        <line x1="7.7" y1="14" x2="7.7" y2="19" stroke={c.main} strokeWidth="1.2" strokeLinecap="round" />
        <line x1="13.7" y1="14" x2="13.7" y2="19" stroke={c.main} strokeWidth="1.2" strokeLinecap="round" />
        <line x1="19.7" y1="14" x2="19.7" y2="19" stroke={c.sub} strokeWidth="1.2" strokeLinecap="round" strokeDasharray="1.5 1.5" />
        {/* Status LED */}
        <circle cx="23.5" cy="10" r="1.5" fill={c.led} />
      </svg>
    </IconWrap>
  );
}

// ── MikroTik icon (Core Router with Antennas & Ethernet Ports) ──
export function MikrotikIcon({ down }: { down: boolean }) {
  const c = down
    ? { bg: '#FEF2F2', stroke: '#EF4444', p: '#DC2626', led: '#EF4444', border: '#F87171' }
    : { bg: '#F5F3FF', stroke: '#7C3AED', p: '#6D28D9', led: '#10B981', border: '#A78BFA' };

  return (
    <IconWrap size={40} pulse={down} borderColor={c.border} rounded={false}>
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        {/* Antennas */}
        <line x1="7" y1="9" x2="7" y2="4" stroke={c.stroke} strokeWidth="1.5" strokeLinecap="round" />
        <line x1="14" y1="9" x2="14" y2="3.5" stroke={c.stroke} strokeWidth="1.5" strokeLinecap="round" />
        <line x1="21" y1="9" x2="21" y2="4" stroke={c.stroke} strokeWidth="1.5" strokeLinecap="round" />
        {/* Router Body */}
        <rect x="3" y="9" width="22" height="13" rx="2.5" fill={c.bg} stroke={c.stroke} strokeWidth="1.5" />
        {/* Ethernet Ports */}
        <rect x="5.5" y="13" width="3.5" height="5" rx="0.8" fill={c.p} />
        <rect x="10.5" y="13" width="3.5" height="5" rx="0.8" fill={c.p} />
        <rect x="15.5" y="13" width="3.5" height="5" rx="0.8" fill={c.p} />
        {/* Status LED */}
        <circle cx="21.5" cy="13.5" r="1.3" fill={c.led} />
        {/* Activity Dot */}
        <circle cx="21.5" cy="17.5" r="1" fill={c.stroke} opacity="0.6" />
      </svg>
    </IconWrap>
  );
}

// ── ODC icon (Optical Distribution Cabinet - Outdoor Lemari ODC) ──
export function OdcIcon({ full }: { full: boolean }) {
  const c = full
    ? { bg: '#FFFBEB', stroke: '#D97706', accent: '#B45309', tray: '#F59E0B', border: '#FBBF24' }
    : { bg: '#F5F3FF', stroke: '#6D28D9', accent: '#4C1D95', tray: '#8B5CF6', border: '#A78BFA' };

  return (
    <IconWrap size={38} pulse={false} rounded={false} borderColor={c.border} shadowColor="rgba(109, 40, 217, 0.25)">
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
        {/* Outdoor Canopy Roof */}
        <path d="M2.5 5.5 L13 2.5 L23.5 5.5 L22.5 7 L3.5 7 Z" fill={c.stroke} />
        
        {/* Main Cabinet Enclosure */}
        <rect x="3.5" y="7" width="19" height="16" rx="1.5" fill={c.bg} stroke={c.stroke} strokeWidth="1.4" />
        
        {/* Center Door Splitter Line */}
        <line x1="13" y1="7" x2="13" y2="23" stroke={c.stroke} strokeWidth="1.2" />
        
        {/* Left Door - Splice Tray Cassette Rows */}
        <rect x="5.5" y="9.5" width="5.5" height="2" rx="0.5" fill={c.tray} />
        <rect x="5.5" y="12.5" width="5.5" height="2" rx="0.5" fill={c.tray} />
        <rect x="5.5" y="15.5" width="5.5" height="2" rx="0.5" fill={c.tray} />
        
        {/* Right Door - Optical Distribution Patch & Keyhole */}
        <circle cx="16" cy="10.5" r="1" fill={c.accent} />
        <circle cx="19" cy="10.5" r="1" fill={c.accent} />
        <circle cx="16" cy="13.5" r="1" fill={c.accent} />
        <circle cx="19" cy="13.5" r="1" fill={c.accent} />
        
        {/* Door Handles / Lock */}
        <rect x="11.8" y="17" width="2.4" height="3" rx="0.6" fill={c.accent} />
        
        {/* Cabinet Bottom Plinth */}
        <rect x="5" y="23" width="16" height="1.5" fill={c.stroke} />
      </svg>
    </IconWrap>
  );
}

// ── ODP icon (Optical Distribution Point - Kotak ODP Tiang / Pole Box) ──
export function OdpIcon({ level }: { level: 'ok' | 'warn' | 'full' }) {
  const c = level === 'full'
    ? { bg: '#FEF2F2', stroke: '#DC2626', split: '#EF4444', led: '#DC2626', border: '#F87171' }
    : level === 'warn'
    ? { bg: '#FFFBEB', stroke: '#D97706', split: '#F59E0B', led: '#D97706', border: '#FBBF24' }
    : { bg: '#ECFDF5', stroke: '#059669', split: '#10B981', led: '#059669', border: '#34D399' };

  return (
    <IconWrap size={34} pulse={false} rounded={true} borderColor={c.border} shadowColor="rgba(5, 150, 105, 0.22)">
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        {/* Pole Mount Top Ear */}
        <rect x="8" y="1" width="6" height="2" rx="0.8" fill={c.stroke} />
        
        {/* ODP Terminal Box Body */}
        <rect x="2.5" y="3" width="17" height="15" rx="2.5" fill={c.bg} stroke={c.stroke} strokeWidth="1.4" />
        
        {/* Optical Splitter Core Graphic: 1 Feeder to 6 Drop Ports */}
        <circle cx="11" cy="6.5" r="1.5" fill={c.stroke} />
        
        {/* Splitter Branches */}
        <path d="M7 11 L11 7.5 L15 11" stroke={c.split} strokeWidth="1.1" fill="none" strokeLinecap="round" />
        
        {/* Output Drop Adapter Ports */}
        <circle cx="6.5" cy="11.5" r="1.1" fill={c.split} />
        <circle cx="9.5" cy="11.5" r="1.1" fill={c.split} />
        <circle cx="12.5" cy="11.5" r="1.1" fill={c.split} />
        <circle cx="15.5" cy="11.5" r="1.1" fill={c.split} />
        
        {/* Bottom Drop Cable Glands */}
        <rect x="5.5" y="18" width="2" height="2.5" rx="0.5" fill={c.stroke} />
        <rect x="8.5" y="18" width="2" height="2.5" rx="0.5" fill={c.stroke} />
        <rect x="11.5" y="18" width="2" height="2.5" rx="0.5" fill={c.stroke} />
        <rect x="14.5" y="18" width="2" height="2.5" rx="0.5" fill={c.stroke} />
        
        {/* Active Power LED */}
        <circle cx="17.5" cy="5" r="0.9" fill={c.led} />
      </svg>
    </IconWrap>
  );
}

// ── ONU / Client icon (Rumah Pelanggan FTTH & ONT WiFi) ────────
export function OnuIcon({ level }: { level: 'ok' | 'warning' | 'critical' }) {
  const c =
    level === 'ok'
      ? { bg: '#F0FDF4', stroke: '#16A34A', fill: '#22C55E', signal: '#16A34A', border: '#4ADE80' }
      : level === 'warning'
      ? { bg: '#FFFBEB', stroke: '#D97706', fill: '#F59E0B', signal: '#D97706', border: '#FBBF24' }
      : { bg: '#FEF2F2', stroke: '#DC2626', fill: '#EF4444', signal: '#DC2626', border: '#F87171' };

  return (
    <IconWrap size={32} pulse={level === 'critical'} rounded={true} borderColor={c.border} shadowColor="rgba(22, 163, 74, 0.22)">
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        {/* Customer House Roof (Atap Rumah Pelanggan) */}
        <path d="M3 11 L11 4 L19 11" stroke={c.stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        
        {/* Customer House Body (Dinding Rumah) */}
        <rect x="5.5" y="10.5" width="11" height="8.5" rx="1" fill={c.bg} stroke={c.stroke} strokeWidth="1.3" />
        
        {/* Inside: ONT Device with WiFi Signals (ONT Pelanggan di Dalam Rumah) */}
        {/* WiFi Signal Arcs */}
        <path d="M8.5 12.5 Q11 10.5 13.5 12.5" stroke={c.signal} strokeWidth="1.1" fill="none" strokeLinecap="round" />
        <path d="M9.5 14 Q11 12.5 12.5 14" stroke={c.signal} strokeWidth="1.1" fill="none" strokeLinecap="round" />
        
        {/* ONT Modem Box / Fiber Connection Dot */}
        <rect x="8.5" y="15.5" width="5" height="2" rx="0.5" fill={c.fill} />
        
        {/* Fiber Drop Ingress Indicator Dot at bottom */}
        <circle cx="11" cy="18.5" r="0.8" fill={c.stroke} />
      </svg>
    </IconWrap>
  );
}

// ── Signal bars ───────────────────────────────────────────────
export function SignalBars({ rx }: { rx: number }) {
  const bars = rx >= -20 ? 4 : rx >= -23 ? 3 : rx >= -25 ? 2 : rx >= -27 ? 1 : 0;
  const col  = rx <= -27 ? '#ef4444' : rx <= -25 ? '#f59e0b' : '#16a34a';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 2, height: 14 }}>
      {[1, 2, 3, 4].map(b => (
        <span key={b} style={{
          width: 4, borderRadius: 1, height: 4 + b * 2.5,
          background: b <= bars ? col : '#e4e7ef',
          display: 'inline-block',
        }} />
      ))}
    </span>
  );
}

// ── Status badge ──────────────────────────────────────────────
export function StatusBadge({ ok, okLabel = 'ONLINE', failLabel = 'OFFLINE' }: {
  ok: boolean; okLabel?: string; failLabel?: string;
}) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
      background: ok ? '#f0fdf4' : '#fff1f2',
      color:      ok ? '#16a34a' : '#ef4444',
      border:     `1px solid ${ok ? '#bbf7d0' : '#fecaca'}`,
    }}>
      {ok ? okLabel : failLabel}
    </span>
  );
}

// ── Popup style tokens ────────────────────────────────────────
export const pp: Record<string, React.CSSProperties> = {
  wrap:  { fontFamily: "'Plus Jakarta Sans',sans-serif", minWidth: 190, padding: 2 },
  head:  { display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 },
  icon:  { width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16 },
  name:  { fontWeight: 700, fontSize: 13, color: '#111827', lineHeight: 1.3 },
  sub:   { fontSize: 11, color: '#9ca3af', marginTop: 1 },
  row:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderTop: '1px solid #f3f4f6' },
  lbl:   { fontSize: 11, color: '#6b7280' },
  val:   { fontSize: 12, fontWeight: 600, color: '#111827' },
  badge: { fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20 },
};