import { useEffect, useState, useCallback } from 'react';
import { Odp, OdpForm, OdpTable, OdpModal, DeleteConfirmModal } from './components';
import { OdpPortGridModal, OnuData } from '@/components/OdpPortGridModal';
import styles from './odp.module.css';

const BASE_URL = '/api/odp';
const ONU_URL = '/api/onu';
const EMPTY: OdpForm = { name: '', type: 'ODP', latitude: '', longitude: '', total_port: 8, odc_id: null };

export default function OdpPage() {
  const [odps, setOdps] = useState<Odp[]>([]);
  const [onus, setOnus] = useState<OnuData[]>([]);
  const [form, setForm] = useState<OdpForm>(EMPTY);
  const [editId, setEditId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [filterType, setFilterType] = useState<'ALL' | 'ODP' | 'ODC'>('ALL');

  // Modal Port Grid State
  const [portGridOdp, setPortGridOdp] = useState<Odp | null>(null);

  useEffect(() => {
    document.title = "ODC & ODP | AFF DATA SOLUSI";
  }, []);

  const refresh = useCallback(async () => {
    const opts = { credentials: 'include' as RequestCredentials };
    const [odpRes, onuRes] = await Promise.all([
      fetch(BASE_URL, opts).then(r => r.json()),
      fetch(ONU_URL, opts).then(r => r.json()),
    ]);
    setOdps(Array.isArray(odpRes) ? odpRes : []);
    setOnus(Array.isArray(onuRes) ? onuRes : []);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const url = editId ? `${BASE_URL}/${editId}` : BASE_URL;
    const method = editId ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method, credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      closeModal();
      await refresh();
    }
    setIsLoading(false);
  };

  const confirmDelete = async () => {
    if (deleteConfirmId === null) return;
    await fetch(`${BASE_URL}/${deleteConfirmId}`, { method: 'DELETE', credentials: 'include' });
    setDeleteConfirmId(null);
    await refresh();
  };

  const openCreate = () => { setEditId(null); setForm(EMPTY); setIsModalOpen(true); };
  const openEdit = (odp: Odp) => {
    setEditId(odp.id);
    setForm({ name: odp.name, type: odp.type, latitude: odp.latitude, longitude: odp.longitude, total_port: odp.total_port, odc_id: odp.odc_id ?? null });
    setIsModalOpen(true);
  };
  const closeModal = () => { setIsModalOpen(false); setEditId(null); setForm(EMPTY); };

  // ── Handlers for Port Grid Assignment ─────────────────────
  const handleAssignPort = async (macAddress: string, odpId: number, portNumber: number) => {
    const targetOnu = onus.find(o => o.mac_address === macAddress);
    if (!targetOnu) return;

    const token = localStorage.getItem('auth_token') || '';
    const res = await fetch(`${ONU_URL}/${macAddress}`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        customer: targetOnu.customer || '',
        latitude: targetOnu.latitude || '',
        longitude: targetOnu.longitude || '',
        odp_id: odpId,
        port_number: portNumber,
      }),
    });

    if (res.ok) {
      await refresh();
    } else {
      throw new Error('Gagal update port ONU');
    }
  };

  const handleUnassignPort = async (macAddress: string) => {
    const targetOnu = onus.find(o => o.mac_address === macAddress);
    if (!targetOnu) return;

    const token = localStorage.getItem('auth_token') || '';
    const res = await fetch(`${ONU_URL}/${macAddress}`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        customer: targetOnu.customer || '',
        latitude: targetOnu.latitude || '',
        longitude: targetOnu.longitude || '',
        odp_id: targetOnu.odp_id || null,
        port_number: null,
      }),
    });

    if (res.ok) {
      await refresh();
    }
  };

  // ── Handlers for ODC -> ODP Port Assignment ──────────────
  const handleAssignOdcPort = async (childOdpId: number, odcId: number, portNumber: number) => {
    const targetOdp = odps.find(o => o.id === childOdpId);
    if (!targetOdp) return;

    const token = localStorage.getItem('auth_token') || '';
    const res = await fetch(`${BASE_URL}/${childOdpId}`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: targetOdp.name,
        type: targetOdp.type,
        latitude: targetOdp.latitude,
        longitude: targetOdp.longitude,
        total_port: targetOdp.total_port,
        odc_id: odcId,
        port_number: portNumber,
      }),
    });

    if (res.ok) {
      await refresh();
    } else {
      throw new Error('Gagal update port ODC untuk ODP');
    }
  };

  const handleUnassignOdcPort = async (childOdpId: number) => {
    const targetOdp = odps.find(o => o.id === childOdpId);
    if (!targetOdp) return;

    const token = localStorage.getItem('auth_token') || '';
    const res = await fetch(`${BASE_URL}/${childOdpId}`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: targetOdp.name,
        type: targetOdp.type,
        latitude: targetOdp.latitude,
        longitude: targetOdp.longitude,
        total_port: targetOdp.total_port,
        odc_id: null,
        port_number: null,
      }),
    });

    if (res.ok) {
      await refresh();
    }
  };

  // ── Derived stats ──────────────────────────────────────────
  const odpList = odps.filter(o => o.type === 'ODP');
  const odcList = odps.filter(o => o.type === 'ODC');

  const totalOdp = odpList.length;
  const totalOdc = odcList.length;

  const totalAvailable = odps.reduce((acc, o) => {
    const used = o.type === 'ODC'
      ? odps.filter(c => c.odc_id === o.id).length
      : (o.onus?.length || 0);
    return acc + Math.max(0, o.total_port - used);
  }, 0);

  const fullCount = odps.filter(o => {
    const used = o.type === 'ODC'
      ? odps.filter(c => c.odc_id === o.id).length
      : (o.onus?.length || 0);
    return used >= o.total_port;
  }).length;

  const totalPorts = odps.reduce((s, o) => s + o.total_port, 0);
  const usedPorts = totalPorts - totalAvailable;
  const usagePct = totalPorts > 0 ? Math.round((usedPorts / totalPorts) * 100) : 0;

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}>📡</div>
          <div>
            <div className={styles.headerTitle}>Manajemen ODP & ODC</div>
            <div className={styles.headerSub}>Kelola titik distribusi jaringan fiber & denah port interaktif</div>
          </div>
        </div>
        <button className={styles.addBtn} onClick={openCreate}>
          <span>+</span> Tambah Perangkat
        </button>
      </div>

      {/* Stats */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total ODP / ODC</div>
          <div className={styles.statValue}>{odps.length}</div>
          <div className={styles.statSub}>
            <span style={{ color: 'var(--green)', fontWeight: 600 }}>🔌 {totalOdp} ODP</span>
            <span style={{ color: '#94a3b8' }}> · </span>
            <span style={{ color: 'var(--blue)', fontWeight: 600 }}>🗄️ {totalOdc} ODC</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statLabel}>Port Tersedia</div>
          <div className={`${styles.statValue} ${styles.green}`}>{totalAvailable}</div>
          <div className={styles.statSub}>Dari total {totalPorts} port</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statLabel}>Kapasitas Penuh</div>
          <div className={`${styles.statValue} ${fullCount > 0 ? styles.red : styles.green}`}>{fullCount}</div>
          <div className={styles.statSub}>{fullCount > 0 ? 'Perlu penambahan port/ODP' : 'Semua aman'}</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statLabel}>Penggunaan Port</div>
          <div className={styles.statValue}>{usagePct}%</div>
          <div className={styles.miniProgressWrap}>
            <div className={styles.miniProgressBar} style={{ width: `${usagePct}%` }} />
          </div>
        </div>
      </div>

      {/* Table */}
      <OdpTable
        odps={odps}
        filterType={filterType}
        onFilterType={setFilterType}
        onEdit={openEdit}
        onDelete={id => setDeleteConfirmId(id)}
        onOpenPortGrid={odp => setPortGridOdp(odp)}
      />

      {/* Odp Modal */}
      {isModalOpen && (
        <OdpModal
          form={form}
          setForm={setForm}
          editId={editId}
          existingOdps={odps}
          isLoading={isLoading}
          onClose={closeModal}
          onSubmit={handleSubmit}
          onMapClick={(lat, lng) => setForm(f => ({ ...f, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }))}
        />
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirmId !== null && (
        <DeleteConfirmModal
          onCancel={() => setDeleteConfirmId(null)}
          onConfirm={confirmDelete}
        />
      )}

      {/* Interactive Port Grid Modal */}
      {portGridOdp && (
        <OdpPortGridModal
          odp={portGridOdp}
          onus={onus}
          allOdps={odps}
          unassignedOnus={onus.filter(o => !o.odp_id)}
          onClose={() => setPortGridOdp(null)}
          onAssignPort={handleAssignPort}
          onUnassignPort={handleUnassignPort}
          onAssignOdcPort={handleAssignOdcPort}
          onUnassignOdcPort={handleUnassignOdcPort}
        />
      )}
    </div>
  );
}