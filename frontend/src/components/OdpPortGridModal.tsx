import React, { useState } from 'react';
import styles from './odpPortGrid.module.css';

export interface OnuData {
  id: number;
  mac_address: string;
  customer: string;
  latitude?: string;
  longitude?: string;
  rx_power: string;
  status?: string;
  odp_id?: number | null;
  port_number?: number | null;
}

export interface OdpData {
  id: number;
  name: string;
  type: 'ODP' | 'ODC';
  total_port: number;
  latitude?: string;
  longitude?: string;
  odc_id?: number | null;
  port_number?: number | null;
}

interface OdpPortGridModalProps {
  odp: OdpData;
  onus: OnuData[];
  allOdps?: OdpData[];
  unassignedOnus?: OnuData[];
  onClose: () => void;
  onAssignPort: (macAddress: string, odpId: number, portNumber: number) => Promise<void>;
  onUnassignPort: (macAddress: string) => Promise<void>;
  onAssignOdcPort?: (childOdpId: number, odcId: number, portNumber: number) => Promise<void>;
  onUnassignOdcPort?: (childOdpId: number) => Promise<void>;
}

export function OdpPortGridModal({
  odp,
  onus,
  allOdps = [],
  onClose,
  onAssignPort,
  onUnassignPort,
  onAssignOdcPort,
  onUnassignOdcPort,
}: OdpPortGridModalProps) {
  const [selectedEmptyPort, setSelectedEmptyPort] = useState<number | null>(null);
  const [selectedOnuMac, setSelectedOnuMac] = useState<string>('');
  const [selectedChildOdpId, setSelectedChildOdpId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isOdc = odp.type === 'ODC';
  const totalPorts = odp.total_port || (isOdc ? 16 : 8);

  // ── JIKA TIPE ODC: Mapping Port ke ODP anak ────────────────────────
  const childOdps = allOdps.filter(o => o.type === 'ODP' && o.odc_id === odp.id);
  const odcPortMap: { [port: number]: OdpData } = {};
  childOdps.forEach((child, idx) => {
    const pNum = child.port_number && child.port_number >= 1 && child.port_number <= totalPorts
      ? child.port_number
      : idx + 1;
    if (pNum <= totalPorts && !odcPortMap[pNum]) {
      odcPortMap[pNum] = child;
    }
  });

  // ── JIKA TIPE ODP: Mapping Port ke ONU pelanggan ───────────────────
  const odpOnus = onus.filter(o => o.odp_id === odp.id);
  const portMap: { [port: number]: OnuData } = {};
  odpOnus.forEach(onu => {
    if (onu.port_number && onu.port_number >= 1 && onu.port_number <= totalPorts) {
      portMap[onu.port_number] = onu;
    }
  });

  // Auto assign port unmapped ONU
  const unmappedOnus = odpOnus.filter(o => !o.port_number || o.port_number < 1 || o.port_number > totalPorts);
  let unmappedIdx = 0;
  for (let p = 1; p <= totalPorts; p++) {
    if (!portMap[p] && unmappedIdx < unmappedOnus.length) {
      portMap[p] = unmappedOnus[unmappedIdx];
      unmappedIdx++;
    }
  }

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmptyPort) return;
    setIsSubmitting(true);

    try {
      if (isOdc) {
        if (!selectedChildOdpId || !onAssignOdcPort) return;
        await onAssignOdcPort(parseInt(selectedChildOdpId), odp.id, selectedEmptyPort);
        setSelectedChildOdpId('');
      } else {
        if (!selectedOnuMac) return;
        await onAssignPort(selectedOnuMac, odp.id, selectedEmptyPort);
        setSelectedOnuMac('');
      }
      setSelectedEmptyPort(null);
    } catch (err) {
      alert(`Gagal menghubungkan ${isOdc ? 'ODP' : 'ONU'} ke port ini`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <span className={styles.headerIcon}>{isOdc ? '🗄️' : '🔌'}</span>
            <div>
              <div className={styles.titleText}>
                Denah Port {isOdc ? 'ODC' : 'ODP'}: {odp.name}
              </div>
              <div className={styles.subText}>
                Kapasitas Total: {totalPorts} Port Splitter {isOdc ? '(Distribusi ke ODP)' : '(Drop Core Pelanggan)'}
              </div>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        {/* Status Legend */}
        <div className={styles.legendRow}>
          {isOdc ? (
            <>
              <div className={styles.legendItem}>
                <span className={`${styles.dot} ${styles.dotOk}`} />
                <span>🟢 ODP Terpasang & Aktif</span>
              </div>
              <div className={styles.legendItem}>
                <span className={`${styles.dot} ${styles.dotEmpty}`} />
                <span>⚪ Port Kosong (Siap Pasang ODP)</span>
              </div>
            </>
          ) : (
            <>
              <div className={styles.legendItem}>
                <span className={`${styles.dot} ${styles.dotOk}`} />
                <span>🟢 Sinyal Aman (&gt; -25 dBm)</span>
              </div>
              <div className={styles.legendItem}>
                <span className={`${styles.dot} ${styles.dotWarn}`} />
                <span>🟡 Warning (-25.x dBm)</span>
              </div>
              <div className={styles.legendItem}>
                <span className={`${styles.dot} ${styles.dotCrit}`} />
                <span>🔴 Kritis (&lt;= -26 dBm / Terputus)</span>
              </div>
              <div className={styles.legendItem}>
                <span className={`${styles.dot} ${styles.dotEmpty}`} />
                <span>⚪ Port Kosong</span>
              </div>
            </>
          )}
        </div>

        {/* Grid Ports */}
        <div className={styles.gridContainer}>
          {Array.from({ length: totalPorts }, (_, i) => i + 1).map(portNum => {
            if (isOdc) {
              // ── TAMPILAN PORT UNTUK ODC (MENGELOLA ODP) ──────────
              const childOdp = odcPortMap[portNum];
              if (childOdp) {
                const connectedOnuCount = onus.filter(o => o.odp_id === childOdp.id).length;
                return (
                  <div key={portNum} className={`${styles.portCard} ${styles.cardOk}`}>
                    <div className={styles.portTop}>
                      <span className={styles.portNumberBadge}>Port #{portNum}</span>
                      <span className={styles.statusPill}>ODP Aktif</span>
                    </div>

                    <div className={styles.customerName}>🔌 {childOdp.name}</div>
                    <div className={styles.macCode}>Kapasitas: {childOdp.total_port || 8} Port</div>

                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Pelanggan Terhubung:</span>
                      <span className={styles.rxValue} style={{ color: '#16a34a', fontWeight: 800 }}>
                        🏠 {connectedOnuCount} ONU
                      </span>
                    </div>

                    <div className={styles.cardActions}>
                      <button
                        className={styles.unassignBtn}
                        style={{ width: '100%', padding: '6px', fontSize: 11 }}
                        onClick={() => {
                          if (confirm(`Lepaskan ${childOdp.name} dari Port #${portNum} ODC ini?`)) {
                            if (onUnassignOdcPort) onUnassignOdcPort(childOdp.id);
                          }
                        }}
                        title="Lepaskan ODP dari ODC ini"
                      >
                        ✕ Lepas ODP
                      </button>
                    </div>
                  </div>
                );
              }

              // Port Kosong ODC
              return (
                <div
                  key={portNum}
                  className={`${styles.portCard} ${styles.cardEmpty}`}
                  onClick={() => setSelectedEmptyPort(portNum)}
                >
                  <div className={styles.portTop}>
                    <span className={styles.portNumberBadgeEmpty}>Port #{portNum}</span>
                    <span className={styles.statusPillEmpty}>Kosong</span>
                  </div>
                  <div className={styles.emptyIcon}>⚪</div>
                  <div className={styles.emptyText}>Port Siap Pasang ODP</div>
                  <button className={styles.assignClickBtn} style={{ background: '#7c3aed', color: '#fff' }}>
                    ➕ Pasang ODP
                  </button>
                </div>
              );
            }

            // ── TAMPILAN PORT UNTUK ODP (MENGELOLA ONU) ──────────
            const onu = portMap[portNum];
            if (onu) {
              const rx = parseFloat(onu.rx_power);
              const isDisconnected = onu.status === "Koneksi terputus" || onu.status === "Terputus" || onu.status === "Down" || onu.rx_power === "N/A" || onu.rx_power === "0" || onu.rx_power === "";
              const isCritical = !isDisconnected && rx <= -26.0;
              const isWarning = !isDisconnected && rx > -26.0 && rx <= -25.0;
              const cardStatusClass = isDisconnected || isCritical
                ? styles.cardCrit
                : isWarning
                ? styles.cardWarn
                : styles.cardOk;

              return (
                <div key={portNum} className={`${styles.portCard} ${cardStatusClass}`}>
                  <div className={styles.portTop}>
                    <span className={styles.portNumberBadge}>Port #{portNum}</span>
                    <span className={styles.statusPill}>
                      {isDisconnected ? 'Terputus' : isCritical ? 'Kritis' : isWarning ? 'Warning' : 'Online'}
                    </span>
                  </div>

                  <div className={styles.customerName}>{onu.customer || 'Pelanggan'}</div>
                  <div className={styles.macCode} title={onu.mac_address}>{onu.mac_address}</div>

                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Redaman Sinyal (Rx):</span>
                    <span className={styles.rxValue}>
                      {isDisconnected ? 'N/A (Terputus)' : `${onu.rx_power} dBm`}
                    </span>
                  </div>

                  <div className={styles.cardActions}>
                    <button
                      className={styles.unassignBtn}
                      style={{ width: '100%', padding: '6px', fontSize: 11 }}
                      onClick={() => {
                        if (confirm(`Lepaskan ${onu.customer || onu.mac_address} dari Port #${portNum}?`)) {
                          onUnassignPort(onu.mac_address);
                        }
                      }}
                      title="Lepaskan dari Port"
                    >
                      ✕ Lepas Port
                    </button>
                  </div>
                </div>
              );
            }

            // Port Kosong ODP
            return (
              <div
                key={portNum}
                className={`${styles.portCard} ${styles.cardEmpty}`}
                onClick={() => setSelectedEmptyPort(portNum)}
              >
                <div className={styles.portTop}>
                  <span className={styles.portNumberBadgeEmpty}>Port #{portNum}</span>
                  <span className={styles.statusPillEmpty}>Kosong</span>
                </div>
                <div className={styles.emptyIcon}>⚪</div>
                <div className={styles.emptyText}>Port Siap Dipakai</div>
                <button className={styles.assignClickBtn}>
                  ➕ Pasang ONU
                </button>
              </div>
            );
          })}
        </div>

        {/* Modal Sub-Assign (ODP atau ONU) */}
        {selectedEmptyPort !== null && (
          <div className={styles.subModalOverlay} onClick={e => e.target === e.currentTarget && setSelectedEmptyPort(null)}>
            <div className={styles.subModal}>
              <div className={styles.subModalHeader}>
                <div className={styles.subModalTitle}>
                  {isOdc
                    ? `➕ Pasang ODP ke Port #${selectedEmptyPort} (${odp.name})`
                    : `➕ Pasang ONU Pelanggan ke Port #${selectedEmptyPort} (${odp.name})`}
                </div>
                <button className={styles.closeBtn} onClick={() => setSelectedEmptyPort(null)}>×</button>
              </div>
              <form onSubmit={handleAssignSubmit} className={styles.subModalForm}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>
                    {isOdc ? 'Pilih ODP yang Akan Dihubungkan:' : 'Pilih ONU / Pelanggan:'}
                  </label>

                  {isOdc ? (
                    <select
                      className={styles.formSelect}
                      value={selectedChildOdpId}
                      onChange={e => setSelectedChildOdpId(e.target.value)}
                      required
                    >
                      <option value="">-- Pilih ODP --</option>
                      {allOdps
                        .filter(o => o.type === 'ODP')
                        .map(o => (
                          <option key={o.id} value={o.id}>
                            🔌 {o.name} {o.odc_id === odp.id ? `(Saat ini di Port #${o.port_number || '?'})` : o.odc_id ? '(Sudah di ODC lain)' : '(Belum ada ODC)'}
                          </option>
                        ))}
                    </select>
                  ) : (
                    <select
                      className={styles.formSelect}
                      value={selectedOnuMac}
                      onChange={e => setSelectedOnuMac(e.target.value)}
                      required
                    >
                      <option value="">-- Pilih Pelanggan ONU --</option>
                      {onus.map(o => (
                        <option key={o.id} value={o.mac_address}>
                          {o.customer ? `${o.customer} (${o.mac_address})` : o.mac_address}
                          {o.odp_id === odp.id ? ' [Saat ini di ODP ini]' : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className={styles.formActions}>
                  <button
                    type="button"
                    className={styles.cancelBtn}
                    onClick={() => setSelectedEmptyPort(null)}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className={styles.saveBtn}
                    style={isOdc ? { background: '#7c3aed' } : undefined}
                    disabled={isSubmitting || (isOdc ? !selectedChildOdpId : !selectedOnuMac)}
                  >
                    {isSubmitting ? 'Menyimpan...' : isOdc ? 'Hubungkan ODP ke Port' : 'Hubungkan ke Port'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
