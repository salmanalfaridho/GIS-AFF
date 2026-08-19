"use client";

import { LogEntry, LogSeverity, LogSource } from '@/lib/logService';
import styles from './logs.module.css';

// ── SEV config ────────────────────────────────────────────────
export const SEV: Record<LogSeverity, { bg: string; border: string; color: string; label: string }> = {
  critical: { bg: '#fff1f2', border: '#fecaca', color: '#ef4444', label: 'Kritis' },
  warning:  { bg: '#fffbeb', border: '#fde68a', color: '#d97706', label: 'Warning' },
  info:     { bg: '#f0f9ff', border: '#bae6fd', color: '#0284c7', label: 'Info' },
};

export const SRC: Record<LogSource, { emoji: string; color: string }> = {
  ONU:      { emoji: '🏠', color: '#16a34a' },
  ODP:      { emoji: '🔌', color: '#d97706' },
  ODC:      { emoji: '🗄️', color: '#7c3aed' },
  MikroTik: { emoji: '📡', color: '#0284c7' },
  Infra:    { emoji: '🌐', color: '#6366f1' },
  System:   { emoji: '⚙️', color: '#6b7280' },
};

// ── Timestamp ─────────────────────────────────────────────────
export function logTimestamp(d: string): string {
  const date = new Date(d);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// ── Filter bar ────────────────────────────────────────────────
interface FilterProps {
  severity: string;
  source: string;
  search: string;
  resolvedFilter: string;
  onSeverity: (v: string) => void;
  onSource: (v: string) => void;
  onSearch: (v: string) => void;
  onResolvedFilter: (v: string) => void;
  onClearResolved: () => void;
  onRefresh: () => void;
  totalCount: number;
}

export function LogFilterBar({
  severity,
  source,
  search,
  resolvedFilter,
  onSeverity,
  onSource,
  onSearch,
  onResolvedFilter,
  onClearResolved,
  onRefresh,
  totalCount,
}: FilterProps) {
  return (
    <div className={styles.filterWrap}>
      <div className={styles.filterLeft}>
        {/* Severity */}
        {(['', 'critical', 'warning', 'info'] as const).map(s => (
          <button
            key={s}
            className={`${styles.filterBtn} ${severity === s ? styles.filterBtnActive : ''}`}
            style={
              severity === s && s
                ? {
                    background: SEV[s as LogSeverity].bg,
                    color: SEV[s as LogSeverity].color,
                    borderColor: SEV[s as LogSeverity].border,
                  }
                : undefined
            }
            onClick={() => onSeverity(s)}
          >
            {s === '' ? 'Semua Severity' : SEV[s as LogSeverity].label}
          </button>
        ))}

        <div className={styles.filterDivider} />

        {/* Source */}
        {(['', 'ONU', 'ODP', 'ODC', 'MikroTik', 'Infra', 'System'] as const).map(s => (
          <button
            key={s}
            className={`${styles.filterBtn} ${source === s ? styles.filterBtnActive : ''}`}
            onClick={() => onSource(s)}
          >
            {s === '' ? 'Semua Sumber' : `${SRC[s as LogSource]?.emoji || '📌'} ${s}`}
          </button>
        ))}

        <div className={styles.filterDivider} />

        {/* Status Filter */}
        {(['', 'false', 'true'] as const).map(rf => (
          <button
            key={rf}
            className={`${styles.filterBtn} ${resolvedFilter === rf ? styles.filterBtnActive : ''}`}
            onClick={() => onResolvedFilter(rf)}
          >
            {rf === '' ? 'Semua Status' : rf === 'false' ? '🚨 Belum Selesai' : '✅ Selesai'}
          </button>
        ))}
      </div>

      <div className={styles.filterRight}>
        <input
          className={styles.searchInput}
          placeholder="Cari log (judul / pesan)..."
          value={search}
          onChange={e => onSearch(e.target.value)}
        />
        <button
          className={styles.filterBtn}
          style={{ background: '#f1f5f9', fontWeight: 700 }}
          onClick={onRefresh}
          title="Refresh Data Log"
        >
          🔄 Refresh
        </button>
        <button
          className={styles.filterBtn}
          style={{ background: '#fee2e2', color: '#b91c1c', borderColor: '#fecaca', fontWeight: 700 }}
          onClick={onClearResolved}
          title="Bersihkan semua log yang sudah diselesaikan"
        >
          🗑️ Bersihkan Selesai
        </button>
      </div>
    </div>
  );
}

// ── Log table ─────────────────────────────────────────────────
interface TableProps {
  logs: LogEntry[];
  onResolve: (id: number) => void;
  onDelete: (id: number) => void;
}

export function LogTable({ logs, onResolve, onDelete }: TableProps) {
  if (logs.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>📋</div>
        <div>Tidak ada log yang sesuai filter</div>
      </div>
    );
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Waktu</th>
            <th>Severity</th>
            <th>Sumber</th>
            <th>Status</th>
            <th>Judul Kejadian</th>
            <th>Pesan & Detail</th>
            <th style={{ textAlign: 'center' }}>Aksi</th>
          </tr>
        </thead>
        <tbody>
          {logs.map(log => {
            const sev = SEV[log.severity] || SEV.info;
            const src = SRC[log.source] || { emoji: '📌', color: '#64748b' };
            const isResolved = log.resolved;

            return (
              <tr key={log.id} style={isResolved ? { opacity: 0.75, background: '#f8fafc' } : undefined}>
                <td>
                  <span className={styles.timestamp}>{logTimestamp(log.created_at)}</span>
                </td>
                <td>
                  <span
                    className={styles.badge}
                    style={{ background: sev.bg, color: sev.color, borderColor: sev.border }}
                  >
                    {sev.label}
                  </span>
                </td>
                <td>
                  <span className={styles.sourceTag} style={{ color: src.color }}>
                    {src.emoji} {log.source}
                  </span>
                </td>
                <td>
                  {isResolved ? (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 12,
                        background: '#f0fdf4',
                        color: '#16a34a',
                        border: '1px solid #bbf7d0',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                      }}
                    >
                      ✅ Selesai
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 12,
                        background: '#fef2f2',
                        color: '#dc2626',
                        border: '1px solid #fecaca',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                      }}
                    >
                      🚨 Aktif
                    </span>
                  )}
                </td>
                <td>
                  <div style={{ fontWeight: 700, color: '#1e293b' }}>{log.title}</div>
                </td>
                <td>
                  <div style={{ color: '#475569', fontSize: 13 }}>{log.message}</div>
                  {isResolved && log.resolved_at && (
                    <div style={{ fontSize: 11, color: '#16a34a', marginTop: 2 }}>
                      Diselesaikan pada: {logTimestamp(log.resolved_at)}
                    </div>
                  )}
                </td>
                <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'inline-flex', gap: 6 }}>
                    {!isResolved && (
                      <button
                        onClick={() => onResolve(log.id)}
                        style={{
                          background: '#eff6ff',
                          color: '#2563eb',
                          border: '1px solid #bfdbfe',
                          padding: '4px 8px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                        title="Tandai Masalah Selesai"
                      >
                        ✓ Selesaikan
                      </button>
                    )}
                    <button
                      onClick={() => onDelete(log.id)}
                      style={{
                        background: '#fef2f2',
                        color: '#ef4444',
                        border: '1px solid #fecaca',
                        padding: '4px 8px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                      title="Hapus Log"
                    >
                      ✕ Hapus
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}