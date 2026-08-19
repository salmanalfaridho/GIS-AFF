import { useEffect, useState, useCallback } from 'react';
import { Onu, Odp, OnuForm, FilterMode, OnuTable, OnuModal } from './components';
import styles from './onu.module.css';

const ONU_URL = '/api/onu';
const ODP_URL = '/api/odp';

export default function OnuPage() {
  const [onus, setOnus] = useState<Onu[]>([]);
  const [odps, setOdps] = useState<Odp[]>([]);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [selectedOnu, setSelectedOnu] = useState<Onu | null>(null);
  const [form, setForm] = useState<OnuForm>({ customer: '', latitude: '', longitude: '', odp_id: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // ── Fetch ──────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    const opts = { credentials: 'include' as RequestCredentials };
    const [onuRes, odpRes] = await Promise.all([fetch(ONU_URL, opts), fetch(ODP_URL, opts)]);
    const onuData = await onuRes.json();
    const odpData = await odpRes.json();
    const rawOnus = Array.isArray(onuData) ? onuData : (onuData.result || []);
    const rawOdps = Array.isArray(odpData) ? odpData : (odpData.result || []);

    let latest = 0;
    rawOnus.forEach((o: any) => {
      if (o.updated_at) {
        const t = new Date(o.updated_at).getTime();
        if (t > latest) latest = t;
      }
    });
    setLastUpdated(latest > 0 ? new Date(latest) : new Date());

    setOnus(rawOnus);
    setOdps(rawOdps);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);


  useEffect(() => {
    document.title = "ONU | AFF DATA SOLUSI";
  }, []);


  // ── Handlers ───────────────────────────────────────────────
  const openEdit = (onu: Onu) => {
    setSelectedOnu(onu);
    setForm({
      customer: onu.customer || '',
      latitude: onu.latitude || '',
      longitude: onu.longitude || '',
      odp_id: onu.odp_id ? onu.odp_id.toString() : '',
      port_number: onu.port_number ? onu.port_number.toString() : '',
    });
  };

  const closeModal = () => { setSelectedOnu(null); };

  // ── Import dari MikroTik ───────────────────────────────────
  const handleMikrotikImport = async () => {
    setIsImporting(true);
    setImportMsg(null);
    try {
      const res = await fetch('/api/mikrotik-import', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        setImportMsg(`✅ Berhasil: ${data.created} ONU baru, ${data.updated} diperbarui`);
        await refresh();
      } else {
        setImportMsg(`❌ Gagal: ${data.error || data.detail || 'Terjadi kesalahan'}`);
      }
    } catch (e) {
      setImportMsg('❌ Tidak dapat menghubungi server');
    } finally {
      setIsImporting(false);
      setTimeout(() => setImportMsg(null), 5000);
    }
  };

  const handleOdpChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    const odp = odps.find(o => o.id.toString() === id);
    setForm(f => odp
      ? { ...f, odp_id: id, latitude: odp.latitude, longitude: odp.longitude, port_number: f.odp_id === id ? f.port_number : '' }
      : { ...f, odp_id: '', port_number: '' }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOnu) return;
    setIsLoading(true);
    const payload = {
      ...form,
      odp_id: form.odp_id ? parseInt(form.odp_id) : null,
      port_number: form.port_number ? parseInt(form.port_number) : null,
    };
    const res = await fetch(`${ONU_URL}/${selectedOnu.mac_address}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) { await refresh(); closeModal(); }
    setIsLoading(false);
  };

  // ── Filtered list ──────────────────────────────────────────
  const filtered = onus.filter(onu => {
    const has = !!onu.latitude && !!onu.longitude;
    if (filterMode === 'complete') return has;
    if (filterMode === 'incomplete') return !has;
    return true;
  });

  // ── Derived stats ──────────────────────────────────────────
  const completeCount = onus.filter(o => o.latitude && o.longitude).length;
  const incompleteCount = onus.length - completeCount;

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}>🗄️</div>
          <div>
            <div className={styles.headerTitle}>Manajemen ONU</div>
            <div className={styles.headerSub}>
              Optical Network Unit — Kelola data dan lokasi perangkat pelanggan
              {lastUpdated && (
                <span style={{ marginLeft: 12, display: 'inline-flex', alignItems: 'center', gap: 4, background: '#f0fdf4', color: '#16a34a', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, border: '1px solid #bbf7d0' }}>
                  <span>🔄</span> {lastUpdated.toLocaleTimeString('id-ID')}
                </span>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={async () => {
                setIsImporting(true);
                setImportMsg('');
                try {
                  const token = localStorage.getItem('auth_token') || '';
                  const res = await fetch('/api/hioso-sync', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { Authorization: `Bearer ${token}` }
                  });
                  const data = await res.json();
                  if (res.ok) {
                    setImportMsg(`✅ ${data.message || 'Sync Redaman OLT HIOSO Selesai'} (${data.updated || 0} ONU diupdate)`);
                    await refresh();
                  } else {
                    setImportMsg(`⚠️ ${data.error || 'Gagal terhubung ke OLT HIOSO'}`);
                  }
                } catch (err: any) {
                  setImportMsg(`⚠️ Error: ${err.message}`);
                } finally {
                  setIsImporting(false);
                }
              }}
              disabled={isImporting}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: '#fff', border: 'none', borderRadius: 10, padding: '9px 16px',
                fontWeight: 700, fontSize: 12, cursor: isImporting ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)', transition: 'all 0.2s',
              }}
              title="Tarik Redaman Sinyal Asli dari Remote OLT HIOSO HA7302CST (fahrizal.ddns.net:9595)"
            >
              <span>📡</span> Sync Redaman OLT HIOSO
            </button>

            <button
              onClick={handleMikrotikImport}
              disabled={isImporting}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: isImporting ? '#94a3b8' : 'linear-gradient(135deg, #0ea5e9, #2563eb)',
                color: '#fff', border: 'none', borderRadius: 10, padding: '9px 16px',
                fontWeight: 700, fontSize: 12, cursor: isImporting ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 8px rgba(37,99,235,0.25)', transition: 'all 0.2s',
              }}
            >
              <span>{isImporting ? '⏳' : '📡'}</span>
              {isImporting ? 'Mengambil data...' : 'Import dari MikroTik'}
            </button>
          </div>
          {importMsg && (
            <div style={{
              fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 8,
              background: importMsg.startsWith('✅') ? '#f0fdf4' : '#fff1f2',
              color: importMsg.startsWith('✅') ? '#16a34a' : '#dc2626',
              border: `1px solid ${importMsg.startsWith('✅') ? '#bbf7d0' : '#fecaca'}`,
            }}>
              {importMsg}
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total ONU</div>
          <div className={styles.statValue}>{onus.length}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Lokasi Lengkap</div>
          <div className={`${styles.statValue} ${styles.green}`}>{completeCount}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Belum Diatur</div>
          <div className={`${styles.statValue} ${styles.red}`}>{incompleteCount}</div>
        </div>
      </div>

      {/* Table + Filter */}
      <OnuTable
        onus={filtered}
        odps={odps}
        filterMode={filterMode}
        onFilterChange={setFilterMode}
        totalCount={onus.length}
        onEdit={openEdit}
      />

      {/* Modal Edit */}
      {selectedOnu && (
        <OnuModal
          onu={selectedOnu}
          form={form}
          setForm={setForm}
          odps={odps}
          isLoading={isLoading}
          onClose={closeModal}
          onSubmit={handleSubmit}
          onMapClick={(lat, lng) => setForm(f => ({ ...f, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }))}
          onOdpChange={handleOdpChange}
        />
      )}
    </div>
  );
}