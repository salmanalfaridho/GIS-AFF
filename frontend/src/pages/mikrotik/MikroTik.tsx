import { useEffect, useState, useCallback, useRef } from 'react';
import styles from './mikrotik.module.css';

interface PPPoEUser {
  username: string;
  ip_address: string;
  mac_address: string;
  uptime: string;
  service: string;
}

interface MikroTikStatus {
  connected: boolean;
  host: string;
  identity?: string;
  error?: string;
}

const AUTO_REFRESH_INTERVAL = 30; // detik

export default function MikroTikPage() {
  const [status, setStatus] = useState<MikroTikStatus | null>(null);
  const [users, setUsers] = useState<PPPoEUser[]>([]);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(AUTO_REFRESH_INTERVAL);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getToken = () => localStorage.getItem('auth_token') || '';

  // ── Fetch status koneksi MikroTik ──────────────────────────
  const fetchStatus = useCallback(async () => {
    setIsLoadingStatus(true);
    try {
      const res = await fetch('/api/mikrotik-status', {
        headers: { Authorization: `Bearer ${getToken()}` },
        credentials: 'include',
      });
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus({ connected: false, host: '', error: 'Tidak dapat menghubungi server backend' });
    } finally {
      setIsLoadingStatus(false);
    }
  }, []);

  // ── Fetch daftar PPPoE aktif ────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      const res = await fetch('/api/pppoe-active', {
        headers: { Authorization: `Bearer ${getToken()}` },
        credentials: 'include',
      });
      const data = await res.json();
      setUsers(Array.isArray(data.data) ? data.data : []);
      setLastRefresh(new Date());
    } catch {
      setUsers([]);
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  // ── Auto refresh countdown ──────────────────────────────────
  const startCountdown = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setCountdown(AUTO_REFRESH_INTERVAL);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          fetchUsers();
          return AUTO_REFRESH_INTERVAL;
        }
        return prev - 1;
      });
    }, 1000);
  }, [fetchUsers]);

  // ── Manual refresh ──────────────────────────────────────────
  const handleRefresh = async () => {
    await Promise.all([fetchStatus(), fetchUsers()]);
    startCountdown();
  };

  // ── Import ke ONU ───────────────────────────────────────────
  const handleImport = async () => {
    setIsImporting(true);
    setImportMsg(null);
    try {
      const res = await fetch('/api/mikrotik-import', {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        setImportMsg(`✅ Import selesai: ${data.created} ONU baru, ${data.updated} diperbarui`);
      } else {
        setImportMsg(`❌ Gagal: ${data.error || data.detail || 'Terjadi kesalahan'}`);
      }
    } catch {
      setImportMsg('❌ Tidak dapat menghubungi server');
    } finally {
      setIsImporting(false);
      setTimeout(() => setImportMsg(null), 6000);
    }
  };

  // ── Mount ───────────────────────────────────────────────────
  useEffect(() => {
    document.title = 'MikroTik Monitor | AFF DATA SOLUSI';
    fetchStatus();
    fetchUsers();
    startCountdown();
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [fetchStatus, fetchUsers, startCountdown]);

  // ── Filter ──────────────────────────────────────────────────
  const filtered = users.filter(u => {
    const q = searchQuery.toLowerCase();
    return (
      u.username.toLowerCase().includes(q) ||
      u.ip_address.toLowerCase().includes(q) ||
      u.mac_address.toLowerCase().includes(q)
    );
  });

  return (
    <div className={styles.page}>

      {/* ── Header ──────────────────────────────────────────── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}>📡</div>
          <div>
            <div className={styles.headerTitle}>Monitor MikroTik</div>
            <div className={styles.headerSub}>
              Pemantauan PPPoE Aktif — RouterOS API
              {lastRefresh && (
                <span className={styles.lastRefreshBadge}>
                  🔄 {lastRefresh.toLocaleTimeString('id-ID')}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className={styles.headerActions}>
          <button
            className={styles.importBtn}
            onClick={handleImport}
            disabled={isImporting || !status?.connected}
            title={!status?.connected ? 'MikroTik tidak terhubung' : 'Import PPPoE aktif ke tabel ONU'}
          >
            <span>{isImporting ? '⏳' : '⬆️'}</span>
            {isImporting ? 'Mengimport...' : 'Import ke ONU'}
          </button>
          <button
            className={styles.refreshBtn}
            onClick={handleRefresh}
            disabled={isLoadingUsers}
          >
            <span>{isLoadingUsers ? '⏳' : '↻'}</span>
            Refresh {!isLoadingUsers && <span className={styles.countdown}>({countdown}s)</span>}
          </button>
        </div>
      </div>

      {/* ── Import Message ───────────────────────────────────── */}
      {importMsg && (
        <div className={`${styles.importMsg} ${importMsg.startsWith('✅') ? styles.importMsgOk : styles.importMsgErr}`}>
          {importMsg}
        </div>
      )}

      {/* ── Status Card ─────────────────────────────────────── */}
      <div className={styles.statusRow}>
        <div className={`${styles.statusCard} ${status?.connected ? styles.statusOnline : styles.statusOffline}`}>
          <div className={styles.statusDot} />
          <div className={styles.statusInfo}>
            {isLoadingStatus ? (
              <div className={styles.statusLabel}>Memeriksa koneksi...</div>
            ) : status?.connected ? (
              <>
                <div className={styles.statusLabel}>Terhubung</div>
                <div className={styles.statusDetail}>
                  {status.identity && <strong>{status.identity}</strong>}
                  {' · '}{status.host}
                </div>
              </>
            ) : (
              <>
                <div className={styles.statusLabel}>Tidak Terhubung</div>
                <div className={styles.statusDetail}>{status?.error || status?.host}</div>
              </>
            )}
          </div>
          <div className={styles.statusBadge}>
            {status?.connected ? '🟢 Online' : '🔴 Offline'}
          </div>
        </div>

        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>PPPoE Aktif</div>
          <div className={styles.summaryValue}>{isLoadingUsers ? '...' : users.length}</div>
        </div>

        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Hasil Filter</div>
          <div className={styles.summaryValue}>{filtered.length}</div>
        </div>
      </div>

      {/* ── Search & Table ──────────────────────────────────── */}
      <div className={styles.tableSection}>
        <div className={styles.searchBar}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            id="mikrotik-search"
            type="text"
            className={styles.searchInput}
            placeholder="Cari username, IP, atau MAC address..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className={styles.searchClear} onClick={() => setSearchQuery('')}>✕</button>
          )}
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>Username PPPoE</th>
                <th>IP Address</th>
                <th>MAC Address</th>
                <th>Uptime</th>
                <th>Service</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingUsers ? (
                <tr>
                  <td colSpan={6} className={styles.emptyCell}>
                    <div className={styles.spinner} />
                    Memuat data...
                  </td>
                </tr>
              ) : !status?.connected ? (
                <tr>
                  <td colSpan={6} className={styles.emptyCell}>
                    <div className={styles.emptyIcon}>🔌</div>
                    MikroTik tidak terhubung. Periksa konfigurasi di file <code>.env</code>.
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className={styles.emptyCell}>
                    <div className={styles.emptyIcon}>📭</div>
                    {searchQuery ? 'Tidak ada hasil yang cocok.' : 'Tidak ada user PPPoE yang aktif saat ini.'}
                  </td>
                </tr>
              ) : (
                filtered.map((user, idx) => (
                  <tr key={`${user.username}-${idx}`} className={styles.tableRow}>
                    <td className={styles.tdNum}>{idx + 1}</td>
                    <td>
                      <span className={styles.username}>{user.username || '—'}</span>
                    </td>
                    <td>
                      <span className={styles.ipAddress}>{user.ip_address || '—'}</span>
                    </td>
                    <td>
                      <span className={styles.macAddress}>{user.mac_address || '—'}</span>
                    </td>
                    <td>
                      <span className={styles.uptime}>{user.uptime || '—'}</span>
                    </td>
                    <td>
                      <span className={styles.serviceBadge}>{user.service || 'pppoe'}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
