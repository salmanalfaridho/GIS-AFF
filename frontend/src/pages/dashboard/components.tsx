import { useState, useMemo } from 'react';
import styles from './dashboard.module.css';

// ── Types ─────────────────────────────────────────────────────
export interface Onu {
  id?: number;
  mac_address?: string;
  customer?: string;
  latitude?: string;
  longitude?: string;
  rx_power: string;
  status?: string;
  odp_id?: number | null;
  port_number?: number | null;
}
export interface Odp {
  id: number;
  name: string;
  total_port: number;
  type?: string;
  odc_id?: number | null;
  latitude?: string;
  longitude?: string;
}
export interface Infra {
  name: string;
  interfaces?: { type: string; available: string; ip?: string; port?: string; }[];
}

// ── Mini progress bar ─────────────────────────────────────────
function MiniBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className={styles.miniTrack}>
      <div className={styles.miniFill} style={{ width: `${Math.min(Math.max(pct, 0), 100)}%`, background: color }} />
    </div>
  );
}

// ── CoreStatusCard ────────────────────────────────────────────
interface CoreProps {
  isOltDown: boolean;
  isMikrotikDown: boolean;
  infraUnreachable?: boolean;
  zabbixOffline?: boolean;
  infras?: Infra[];
}
export function CoreStatusCard({ isOltDown, isMikrotikDown, infraUnreachable, zabbixOffline, infras = [] }: CoreProps) {
  const isDegraded = infraUnreachable || zabbixOffline || isOltDown || isMikrotikDown;
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className={`${styles.card} ${isDegraded ? styles.cardAlert : ''}`}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitleGroup}>
            <span className={styles.cardIcon}>📡</span>
            <span className={styles.cardLabel}>Core Network</span>
          </div>
          <span className={isDegraded ? styles.badgeDanger : styles.badgeSuccess}>
            {infraUnreachable ? 'Tidak Terjangkau' : zabbixOffline ? 'Monitor Offline' : isDegraded ? 'Terganggu' : 'Nominal'}
          </span>
        </div>

        {infraUnreachable ? (
          <div className={styles.infraError}>
            <div className={styles.infraErrorIcon}>⚠️</div>
            <div className={styles.infraErrorText}>Tidak dapat terhubung ke server monitoring</div>
            <div className={styles.infraErrorSub}>Status perangkat tidak diketahui — asumsikan Down</div>
          </div>
        ) : zabbixOffline ? (
          <div className={styles.infraError} style={{ background: 'rgba(251,191,36,0.08)', borderColor: 'rgba(251,191,36,0.3)' }}>
            <div className={styles.infraErrorIcon}>🟡</div>
            <div className={styles.infraErrorText} style={{ color: '#f59e0b' }}>Server monitoring sedang offline</div>
            <div className={styles.infraErrorSub}>Menampilkan data terakhir dari cache — status real-time tidak tersedia</div>
          </div>
        ) : (
          <div className={styles.deviceList}>
            {[
              { name: 'OLT HIOSO', sub: 'Optical Line Terminal', down: isOltDown },
              { name: 'Router MikroTik', sub: 'Core Router', down: isMikrotikDown },
            ].map(dev => (
              <div key={dev.name} className={styles.deviceRow}>
                <div className={styles.deviceLeft}>
                  <span className={dev.down ? styles.dotDanger : styles.dotSuccess} />
                  <div>
                    <div className={styles.deviceName}>{dev.name}</div>
                    <div className={styles.deviceSub}>{dev.sub}</div>
                  </div>
                </div>
                <span className={dev.down ? styles.statusDown : styles.statusUp}>
                  {dev.down ? '↓ Down' : '↑ Up'}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className={styles.cardFooter}>
          <span className={styles.footerHint}>
            {infraUnreachable
              ? '🔴 Server monitoring tidak merespons'
              : zabbixOffline
                ? '🟡 Jalankan Tunnel agar monitoring aktif kembali'
                : isDegraded
                  ? '⚠️ Periksa koneksi backbone segera'
                  : '✓ Semua perangkat inti beroperasi normal'}
          </span>
        </div>

        <button type="button" className={styles.detailBtn} onClick={() => setOpen(true)}>
          ℹ️ Detail
        </button>
      </div>

      {open && (
        <div className={styles.detailOverlay} onClick={e => e.target === e.currentTarget && setOpen(false)}>
          <div className={`${styles.detailModal} ${styles.modalLarge}`}>
            <div className={styles.detailModalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className={styles.detailModalIcon}>📡</div>
                <div>
                  <div className={styles.detailModalTitle}>Detail Core Network &amp; Infrastruktur</div>
                  <span
                    className={isDegraded ? styles.badgeDanger : styles.badgeSuccess}
                    style={{ fontSize: 11, marginTop: 4, display: 'inline-block' }}
                  >
                    {infraUnreachable ? 'Server Tidak Terjangkau' : isDegraded ? 'Perangkat Terganggu' : 'Semua Beroperasi Normal'}
                  </span>
                </div>
              </div>
              <button className={styles.detailCloseBtn} onClick={() => setOpen(false)}>×</button>
            </div>

            <div className={styles.modalScrollBody}>
              <div className={styles.summaryPills}>
                <div className={styles.summaryPill}>
                  <span className={styles.summaryPillLabel}>OLT HIOSO</span>
                  <span className={styles.summaryPillValue} style={{ color: isOltDown ? 'var(--red)' : 'var(--green)' }}>
                    {isOltDown ? '🔴 DOWN' : '🟢 UP (Normal)'}
                  </span>
                </div>
                <div className={styles.summaryPill}>
                  <span className={styles.summaryPillLabel}>Router MikroTik</span>
                  <span className={styles.summaryPillValue} style={{ color: isMikrotikDown ? 'var(--red)' : 'var(--green)' }}>
                    {isMikrotikDown ? '🔴 DOWN' : '🟢 UP (Normal)'}
                  </span>
                </div>
                <div className={styles.summaryPill}>
                  <span className={styles.summaryPillLabel}>Zabbix Monitor</span>
                  <span className={styles.summaryPillValue} style={{ color: infraUnreachable ? 'var(--red)' : 'var(--green)' }}>
                    {infraUnreachable ? '🔴 Tidak Terjangkau' : '🟢 Terhubung'}
                  </span>
                </div>
              </div>

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Nama Host / Perangkat</th>
                      <th>Tipe Interface</th>
                      <th>IP &amp; Port</th>
                      <th>Status Ketersediaan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {infras.length === 0 ? (
                      <tr>
                        <td colSpan={4} className={styles.emptyCell}>
                          {infraUnreachable ? '⚠️ Gagal terhubung ke Zabbix Server' : 'Tidak ada data interface'}
                        </td>
                      </tr>
                    ) : (
                      infras.map((inf, idx) => {
                        const hasDown = inf.interfaces?.some(i => i.available === '2');
                        const iface = inf.interfaces?.[0];
                        return (
                          <tr key={idx}>
                            <td>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{inf.name}</div>
                            </td>
                            <td>
                              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                {iface?.type === '1' ? 'Agent / Ping' : iface?.type === '2' ? 'SNMP' : 'ICMP Ping'}
                              </span>
                            </td>
                            <td>
                              <span className={styles.macCell}>
                                {iface?.ip || 'fahrizal.ddns.net'} {iface?.port ? `:${iface.port}` : ''}
                              </span>
                            </td>
                            <td>
                              <span style={{
                                fontWeight: 700,
                                color: hasDown ? '#dc2626' : '#16a34a',
                                background: hasDown ? '#fef2f2' : '#f0fdf4',
                                border: `1px solid ${hasDown ? '#fecaca' : '#bbf7d0'}`,
                                padding: '3px 10px',
                                borderRadius: 20,
                                fontSize: 12,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4
                              }}>
                                {hasDown ? '🔴 Down' : '🟢 Up (Tersedia)'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className={styles.detailNote}>
                {infraUnreachable
                  ? '⚠️ Server monitoring tidak merespons. Periksa status kontainer Zabbix atau koneksi jaringan backend.'
                  : isDegraded
                    ? '⚠️ Terdapat perangkat backbone yang terputus atau tidak merespons SNMP/Ping. Segera periksa koneksi fisik OLT/Router.'
                    : '✓ Semua perangkat inti (OLT HIOSO & Router MikroTik) terhubung dan beroperasi optimal.'}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── OdcStatusCard ─────────────────────────────────────────────
interface OdcProps {
  totalOdc: number;
  fullOdcs: number;
  avgOdcUsage: number;
  odcs?: Odp[];
  odps?: Odp[];
}
export function OdcStatusCard({ totalOdc, fullOdcs, avgOdcUsage, odcs = [], odps = [] }: OdcProps) {
  const barColor = avgOdcUsage >= 80 ? 'var(--red)' : 'var(--green)';
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const odcList = useMemo(() => {
    return odcs.map(odc => {
      const connected = odps.filter(o => o.odc_id === odc.id).length;
      const total = odc.total_port || 1;
      const pct = Math.round((connected / total) * 100);
      const free = Math.max(0, total - connected);
      return { ...odc, connected, pct, free };
    });
  }, [odcs, odps]);

  const filteredOdcs = useMemo(() => {
    return odcList.filter(o => o.name.toLowerCase().includes(search.toLowerCase()));
  }, [odcList, search]);

  return (
    <>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitleGroup}>
            <span className={styles.cardIcon}>🗄️</span>
            <span className={styles.cardLabel}>Distribusi ODC</span>
          </div>
          <span className={styles.badgeBlack}>{totalOdc} Titik</span>
        </div>

        <div className={styles.bigStat}>
          <span className={styles.bigNumber} style={{ color: barColor }}>{Math.round(avgOdcUsage)}</span>
          <span className={styles.bigUnit}>%</span>
        </div>
        <p className={styles.bigSubtext}>rata-rata kapasitas terpakai</p>

        <MiniBar pct={avgOdcUsage} color={barColor} />

        <div className={styles.statRow}>
          <div className={styles.statItem}>
            <span className={styles.statItemLabel}>Total ODC</span>
            <span className={styles.statItemValue}>{totalOdc}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statItemLabel}>Kapasitas &gt;80%</span>
            <span className={`${styles.statItemValue} ${fullOdcs > 0 ? styles.red : styles.green}`}>{fullOdcs}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statItemLabel}>Normal</span>
            <span className={`${styles.statItemValue} ${styles.green}`}>{totalOdc - fullOdcs}</span>
          </div>
        </div>

        <button type="button" className={styles.detailBtn} onClick={() => setOpen(true)}>
          ℹ️ Detail
        </button>
      </div>

      {open && (
        <div className={styles.detailOverlay} onClick={e => e.target === e.currentTarget && setOpen(false)}>
          <div className={`${styles.detailModal} ${styles.modalLarge}`}>
            <div className={styles.detailModalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className={styles.detailModalIcon}>🗄️</div>
                <div>
                  <div className={styles.detailModalTitle}>Detail Distribusi ODC (Optical Distribution Cabinet)</div>
                  <span className={styles.badgeBlack} style={{ fontSize: 11, marginTop: 4, display: 'inline-block' }}>
                    {totalOdc} Titik ODC
                  </span>
                </div>
              </div>
              <button className={styles.detailCloseBtn} onClick={() => setOpen(false)}>×</button>
            </div>

            <div className={styles.modalScrollBody}>
              <div className={styles.summaryPills}>
                <div className={styles.summaryPill}>
                  <span className={styles.summaryPillLabel}>Total ODC</span>
                  <span className={styles.summaryPillValue}>{totalOdc} Titik</span>
                </div>
                <div className={styles.summaryPill}>
                  <span className={styles.summaryPillLabel}>Rata-Rata Terpakai</span>
                  <span className={styles.summaryPillValue} style={{ color: barColor }}>{Math.round(avgOdcUsage)}%</span>
                </div>
                <div className={styles.summaryPill}>
                  <span className={styles.summaryPillLabel}>Kapasitas &gt;80%</span>
                  <span className={styles.summaryPillValue} style={{ color: fullOdcs > 0 ? 'var(--red)' : 'var(--green)' }}>{fullOdcs} Titik</span>
                </div>
                <div className={styles.summaryPill}>
                  <span className={styles.summaryPillLabel}>Kapasitas Normal</span>
                  <span className={styles.summaryPillValue} style={{ color: 'var(--green)' }}>{totalOdc - fullOdcs} Titik</span>
                </div>
              </div>

              <div className={styles.searchFilterBar}>
                <input
                  type="text"
                  placeholder="🔍 Cari nama ODC..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className={styles.searchBox}
                />
              </div>

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Nama ODC</th>
                      <th>Total Port Feeder</th>
                      <th>ODP Terhubung</th>
                      <th>Sisa Port</th>
                      <th>Utilisasi</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOdcs.length === 0 ? (
                      <tr>
                        <td colSpan={7} className={styles.emptyCell}>Tidak ada ODC yang sesuai</td>
                      </tr>
                    ) : (
                      filteredOdcs.map((odc, idx) => {
                        const isFull = odc.pct >= 80;
                        const statusColor = isFull ? 'var(--red)' : 'var(--green)';
                        const statusBg = isFull ? 'var(--red-soft)' : 'var(--green-soft)';
                        const statusBorder = isFull ? 'var(--red-border)' : 'var(--green-border)';

                        return (
                          <tr key={odc.id}>
                            <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{idx + 1}</td>
                            <td>
                              <span className={styles.customerName}>{odc.name}</span>
                            </td>
                            <td>
                              <span style={{ fontWeight: 600 }}>{odc.total_port} Port</span>
                            </td>
                            <td>
                              <span style={{ color: 'var(--blue)', fontWeight: 700 }}>{odc.connected} ODP</span>
                            </td>
                            <td>
                              <span style={{ color: odc.free > 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
                                {odc.free} Port
                              </span>
                            </td>
                            <td style={{ minWidth: 120 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ flex: 1 }}>
                                  <MiniBar pct={odc.pct} color={statusColor} />
                                </div>
                                <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 700, color: statusColor }}>
                                  {odc.pct}%
                                </span>
                              </div>
                            </td>
                            <td>
                              <span style={{
                                fontWeight: 700,
                                color: statusColor,
                                background: statusBg,
                                border: `1px solid ${statusBorder}`,
                                padding: '3px 10px',
                                borderRadius: 20,
                                fontSize: 11
                              }}>
                                {isFull ? '🔴 Penuh (>80%)' : '🟢 Normal'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className={styles.detailNote}>
                ℹ️ Distribusi ODC menghubungkan kabel feeder utama ke ODP distribusi perumahan.
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── OdpCapacityCard ───────────────────────────────────────────
interface OdpProps {
  totalOdp: number;
  totalPorts: number;
  usedPorts: number;
  freePorts: number;
  usagePercent: number;
  odps?: Odp[];
  odcs?: Odp[];
  onus?: Onu[];
}
export function OdpCapacityCard({
  totalOdp,
  totalPorts,
  usedPorts,
  freePorts,
  usagePercent,
  odps = [],
  odcs = [],
  onus = []
}: OdpProps) {
  const barColor = usagePercent >= 90 ? 'var(--red)' : usagePercent >= 70 ? 'var(--amber)' : 'var(--green)';
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'available' | 'full'>('all');

  const odcMap = useMemo(() => {
    const map = new Map<number, string>();
    odcs.forEach(c => map.set(c.id, c.name));
    return map;
  }, [odcs]);

  const odpList = useMemo(() => {
    return odps.map(odp => {
      const used = onus.filter(u => u.odp_id === odp.id).length;
      const total = odp.total_port || 1;
      const pct = Math.round((used / total) * 100);
      const free = Math.max(0, total - used);
      const odcName = odp.odc_id ? odcMap.get(odp.odc_id) || `ODC #${odp.odc_id}` : '—';
      return { ...odp, used, free, pct, odcName };
    });
  }, [odps, onus, odcMap]);

  const filteredOdps = useMemo(() => {
    return odpList.filter(o => {
      const matchesSearch = o.name.toLowerCase().includes(search.toLowerCase()) || o.odcName.toLowerCase().includes(search.toLowerCase());
      if (!matchesSearch) return false;
      if (filterMode === 'available') return o.free > 0;
      if (filterMode === 'full') return o.free === 0 || o.pct >= 90;
      return true;
    });
  }, [odpList, search, filterMode]);

  return (
    <>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitleGroup}>
            <span className={styles.cardIcon}>🔌</span>
            <span className={styles.cardLabel}>Distribusi ODP</span>
          </div>
          <span className={styles.badgeBlack}>{totalOdp} Titik</span>
        </div>

        <div className={styles.bigStat}>
          <span className={styles.bigNumber} style={{ color: barColor }}>{usagePercent}</span>
          <span className={styles.bigUnit}>%</span>
        </div>
        <p className={styles.bigSubtext}>kapasitas port terpakai</p>

        <MiniBar pct={usagePercent} color={barColor} />

        <div className={styles.statRow}>
          <div className={styles.statItem}>
            <span className={styles.statItemLabel}>Total Port</span>
            <span className={styles.statItemValue}>{totalPorts}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statItemLabel}>Terpakai</span>
            <span className={styles.statItemValue}>{usedPorts}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statItemLabel}>Tersisa</span>
            <span className={`${styles.statItemValue} ${styles.green}`}>{freePorts}</span>
          </div>
        </div>

        <button type="button" className={styles.detailBtn} onClick={() => setOpen(true)}>
          ℹ️ Detail
        </button>
      </div>

      {open && (
        <div className={styles.detailOverlay} onClick={e => e.target === e.currentTarget && setOpen(false)}>
          <div className={`${styles.detailModal} ${styles.modalLarge}`}>
            <div className={styles.detailModalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className={styles.detailModalIcon}>🔌</div>
                <div>
                  <div className={styles.detailModalTitle}>Detail Distribusi ODP (Optical Distribution Point)</div>
                  <span className={styles.badgeBlack} style={{ fontSize: 11, marginTop: 4, display: 'inline-block' }}>
                    {totalOdp} Titik ODP · {totalPorts} Total Port
                  </span>
                </div>
              </div>
              <button className={styles.detailCloseBtn} onClick={() => setOpen(false)}>×</button>
            </div>

            <div className={styles.modalScrollBody}>
              <div className={styles.summaryPills}>
                <div className={styles.summaryPill}>
                  <span className={styles.summaryPillLabel}>Total ODP</span>
                  <span className={styles.summaryPillValue}>{totalOdp} Titik</span>
                </div>
                <div className={styles.summaryPill}>
                  <span className={styles.summaryPillLabel}>Total Port</span>
                  <span className={styles.summaryPillValue}>{totalPorts}</span>
                </div>
                <div className={styles.summaryPill}>
                  <span className={styles.summaryPillLabel}>Port Terpakai</span>
                  <span className={styles.summaryPillValue} style={{ color: 'var(--blue)' }}>{usedPorts}</span>
                </div>
                <div className={styles.summaryPill}>
                  <span className={styles.summaryPillLabel}>Port Tersisa</span>
                  <span className={styles.summaryPillValue} style={{ color: 'var(--green)' }}>{freePorts}</span>
                </div>
                <div className={styles.summaryPill}>
                  <span className={styles.summaryPillLabel}>Utilisasi</span>
                  <span className={styles.summaryPillValue} style={{ color: barColor }}>{usagePercent}%</span>
                </div>
              </div>

              <div className={styles.searchFilterBar}>
                <input
                  type="text"
                  placeholder="🔍 Cari nama ODP atau ODC..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className={styles.searchBox}
                />
                <div className={styles.filterGroup}>
                  <button
                    className={`${styles.filterBtn} ${filterMode === 'all' ? styles.filterActive : ''}`}
                    onClick={() => setFilterMode('all')}
                  >
                    Semua ({odpList.length})
                  </button>
                  <button
                    className={`${styles.filterBtn} ${filterMode === 'available' ? styles.filterGreen : ''}`}
                    onClick={() => setFilterMode('available')}
                  >
                    🟢 Port Tersedia ({odpList.filter(o => o.free > 0).length})
                  </button>
                  <button
                    className={`${styles.filterBtn} ${filterMode === 'full' ? styles.filterRed : ''}`}
                    onClick={() => setFilterMode('full')}
                  >
                    🔴 Penuh ({odpList.filter(o => o.free === 0 || o.pct >= 90).length})
                  </button>
                </div>
              </div>

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Nama ODP</th>
                      <th>ODC Induk</th>
                      <th>Total Port</th>
                      <th>User Terhubung</th>
                      <th>Port Kosong</th>
                      <th>Utilisasi</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOdps.length === 0 ? (
                      <tr>
                        <td colSpan={8} className={styles.emptyCell}>Tidak ada ODP yang sesuai</td>
                      </tr>
                    ) : (
                      filteredOdps.map((odp, idx) => {
                        const statusColor = odp.pct >= 90 ? 'var(--red)' : odp.pct >= 70 ? 'var(--amber)' : 'var(--green)';
                        const statusBg = odp.pct >= 90 ? 'var(--red-soft)' : odp.pct >= 70 ? 'var(--amber-soft)' : 'var(--green-soft)';
                        const statusBorder = odp.pct >= 90 ? 'var(--red-border)' : odp.pct >= 70 ? 'var(--amber-border)' : 'var(--green-border)';

                        return (
                          <tr key={odp.id}>
                            <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{idx + 1}</td>
                            <td>
                              <span className={styles.customerName}>{odp.name}</span>
                            </td>
                            <td>
                              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{odp.odcName}</span>
                            </td>
                            <td>
                              <span style={{ fontWeight: 600 }}>{odp.total_port} Port</span>
                            </td>
                            <td>
                              <span style={{ color: 'var(--blue)', fontWeight: 700 }}>{odp.used} ONU</span>
                            </td>
                            <td>
                              <span style={{ color: odp.free > 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
                                {odp.free} Port
                              </span>
                            </td>
                            <td style={{ minWidth: 120 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ flex: 1 }}>
                                  <MiniBar pct={odp.pct} color={statusColor} />
                                </div>
                                <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 700, color: statusColor }}>
                                  {odp.pct}%
                                </span>
                              </div>
                            </td>
                            <td>
                              <span style={{
                                fontWeight: 700,
                                color: statusColor,
                                background: statusBg,
                                border: `1px solid ${statusBorder}`,
                                padding: '3px 10px',
                                borderRadius: 20,
                                fontSize: 11
                              }}>
                                {odp.pct >= 90 ? '🔴 Penuh' : odp.pct >= 70 ? '🟡 Waspada' : '🟢 Tersedia'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className={styles.detailNote}>
                ℹ️ Distribusi ODP adalah titik terminasi drop core menuju rumah pelanggan (ONU).
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── OnuHealthCard ─────────────────────────────────────────────
interface OnuHealthProps {
  totalOnu: number;
  safeOnu: number;
  warningOnu: number;
  criticalOnu: number;
  onus?: Onu[];
  odps?: Odp[];
}
export function OnuHealthCard({
  totalOnu,
  safeOnu,
  warningOnu,
  criticalOnu,
  onus = [],
  odps = []
}: OnuHealthProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'safe' | 'warning' | 'critical'>('all');

  const odpMap = useMemo(() => {
    const map = new Map<number, string>();
    odps.forEach(o => map.set(o.id, o.name));
    return map;
  }, [odps]);

  const counts = useMemo(() => {
    let safe = 0;
    let warning = 0;
    let critical = 0;
    onus.forEach(onu => {
      const rxVal = parseFloat(onu.rx_power);
      const isDisconnected = onu.status === "Koneksi terputus" || onu.status === "Terputus" || onu.status === "Down" || onu.status === "Offline" || onu.rx_power === "N/A" || onu.rx_power === "0" || onu.rx_power === "" || !onu.rx_power;
      if (isDisconnected || isNaN(rxVal) || rxVal <= -26.0) {
        critical++;
      } else if (rxVal <= -25.0) {
        warning++;
      } else {
        safe++;
      }
    });
    return {
      safe: onus.length ? safe : safeOnu,
      warning: onus.length ? warning : warningOnu,
      critical: onus.length ? critical : criticalOnu,
      total: onus.length ? onus.length : totalOnu,
    };
  }, [onus, safeOnu, warningOnu, criticalOnu, totalOnu]);

  const pct = (n: number) => counts.total ? Math.round((n / counts.total) * 100) : 0;
  const hasCritical = counts.critical > 0;

  const filteredOnus = useMemo(() => {
    return onus.filter(onu => {
      const rxVal = parseFloat(onu.rx_power);
      const isDisconnected = onu.status === "Koneksi terputus" || onu.status === "Terputus" || onu.status === "Down" || onu.status === "Offline" || onu.rx_power === "N/A" || onu.rx_power === "0" || onu.rx_power === "" || !onu.rx_power;

      // Search match
      const odpName = onu.odp_id ? odpMap.get(onu.odp_id) || '' : '';
      const matchesSearch = (onu.customer || '').toLowerCase().includes(search.toLowerCase()) ||
        (onu.mac_address || '').toLowerCase().includes(search.toLowerCase()) ||
        odpName.toLowerCase().includes(search.toLowerCase());
      if (!matchesSearch) return false;

      // Filter match:
      // > -25.0 dBm = Hijau (Aman)
      // -25.0 s/d -25.99 dBm = Kuning (Warning)
      // <= -26.0 dBm / Terputus = Merah (Kritis)
      if (filterMode === 'safe') return !isDisconnected && !isNaN(rxVal) && rxVal > -25.0;
      if (filterMode === 'warning') return !isDisconnected && !isNaN(rxVal) && rxVal <= -25.0 && rxVal > -26.0;
      if (filterMode === 'critical') return isDisconnected || isNaN(rxVal) || rxVal <= -26.0;

      return true;
    });
  }, [onus, search, filterMode, odpMap]);

  return (
    <>
      <div className={`${styles.card} ${hasCritical ? styles.cardAlert : ''}`}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitleGroup}>
            <span className={styles.cardIcon}>🏠</span>
            <span className={styles.cardLabel}>Kesehatan ONU</span>
          </div>
          <span className={hasCritical ? styles.badgeDanger : styles.badgeSuccess}>{counts.total} User</span>
        </div>

        <div className={styles.onuSummary}>
          <div className={styles.onuBigNum}>
            <span className={styles.bigNumber} style={{ color: hasCritical ? 'var(--red)' : 'var(--green)' }}>
              {counts.critical > 0 ? counts.critical : counts.safe}
            </span>
            <span className={styles.onuBigLabel}>{counts.critical > 0 ? 'kritis' : 'aman'}</span>
          </div>
          <div className={styles.onuBarList}>
            {[
              { label: 'Aman', count: counts.safe, color: 'var(--green)', pct: pct(counts.safe) },
              { label: 'Warning', count: counts.warning, color: 'var(--amber)', pct: pct(counts.warning) },
              { label: 'Kritis', count: counts.critical, color: 'var(--red)', pct: pct(counts.critical) },
            ].map(row => (
              <div key={row.label} className={styles.onuBarRow}>
                <span className={styles.onuBarLabel}>{row.label}</span>
                <div className={styles.miniTrack} style={{ flex: 1 }}>
                  <div className={styles.miniFill} style={{ width: `${row.pct}%`, background: row.color }} />
                </div>
                <span className={styles.onuBarCount} style={{ color: row.color }}>{row.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.dBmHint}>
          <span>{'> −25 dBm'}</span>
          <span>−25 s/d −26</span>
          <span>{'≤ −26 dBm'}</span>
        </div>

        <button type="button" className={styles.detailBtn} onClick={() => setOpen(true)}>
          ℹ️ Detail
        </button>
      </div>

      {open && (
        <div className={styles.detailOverlay} onClick={e => e.target === e.currentTarget && setOpen(false)}>
          <div className={`${styles.detailModal} ${styles.modalLarge}`}>
            <div className={styles.detailModalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className={styles.detailModalIcon}>🏠</div>
                <div>
                  <div className={styles.detailModalTitle}>Detail Semua Data Pelanggan ONU (Optical Network Unit)</div>
                  <span
                    className={hasCritical ? styles.badgeDanger : styles.badgeSuccess}
                    style={{ fontSize: 11, marginTop: 4, display: 'inline-block' }}
                  >
                    {counts.total} Total Pelanggan
                  </span>
                </div>
              </div>
              <button className={styles.detailCloseBtn} onClick={() => setOpen(false)}>×</button>
            </div>

            <div className={styles.modalScrollBody}>
              <div className={styles.summaryPills}>
                <div className={styles.summaryPill}>
                  <span className={styles.summaryPillLabel}>Total Pelanggan</span>
                  <span className={styles.summaryPillValue}>{counts.total} User</span>
                </div>
                <div className={styles.summaryPill}>
                  <span className={styles.summaryPillLabel}>Sinyal Aman (&gt; -25 dBm)</span>
                  <span className={styles.summaryPillValue} style={{ color: 'var(--green)' }}>
                    {counts.safe} ({pct(counts.safe)}%)
                  </span>
                </div>
                <div className={styles.summaryPill}>
                  <span className={styles.summaryPillLabel}>Warning (-25 s/d -26 dBm)</span>
                  <span className={styles.summaryPillValue} style={{ color: 'var(--amber)' }}>
                    {counts.warning} ({pct(counts.warning)}%)
                  </span>
                </div>
                <div className={styles.summaryPill}>
                  <span className={styles.summaryPillLabel}>Kritis (&lt;= -26 dBm / Putus)</span>
                  <span className={styles.summaryPillValue} style={{ color: 'var(--red)' }}>
                    {counts.critical} ({pct(counts.critical)}%)
                  </span>
                </div>
              </div>

              <div className={styles.searchFilterBar}>
                <input
                  type="text"
                  placeholder="🔍 Cari nama pelanggan, MAC address, atau ODP..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className={styles.searchBox}
                />
                <div className={styles.filterGroup}>
                  <button
                    className={`${styles.filterBtn} ${filterMode === 'all' ? styles.filterActive : ''}`}
                    onClick={() => setFilterMode('all')}
                  >
                    Semua ({onus.length})
                  </button>
                  <button
                    className={`${styles.filterBtn} ${filterMode === 'safe' ? styles.filterGreen : ''}`}
                    onClick={() => setFilterMode('safe')}
                  >
                    🟢 Aman ({counts.safe})
                  </button>
                  <button
                    className={`${styles.filterBtn} ${filterMode === 'warning' ? styles.filterAmber : ''}`}
                    onClick={() => setFilterMode('warning')}
                  >
                    🟡 Warning ({counts.warning})
                  </button>
                  <button
                    className={`${styles.filterBtn} ${filterMode === 'critical' ? styles.filterRed : ''}`}
                    onClick={() => setFilterMode('critical')}
                  >
                    🔴 Kritis ({counts.critical})
                  </button>
                </div>
              </div>

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>MAC Address</th>
                      <th>Nama Pelanggan</th>
                      <th>Titik ODP &amp; Port</th>
                      <th>Redaman Optik (Rx Power)</th>
                      <th>Status Lokasi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOnus.length === 0 ? (
                      <tr>
                        <td colSpan={5} className={styles.emptyCell}>Tidak ada data ONU yang sesuai</td>
                      </tr>
                    ) : (
                      filteredOnus.map(onu => {
                        const isDisconnected = onu.status === "Koneksi terputus" || onu.status === "Terputus" || onu.status === "Down" || onu.status === "Offline" || onu.rx_power === "N/A" || onu.rx_power === "0" || onu.rx_power === "";
                        const rxVal = parseFloat(onu.rx_power);
                        const hasLocation = !!onu.latitude && !!onu.longitude;
                        const odpName = onu.odp_id ? odpMap.get(onu.odp_id) : null;

                        let rxColor = '#16a34a';
                        let rxBg = '#f0fdf4';
                        let rxBorder = '#bbf7d0';
                        let rxLabel = `${onu.rx_power} dBm`;

                        if (isDisconnected || isNaN(rxVal)) {
                          rxColor = '#dc2626';
                          rxBg = '#fef2f2';
                          rxBorder = '#fecaca';
                          rxLabel = 'Terputus';
                        } else if (rxVal <= -26.0) {
                          rxColor = '#dc2626';
                          rxBg = '#fef2f2';
                          rxBorder = '#fecaca';
                        } else if (rxVal <= -25.0) {
                          rxColor = '#d97706';
                          rxBg = '#fffbeb';
                          rxBorder = '#fde68a';
                        }

                        return (
                          <tr key={onu.mac_address || onu.id}>
                            <td><span className={styles.macCell}>{onu.mac_address}</span></td>
                            <td><span className={styles.customerName}>{onu.customer || '—'}</span></td>
                            <td>
                              {odpName ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{odpName}</span>
                                  {onu.port_number && (
                                    <span style={{ background: '#e0f2fe', color: '#0369a1', fontWeight: 700, padding: '1px 6px', borderRadius: 4, fontSize: 10 }}>
                                      Port #{onu.port_number}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                              )}
                            </td>
                            <td>
                              <span style={{
                                fontWeight: 700,
                                color: rxColor,
                                background: rxBg,
                                border: `1px solid ${rxBorder}`,
                                padding: '3px 8px',
                                borderRadius: 6,
                                fontSize: 12,
                                fontFamily: 'JetBrains Mono',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4
                              }}>
                                {rxVal > -25.0 && !isDisconnected ? '🟢' : rxVal <= -26.0 || isDisconnected ? '🔴' : '🟡'} {rxLabel}
                              </span>
                            </td>
                            <td>
                              {hasLocation ? (
                                <span className={styles.badgeComplete}>Lengkap</span>
                              ) : (
                                <span className={styles.badgeIncomplete}>Belum Diatur</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className={styles.detailNote}>
                {criticalOnu > 0
                  ? `🚨 Perhatian: Terdapat ${criticalOnu} pelanggan dengan sinyal redaman kritis atau terputus.`
                  : '✅ Kualitas redaman seluruh pelanggan terpantau aman.'}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── LoadingScreen ─────────────────────────────────────────────
export function LoadingScreen() {
  return (
    <div className={styles.loadingWrapper}>
      <div className={styles.loadingDot} />
      <span className={styles.loadingText}>Memuat data…</span>
    </div>
  );
}

