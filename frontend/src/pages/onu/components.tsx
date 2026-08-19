import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import styles from './onu.module.css';

// Fix leaflet default icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icons
const blueIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const blackIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-black.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [20, 33],
  iconAnchor: [10, 33],
  popupAnchor: [1, -27],
  shadowSize: [33, 33]
});

// ── Types ────────────────────────────────────────────────────
export interface Onu {
  id: number;
  mac_address: string;
  customer: string;
  latitude: string;
  longitude: string;
  rx_power: string;
  status: string;
  odp_id?: number | null;
  port_number?: number | null;
}
export interface Odp {
  id: number;
  name: string;
  total_port?: number;
  latitude: string;
  longitude: string;
}
export interface OnuForm {
  customer: string;
  latitude: string;
  longitude: string;
  odp_id: string;
  port_number?: string;
}
export type FilterMode = 'all' | 'complete' | 'incomplete';

// ── Leaflet Maps click handler ────────────────────────────────
function MapClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// ── OnuTable ─────────────────────────────────────────────────
interface TableProps {
  onus: Onu[];
  odps?: Odp[];
  filterMode: FilterMode;
  onFilterChange: (mode: FilterMode) => void;
  totalCount: number;
  onEdit: (onu: Onu) => void;
}
export function OnuTable({ onus, odps = [], filterMode, onFilterChange, totalCount, onEdit }: TableProps) {
  const completeCount = onus.filter(o => o.latitude && o.longitude).length;
  const incompleteCount = onus.filter(o => !o.latitude || !o.longitude).length;

  const odpMap = new Map<number, string>();
  odps.forEach(o => odpMap.set(o.id, o.name));

  return (
    <>
      {/* Filter Bar */}
      <div className={styles.filterBar}>
        <span className={styles.filterLabel}>Filter:</span>
        <button
          className={`${styles.filterBtn} ${filterMode === 'all' ? styles.filterActive : ''}`}
          onClick={() => onFilterChange('all')}
        >
          Semua ({totalCount})
        </button>
        <button
          className={`${styles.filterBtn} ${filterMode === 'complete' ? styles.filterComplete : ''}`}
          onClick={() => onFilterChange('complete')}
        >
          ✅ Lengkap ({completeCount})
        </button>
        <button
          className={`${styles.filterBtn} ${filterMode === 'incomplete' ? styles.filterIncomplete : ''}`}
          onClick={() => onFilterChange('incomplete')}
        >
          ❌ Belum Diatur ({incompleteCount})
        </button>
      </div>

      {/* Table */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>MAC Address</th>
              <th>Nama Pelanggan</th>
              <th>Titik ODP &amp; Port</th>
              <th>Redaman Optik (Rx Power)</th>
              <th>Status Lokasi</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {onus.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.emptyCell}>
                  <div className={styles.emptyIcon}>🗄️</div>
                  Tidak ada data yang sesuai filter.
                </td>
              </tr>
            ) : onus.map(onu => {
              const isDisconnected = onu.status === "Koneksi terputus" || onu.status === "Terputus" || onu.status === "Down" || onu.status === "Offline" || onu.rx_power === "N/A" || onu.rx_power === "0" || onu.rx_power === "";
              const rxVal = parseFloat(onu.rx_power);
              const hasLocation = !!onu.latitude && !!onu.longitude;
              const rowStyle = isDisconnected ? { backgroundColor: '#fee2e2' } : {};
              const odpName = onu.odp_id ? odpMap.get(onu.odp_id) : null;

              // Aturan Warna Pengguna:
              // > -25.0 dBm = Hijau (Aman)
              // -25.0 s/d -25.99 dBm = Kuning (Warning)
              // <= -26.0 dBm / Terputus = Merah (Kritis)
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
                <tr key={onu.id} style={rowStyle}>
                  <td><span className={styles.macCell}>{onu.mac_address}</span></td>
                  <td><span className={styles.customerName}>{onu.customer || '—'}</span></td>
                  <td>
                    {odpName ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                          🔌 {odpName}
                        </span>
                        {onu.port_number ? (
                          <span style={{ background: '#e0f2fe', color: '#0369a1', fontWeight: 700, padding: '2px 8px', borderRadius: 6, fontSize: 11 }}>
                            Port #{onu.port_number}
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: 12 }}>— Belum Terhubung</span>
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
                      fontFamily: 'var(--mono)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4
                    }}>
                      {rxVal > -25.0 && !isDisconnected ? '🟢' : rxVal <= -26.0 || isDisconnected ? '🔴' : '🟡'} {rxLabel}
                    </span>
                  </td>
                  <td>
                    {hasLocation
                      ? <span className={styles.badgeComplete}>Lengkap</span>
                      : <span className={styles.badgeIncomplete}>Belum Diatur</span>}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className={styles.editBtn} onClick={() => onEdit(onu)}>
                        ✏️ Edit & Set Lokasi
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── OnuModal (Edit Pelanggan + Peta) ───────────────────────────
interface ModalProps {
  onu: Onu;
  form: OnuForm;
  setForm: React.Dispatch<React.SetStateAction<OnuForm>>;
  odps: Odp[];
  isLoading: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onMapClick: (lat: number, lng: number) => void;
  onOdpChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}
export function OnuModal({ onu, form, setForm, odps, isLoading, onClose, onSubmit, onMapClick, onOdpChange }: ModalProps) {
  const [mapMode, setMapMode] = useState<'satellite' | 'osm'>('satellite');

  const center: [number, number] = form.latitude && form.longitude
    ? [parseFloat(form.latitude), parseFloat(form.longitude)]
    : [-7.536199, 112.436890];

  const selectedOdp = odps.find(o => o.id.toString() === form.odp_id);

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>

        {/* Header */}
        <div className={styles.modalHeader}>
          <div>
            <div className={styles.modalTitle}>✏️ Edit Data ONU</div>
            <div className={styles.modalSub}>{onu.mac_address}</div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        {/* Body */}
        <div className={styles.modalBody}>

          {/* Form */}
          <div className={styles.formSide}>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Nama Pelanggan</label>
              <input
                className={styles.fieldInput}
                type="text"
                placeholder="Masukkan nama pelanggan"
                value={form.customer}
                onChange={e => setForm({ ...form, customer: e.target.value })}
                required
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Pilih ODP</label>
              <div className={styles.coordHint}>🔗 Memilih ODP akan mengisi koordinat otomatis</div>
              <select className={styles.fieldSelect} value={form.odp_id} onChange={onOdpChange}>
                <option value="">— Pilih ODP —</option>
                {odps.map(odp => (
                  <option key={odp.id} value={odp.id}>{odp.name}</option>
                ))}
              </select>
            </div>

            {form.odp_id && (
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Nomor Port ODP</label>
                <select
                  className={styles.fieldSelect}
                  value={form.port_number || ''}
                  onChange={e => setForm({ ...form, port_number: e.target.value })}
                >
                  <option value="">— Pilih Nomor Port (Opsional) —</option>
                  {Array.from({ length: selectedOdp?.total_port || 8 }, (_, i) => i + 1).map(num => (
                    <option key={num} value={num}>Port #{num}</option>
                  ))}
                </select>
              </div>
            )}

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Koordinat Lokasi</label>
              <div className={styles.coordHint}>🗺️ Klik peta atau pilih ODP untuk mengisi otomatis</div>
              <div className={styles.coordRow}>
                <input
                  className={`${styles.fieldInput} ${styles.mono}`}
                  placeholder="Latitude"
                  value={form.latitude}
                  readOnly
                />
                <input
                  className={`${styles.fieldInput} ${styles.mono}`}
                  placeholder="Longitude"
                  value={form.longitude}
                  readOnly
                />
              </div>
            </div>

            <button className={styles.submitBtn} onClick={onSubmit} disabled={isLoading || !form.customer}>
              {isLoading ? 'Menyimpan...' : 'Simpan Data'}
            </button>
          </div>

          {/* Map */}
          <div className={styles.mapSide}>
            <div className={styles.mapLabel}>🖱️ Klik peta untuk geser titik lokasi</div>

            {/* Map Mode Switcher */}
            <div style={{
              position: 'absolute', top: 12, right: 12, zIndex: 1000,
              display: 'flex', gap: 4, background: 'rgba(255,255,255,0.92)',
              padding: 4, borderRadius: 8, boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              border: '1px solid #cbd5e1', backdropFilter: 'blur(4px)'
            }}>
              <button
                type="button"
                onClick={() => setMapMode('satellite')}
                style={{
                  padding: '4px 8px', fontSize: 11, fontWeight: 700, borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: mapMode === 'satellite' ? '#2563eb' : 'transparent',
                  color: mapMode === 'satellite' ? '#fff' : '#4b5563',
                  transition: 'all 0.15s'
                }}
              >
                🛰️ Satelit
              </button>
              <button
                type="button"
                onClick={() => setMapMode('osm')}
                style={{
                  padding: '4px 8px', fontSize: 11, fontWeight: 700, borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: mapMode === 'osm' ? '#2563eb' : 'transparent',
                  color: mapMode === 'osm' ? '#fff' : '#4b5563',
                  transition: 'all 0.15s'
                }}
              >
                🗺️ Standar
              </button>
            </div>

            <div style={{ height: '100%', width: '100%', position: 'relative', borderRadius: '8px', overflow: 'hidden' }}>
              <MapContainer
                center={center}
                zoom={16}
                style={{ width: '100%', height: '100%', zIndex: 0 }}
              >
                {mapMode === 'satellite' ? (
                  <TileLayer
                    key="satellite"
                    url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                    attribution="&copy; Google Maps"
                    maxZoom={20}
                  />
                ) : (
                  <TileLayer
                    key="osm"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution="&copy; OpenStreetMap"
                  />
                )}
                <MapClickHandler onPick={onMapClick} />

                {/* Marker biru: lokasi pelanggan */}
                {form.latitude && form.longitude && (
                  <Marker
                    position={[parseFloat(form.latitude), parseFloat(form.longitude)]}
                    icon={blueIcon}
                  >
                    <Popup>
                      <div style={{ padding: '4px', color: '#1e293b' }}>
                        <strong>{form.customer || 'Lokasi Pelanggan'}</strong>
                      </div>
                    </Popup>
                  </Marker>
                )}

                {/* Marker hitam: referensi ODP */}
                {odps.filter(o => o.latitude).map(odp => (
                  <Marker
                    key={`odp-${odp.id}`}
                    position={[parseFloat(odp.latitude), parseFloat(odp.longitude)]}
                    icon={blackIcon}
                  >
                    <Popup>
                      <div style={{ padding: '4px', color: '#1e293b' }}>
                        <strong>{odp.name}</strong><br />
                        <span style={{ fontSize: '12px' }}>Titik ODP Referensi</span>
                      </div>
                    </Popup>
                  </Marker>
                ))}

              </MapContainer>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
