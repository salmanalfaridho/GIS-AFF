import { useEffect, useState, useCallback } from 'react';
import {
  fetchLogs,
  resolveLogById,
  deleteLog,
  clearResolvedLogs,
  LogEntry,
} from '@/lib/logService';
import { LogFilterBar, LogTable } from './components';
import styles from './logs.module.css';

export default function LogsPage() {
  useEffect(() => {
    document.title = "Event Logs | AFF DATA SOLUSI";
  }, []);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [severity, setSeverity] = useState('');
  const [source, setSource] = useState('');
  const [resolvedFilter, setResolvedFilter] = useState('');
  const [search, setSearch] = useState('');
  const [lastSync, setLastSync] = useState<Date>(new Date());

  const refresh = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (severity) params.severity = severity;
      if (source) params.source = source;
      if (resolvedFilter) params.resolved = resolvedFilter;
      const data = await fetchLogs(params as any);
      setLogs(Array.isArray(data) ? data : []);
      setLastSync(new Date());
    } catch (e) {
      console.error('Gagal fetch logs:', e);
    } finally {
      setLoading(false);
    }
  }, [severity, source, resolvedFilter]);

  // Initial fetch & auto-refresh polling every 6 seconds
  useEffect(() => {
    refresh();
    const timer = setInterval(() => {
      refresh();
    }, 6000);
    return () => clearInterval(timer);
  }, [refresh]);

  const handleResolve = async (id: number) => {
    try {
      await resolveLogById(id);
      await refresh();
    } catch (e) {
      alert('Gagal menyelesaikan log');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus baris log ini?')) return;
    try {
      await deleteLog(id);
      await refresh();
    } catch (e) {
      alert('Gagal menghapus log');
    }
  };

  const handleClearResolved = async () => {
    if (!confirm('Hapus semua log yang sudah berstatus Selesai?')) return;
    try {
      await clearResolvedLogs();
      await refresh();
    } catch (e) {
      alert('Gagal membersihkan log');
    }
  };

  // Filter search di client side
  const filtered = logs.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (l.title && l.title.toLowerCase().includes(q)) ||
      (l.message && l.message.toLowerCase().includes(q)) ||
      (l.source && l.source.toLowerCase().includes(q))
    );
  });

  // Stats
  const activeCount = logs.filter(l => !l.resolved).length;
  const criticalCount = logs.filter(l => l.severity === 'critical' && !l.resolved).length;
  const warningCount = logs.filter(l => l.severity === 'warning' && !l.resolved).length;
  const resolvedCount = logs.filter(l => l.resolved).length;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}>📋</div>
          <div>
            <div className={styles.headerTitle}>System Event Logs</div>
            <div className={styles.headerSub}>
              Pemantauan real-time riwayat kejadian, gangguan, dan status jaringan
              <span
                style={{
                  marginLeft: 12,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  background: '#f0fdf4',
                  color: '#16a34a',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 600,
                  border: '1px solid #bbf7d0',
                }}
              >
                <span>🔄 Live</span> {lastSync.toLocaleTimeString('id-ID')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Log</div>
          <div className={styles.statValue}>{logs.length}</div>
          <div className={styles.statSub}>Semua riwayat kejadian</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Gangguan Kritis</div>
          <div className={`${styles.statValue} ${styles.red}`}>{criticalCount}</div>
          <div className={styles.statSub}>Perlu tindakan segera</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Peringatan / Warning</div>
          <div className={`${styles.statValue} ${styles.orange}`}>{warningCount}</div>
          <div className={styles.statSub}>Redaman mendekati batas</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Sudah Selesai</div>
          <div className={`${styles.statValue} ${styles.green}`}>{resolvedCount}</div>
          <div className={styles.statSub}>Telah tertangani</div>
        </div>
      </div>

      {/* Filter */}
      <LogFilterBar
        severity={severity}
        source={source}
        search={search}
        resolvedFilter={resolvedFilter}
        onSeverity={setSeverity}
        onSource={setSource}
        onSearch={setSearch}
        onResolvedFilter={setResolvedFilter}
        onClearResolved={handleClearResolved}
        onRefresh={refresh}
        totalCount={filtered.length}
      />

      {/* Table */}
      {loading ? (
        <div className={styles.loading}>Memuat data log sistem...</div>
      ) : (
        <LogTable logs={filtered} onResolve={handleResolve} onDelete={handleDelete} />
      )}
    </div>
  );
}