import React, { useCallback, useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { renderToString } from 'react-dom/server';
import MarkerClusterGroup from 'react-leaflet-cluster';

import {
  Onu, Odp, Infra,
  OltIcon, MikrotikIcon, OdcIcon, OdpIcon, OnuIcon,
  SignalBars, StatusBadge, pp,
} from './Components';
import styles from './Map.module.css';

const POLL_MS = 15_000;

// ── Inject pulse keyframes once ───────────────────────────────
if (typeof window !== 'undefined') {
  const id = 'map-global-style';
  if (!document.getElementById(id)) {
    const s = document.createElement('style');
    s.id = id;
    s.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&display=swap');
      @keyframes mapPulse {
        0%   { transform:scale(1);   opacity:.9; }
        70%  { transform:scale(2.4); opacity:0;  }
        100% { transform:scale(2.4); opacity:0;  }
      }
      .custom-leaflet-icon {
        background: transparent;
        border: none;
      }
    `;
    document.head.appendChild(s);
  }
}

// ── Custom Waypoint Handle Icon for Cable Editing ─────────────
const waypointIcon = L.divIcon({
  html: `<div style="
    width: 14px;
    height: 14px;
    background: #F59E0B;
    border: 2px solid #FFFFFF;
    border-radius: 50%;
    box-shadow: 0 2px 6px rgba(0,0,0,0.4);
    cursor: move;
  "></div>`,
  className: 'custom-leaflet-icon',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

// ── Helper: parse waypoints JSON string ───────────────────────
function parseWaypoints(jsonStr?: string): [number, number][] {
  if (!jsonStr) return [];
  try {
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed) && parsed.every(p => Array.isArray(p) && p.length === 2)) {
      return parsed as [number, number][];
    }
  } catch {
    // fallback
  }
  return [];
}

// ── Helper: build polyline positions ──────────────────────────
function buildPolylinePositions(
  start: [number, number],
  end: [number, number],
  jsonPath?: string,
  currentWaypoints?: [number, number][]
): [number, number][] {
  const wps = currentWaypoints !== undefined ? currentWaypoints : parseWaypoints(jsonPath);
  return [start, ...wps, end];
}

// ── Helper: create L.divIcon from React component ─────────────
const createIcon = (comp: React.ReactElement, size: [number, number]) => {
  return L.divIcon({
    html: renderToString(comp),
    className: 'custom-leaflet-icon',
    iconSize: size,
    iconAnchor: [size[0] / 2, size[1] / 2],
    popupAnchor: [0, -size[1] / 2],
  });
};

// ── Helper: custom cluster icon ───────────────────────────────
const createCoreClusterIcon = (cluster: any) => {
  const count = cluster.getChildCount();
  return L.divIcon({
    html: renderToString(
      <div style={{
        width: 44,
        height: 44,
        background: '#1E293B',
        color: '#fff',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: 14,
        border: '3px solid #38BDF8',
        boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        position: 'relative'
      }}>
        <span style={{ position: 'absolute', top: -8, fontSize: 16 }}>🖥️</span>
        {count}
      </div>
    ),
    className: 'custom-leaflet-icon',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
};

// ── Popup card ────────────────────────────────────────────────
function InfoCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: "'Plus Jakarta Sans',sans-serif",
      background: '#fff',
      borderRadius: 12,
      minWidth: 200,
      position: 'relative',
    }}>
      {children}
    </div>
  );
}

// ── Map Controller for FlyTo ──────────────────────────────────
function MapController({ center }: { center: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, 18, { duration: 1.5 });
    }
  }, [center, map]);
  return null;
}

// ── Map Click Listener for Adding Cable Waypoints ─────────────
function MapClickListener({
  isEditing,
  onMapClick,
}: {
  isEditing: boolean;
  onMapClick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      if (isEditing) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

type TileType = 'osm' | 'satellite' | 'dark';

export interface EditTarget {
  type: 'onu' | 'odp';
  id: number;
  mac_address?: string;
  name: string;
  waypoints: [number, number][];
}

import { OdpPortGridModal, OnuData } from '@/components/OdpPortGridModal';

export default function MapView() {
  const [isMounted, setIsMounted]     = useState(false);
  const [isLoading, setIsLoading]     = useState(true);
  const [isSaving, setIsSaving]       = useState(false);
  const [onus,   setOnus]             = useState<Onu[]>([]);
  const [infras, setInfras]           = useState<Infra[]>([]);
  const [odps,   setOdps]             = useState<Odp[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [onuFilter, setOnuFilter]     = useState<'all' | 'ok' | 'warning' | 'critical' | 'disconnected'>('all');
  const [isFilterOpen, setIsFilterOpen] = useState(true);
  const [isLayerControlOpen, setIsLayerControlOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [mapCenter, setMapCenter]     = useState<[number, number] | null>(null);

  // Modal Port Grid State
  const [portGridOdp, setPortGridOdp] = useState<Odp | null>(null);

  // Cable Editing State
  const [editingTarget, setEditingTarget] = useState<EditTarget | null>(null);

  // Map Tile & Layer Visibility States
  const [tileLayer, setTileLayer] = useState<TileType>('osm');
  const [showBackbone, setShowBackbone]         = useState(true);
  const [showTrunk, setShowTrunk]               = useState(true);
  const [showDistribution, setShowDistribution] = useState(true);
  const [showDropLines, setShowDropLines]       = useState(true);
  const [showOnuMarkers, setShowOnuMarkers]     = useState(true);
  const [showOdpMarkers, setShowOdpMarkers]     = useState(true);
  const [showOdcMarkers, setShowOdcMarkers]     = useState(true);

  useEffect(() => { 
    setIsMounted(true);
    document.title = "Peta Topologi | AFF DATA SOLUSI";
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      const opts = { credentials: 'include' as RequestCredentials };
      const [onuData, infraData, odpData] = await Promise.all([
        fetch('/api/onu',          opts).then(r => r.json()),
        fetch('/api/zabbix-infra', opts).then(r => r.ok ? r.json() : { result: [] }).catch(() => ({ result: [] })),
        fetch('/api/odp',          opts).then(r => r.json()),
      ]);

      const allOnus   = Array.isArray(onuData)   ? onuData   : (onuData.result   || []);
      const allInfras = Array.isArray(infraData)  ? infraData : (infraData.result || []);
      const allOdps   = Array.isArray(odpData)    ? odpData   : (odpData.result   || []);

      setOnus  (allOnus  .filter((o: Onu)   => o.latitude && o.longitude));
      setInfras(allInfras.filter((i: Infra) => i.inventory?.location_lat && i.inventory?.location_lon));
      setOdps  (allOdps  .filter((o: Odp)   => o.latitude && o.longitude));
      
      let latest = 0;
      allOnus.forEach((o: any) => {
        if (o.updated_at) {
          const t = new Date(o.updated_at).getTime();
          if (t > latest) latest = t;
        }
      });
      setLastUpdated(latest > 0 ? new Date(latest) : new Date());
    } catch (e) {
      console.error('Fetch error:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    fetchAll();
    const t = setInterval(fetchAll, POLL_MS);
    return () => clearInterval(t);
  }, [fetchAll, isMounted]);

  const mikrotik  = infras.find(i => i.name.toLowerCase().includes('mikrotik'));
  const olt       = infras.find(i => i.name.toLowerCase().includes('olt'));
  const isOltDown = olt?.interfaces?.some(i => i.available === '2')      || false;
  const isMikDown = mikrotik?.interfaces?.some(i => i.available === '2') || false;
  const coreDown  = isOltDown || isMikDown;

  // Handler: Start Editing Cable Path for ONU
  const handleStartEditOnuCable = (onu: Onu) => {
    const parentOdp = odps.find(o => o.id === onu.odp_id);
    const existingWps = parseWaypoints(onu.path_geometry);
    setEditingTarget({
      type: 'onu',
      id: onu.id,
      mac_address: onu.mac_address,
      name: `Kabel Drop ONU: ${onu.customer || onu.mac_address} (dari ${parentOdp?.name || 'ODP'})`,
      waypoints: existingWps,
    });
  };

  // Handler: Start Editing Cable Path for ODP (ODC->ODP)
  const handleStartEditOdpCable = (odp: Odp) => {
    const parentOdc = odps.find(o => o.id === odp.odc_id);
    const existingWps = parseWaypoints(odp.path_geometry);
    setEditingTarget({
      type: 'odp',
      id: odp.id,
      name: `Kabel Distribusi: ${parentOdc?.name || 'ODC'} ➔ ${odp.name}`,
      waypoints: existingWps,
    });
  };

  // Handler: Map Clicked while Editing -> Add Waypoint
  const handleAddWaypoint = (lat: number, lng: number) => {
    if (!editingTarget) return;
    const newWps: [number, number][] = [...editingTarget.waypoints, [parseFloat(lat.toFixed(6)), parseFloat(lng.toFixed(6))]];
    setEditingTarget({ ...editingTarget, waypoints: newWps });
  };

  // Handler: Drag Waypoint Marker -> Update Waypoint Position
  const handleDragWaypoint = (idx: number, newLat: number, newLng: number) => {
    if (!editingTarget) return;
    const updated = [...editingTarget.waypoints];
    updated[idx] = [parseFloat(newLat.toFixed(6)), parseFloat(newLng.toFixed(6))];
    setEditingTarget({ ...editingTarget, waypoints: updated });
  };

  // Handler: Delete Last Waypoint
  const handleDeleteLastWaypoint = () => {
    if (!editingTarget || editingTarget.waypoints.length === 0) return;
    setEditingTarget({ ...editingTarget, waypoints: editingTarget.waypoints.slice(0, -1) });
  };

  // Handler: Reset Waypoints
  const handleResetWaypoints = () => {
    if (!editingTarget) return;
    setEditingTarget({ ...editingTarget, waypoints: [] });
  };

  // Handler: Save Cable Path to Backend DB
  const handleSaveCablePath = async () => {
    if (!editingTarget) return;
    setIsSaving(true);
    const jsonPath = JSON.stringify(editingTarget.waypoints);

    try {
      const token = localStorage.getItem('auth_token') || '';
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };

      if (editingTarget.type === 'onu' && editingTarget.mac_address) {
        const onu = onus.find(o => o.id === editingTarget.id);
        const res = await fetch(`/api/onu/${editingTarget.mac_address}`, {
          method: 'PUT',
          headers,
          credentials: 'include',
          body: JSON.stringify({
            customer: onu?.customer || '',
            latitude: onu?.latitude || '',
            longitude: onu?.longitude || '',
            odp_id: onu?.odp_id || null,
            path_geometry: jsonPath,
          }),
        });
        if (res.ok) {
          await fetchAll();
          setEditingTarget(null);
        } else {
          alert('Gagal menyimpan jalur kabel ONU');
        }
      } else if (editingTarget.type === 'odp') {
        const odp = odps.find(o => o.id === editingTarget.id);
        if (odp) {
          const res = await fetch(`/api/odp/${odp.id}`, {
            method: 'PUT',
            headers,
            credentials: 'include',
            body: JSON.stringify({
              name: odp.name,
              type: odp.type,
              latitude: odp.latitude,
              longitude: odp.longitude,
              total_port: odp.total_port,
              odc_id: odp.odc_id,
              path_geometry: jsonPath,
            }),
          });
          if (res.ok) {
            await fetchAll();
            setEditingTarget(null);
          } else {
            alert('Gagal menyimpan jalur kabel ODP');
          }
        }
      }
    } catch {
      alert('Terjadi kesalahan saat menyimpan jalur kabel');
    } finally {
      setIsSaving(false);
    }
  };

  // Search autocomplete logic
  useEffect(() => {
    if (!searchQuery || mapCenter !== null) {
      if (!searchQuery) setSearchResults([]);
      return;
    }
    const sq = searchQuery.toLowerCase();
    const results: any[] = [];

    infras.forEach(i => {
      if (i.name.toLowerCase().includes(sq)) {
        results.push({ id: `infra-${i.hostid}`, name: i.name, type: 'Infra', lat: parseFloat(i.inventory.location_lat), lon: parseFloat(i.inventory.location_lon) });
      }
    });
    odps.forEach(o => {
      if (o.name.toLowerCase().includes(sq)) {
        results.push({ id: `odp-${o.id}`, name: o.name, type: o.type, lat: parseFloat(o.latitude), lon: parseFloat(o.longitude) });
      }
    });
    onus.forEach(o => {
      const matchCust = o.customer?.toLowerCase().includes(sq);
      const matchMac  = o.mac_address?.toLowerCase().includes(sq);
      if (matchCust || matchMac) {
        results.push({ id: `onu-${o.id}`, name: o.customer || o.mac_address, type: 'ONU', lat: parseFloat(o.latitude), lon: parseFloat(o.longitude) });
      }
    });
    setSearchResults(results.slice(0, 8));
  }, [searchQuery, infras, odps, onus, mapCenter]);

  const handleSelectResult = (r: any) => {
    setSearchQuery(r.name);
    setSearchResults([]);
    setMapCenter([r.lat, r.lon]);
    setOnuFilter('all');
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setMapCenter(null);
    setOnuFilter('all');
  };

  if (!isMounted) return null;

  const tileUrls = {
    osm: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  };

  const tileAttributions = {
    osm: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    satellite: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    dark: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  };

  return (
    <div className={styles.mapWrap} style={{ position: 'relative' }}>

      {/* ── Overlay Left: Timestamp, Search, Filters ───────────── */}
      <div style={{
        position: 'absolute', top: 15, left: 60, zIndex: 1000,
        display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start'
      }}>
        {/* Last updated */}
        <div style={{
          background: 'rgba(255,255,255,0.95)', padding: '8px 14px', borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)', fontSize: 12, fontWeight: 600,
          fontFamily: "'Plus Jakarta Sans',sans-serif", color: '#4b5563',
          border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 6,
          backdropFilter: 'blur(4px)'
        }}>
          <span style={{ fontSize: 14 }}>🔄</span>
          <span>Terakhir diperbarui: {lastUpdated ? lastUpdated.toLocaleTimeString('id-ID') : '...'}</span>
        </div>

        {/* Search Box */}
        <div style={{ position: 'relative', width: '250px' }}>
          <div style={{
            background: 'rgba(255,255,255,0.95)', padding: '10px 12px', borderRadius: 10,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)', border: '1px solid #e5e7eb',
            fontFamily: "'Plus Jakarta Sans',sans-serif", display: 'flex', flexDirection: 'column', gap: 8,
            backdropFilter: 'blur(4px)'
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Cari Perangkat / Pelanggan
            </div>
            <input
              type="text"
              placeholder="Cari nama, MAC, ODP..."
              value={searchQuery}
              onChange={handleSearchChange}
              style={{
                padding: '6px 10px', fontSize: 12, borderRadius: 6, border: '1px solid #d1d5db',
                width: '100%', boxSizing: 'border-box', outline: 'none'
              }}
            />
          </div>

          {searchResults.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
              background: '#fff', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              border: '1px solid #e5e7eb', overflow: 'hidden', zIndex: 2000,
              fontFamily: "'Plus Jakarta Sans',sans-serif", maxHeight: '300px', overflowY: 'auto'
            }}>
              {searchResults.map(r => (
                <div 
                  key={r.id} 
                  onClick={() => handleSelectResult(r)}
                  style={{
                    padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6',
                    display: 'flex', flexDirection: 'column', gap: 2
                  }}
                  onMouseOver={e => e.currentTarget.style.background = '#f9fafb'}
                  onMouseOut={e => e.currentTarget.style.background = '#fff'}
                >
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{r.name}</span>
                  <span style={{ fontSize: 10, color: '#6b7280' }}>Tipe: {r.type}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ONU Filter */}
        <div style={{
          background: 'rgba(255,255,255,0.95)', padding: '10px 12px', borderRadius: 10,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)', border: '1px solid #e5e7eb',
          fontFamily: "'Plus Jakarta Sans',sans-serif", display: 'flex', flexDirection: 'column', gap: 8,
          backdropFilter: 'blur(4px)', transition: 'all 0.3s ease',
          minWidth: '200px'
        }}>
          <div 
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            style={{ 
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
              cursor: 'pointer', padding: '0 4px'
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Filter Kondisi ONU
            </div>
            <div style={{ color: '#9ca3af', fontSize: 16, lineHeight: 1 }}>
              {isFilterOpen ? '▾' : '▸'}
            </div>
          </div>
          
          {isFilterOpen && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-start', marginTop: 4 }}>
              {(['all', 'ok', 'warning', 'critical', 'disconnected'] as const).map(f => {
                const labels = { all: 'Semua', ok: 'Aman', warning: 'Warning', critical: 'Kritis', disconnected: 'Terputus' };
                const colors = { all: '#4b5563', ok: '#16a34a', warning: '#d97706', critical: '#ef4444', disconnected: '#b91c1c' };
                const bgColors = { all: '#f3f4f6', ok: '#f0fdf4', warning: '#fffbeb', critical: '#fef2f2', disconnected: '#fee2e2' };
                const active = onuFilter === f;
                return (
                  <button
                    key={f}
                    onClick={() => setOnuFilter(f)}
                    style={{
                      padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: 'pointer',
                      background: active ? colors[f] : bgColors[f],
                      color: active ? 'white' : colors[f],
                      border: `1px solid ${active ? colors[f] : '#e5e7eb'}`, transition: 'all 0.15s ease',
                    }}
                  >
                    {labels[f]}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Overlay Right: Topology Summary & Layer Controls ───── */}
      <div style={{
        position: 'absolute', top: 15, right: 15, zIndex: 1000,
        display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end'
      }}>
        {/* Network Stats Widget (Tanpa Total Kabel Fiber) */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.9)', color: '#f8fafc', padding: '12px 16px', borderRadius: 12,
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
          fontFamily: "'Plus Jakarta Sans',sans-serif", backdropFilter: 'blur(8px)',
          minWidth: 220, display: 'flex', flexDirection: 'column', gap: 8
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🌐</span> Ringkasan Topologi GIS
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 12 }}>
            <div>
              <div style={{ color: '#94a3b8', fontSize: 10 }}>ONU Mapped</div>
              <div style={{ fontWeight: 700, color: '#38bdf8', fontSize: 14 }}>{onus.length}</div>
            </div>
            <div>
              <div style={{ color: '#94a3b8', fontSize: 10 }}>Total ODP</div>
              <div style={{ fontWeight: 700, color: '#a7f3d0', fontSize: 14 }}>{odps.filter(o => o.type === 'ODP').length}</div>
            </div>
            <div>
              <div style={{ color: '#94a3b8', fontSize: 10 }}>Total ODC</div>
              <div style={{ fontWeight: 700, color: '#c084fc', fontSize: 14 }}>{odps.filter(o => o.type === 'ODC').length}</div>
            </div>
          </div>
        </div>

        {/* Tile & Layer Control Toggle Panel */}
        <div style={{
          background: 'rgba(255,255,255,0.95)', padding: '10px 14px', borderRadius: 12,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)', border: '1px solid #e5e7eb',
          fontFamily: "'Plus Jakarta Sans',sans-serif", backdropFilter: 'blur(4px)',
          width: 220
        }}>
          <div 
            onClick={() => setIsLayerControlOpen(!isLayerControlOpen)}
            style={{ 
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
              cursor: 'pointer'
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>🗺️</span> Peta & Layer Switcher
            </div>
            <div style={{ color: '#9ca3af', fontSize: 16 }}>
              {isLayerControlOpen ? '▾' : '▸'}
            </div>
          </div>

          {isLayerControlOpen && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Tile Selector */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', marginBottom: 4 }}>TIPE PETA:</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['osm', 'satellite', 'dark'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setTileLayer(t)}
                      style={{
                        flex: 1, padding: '4px 6px', fontSize: 10, fontWeight: 600, borderRadius: 6,
                        cursor: 'pointer', border: '1px solid #d1d5db',
                        background: tileLayer === t ? '#2563eb' : '#f9fafb',
                        color: tileLayer === t ? '#fff' : '#374151',
                        transition: 'all 0.15s'
                      }}
                    >
                      {t === 'osm' ? 'Standar' : t === 'satellite' ? 'Satelit' : 'Dark'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Layer Checkboxes */}
              <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280' }}>LAYER JARINGAN:</div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: '#374151' }}>
                  <input type="checkbox" checked={showBackbone} onChange={e => setShowBackbone(e.target.checked)} />
                  <span>Kabel Backbone (Core)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: '#374151' }}>
                  <input type="checkbox" checked={showTrunk} onChange={e => setShowTrunk(e.target.checked)} />
                  <span>Kabel Trunk (OLT-ODC)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: '#374151' }}>
                  <input type="checkbox" checked={showDistribution} onChange={e => setShowDistribution(e.target.checked)} />
                  <span style={{ display: 'inline-block', width: 14, height: 4, background: '#0284c7', borderRadius: 2 }}></span>
                  <span>Kabel Distribusi (ODC-ODP)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: '#374151' }}>
                  <input type="checkbox" checked={showDropLines} onChange={e => setShowDropLines(e.target.checked)} />
                  <span style={{ display: 'inline-block', width: 14, height: 2, borderTop: '2px dashed #16a34a' }}></span>
                  <span>Kabel Drop (ODP-Pelanggan)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: '#374151' }}>
                  <input type="checkbox" checked={showOdcMarkers} onChange={e => setShowOdcMarkers(e.target.checked)} />
                  <span>Marker ODC</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: '#374151' }}>
                  <input type="checkbox" checked={showOdpMarkers} onChange={e => setShowOdpMarkers(e.target.checked)} />
                  <span>Marker ODP</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: '#374151' }}>
                  <input type="checkbox" checked={showOnuMarkers} onChange={e => setShowOnuMarkers(e.target.checked)} />
                  <span>Marker ONU</span>
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Overlay Bottom Center: Active Cable Route Editing Toolbar ──────── */}
      {editingTarget && (
        <div style={{
          position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 3000,
          background: 'rgba(15, 23, 42, 0.95)', color: '#f8fafc', padding: '12px 20px', borderRadius: 16,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)', border: '1px solid #38bdf8',
          fontFamily: "'Plus Jakarta Sans',sans-serif", backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>✏️</span> Mode Edit Belokan Kabel
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>
              {editingTarget.name} ({editingTarget.waypoints.length} belokan)
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: '#e2e8f0', background: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: 8 }}>
              💡 Klik pada peta untuk membuat titik belokan jalan
            </span>
            {editingTarget.waypoints.length > 0 && (
              <button
                onClick={handleDeleteLastWaypoint}
                style={{
                  background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.4)',
                  padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer'
                }}
              >
                🗑️ Hapus Belokan Terakhir
              </button>
            )}
            {editingTarget.waypoints.length > 0 && (
              <button
                onClick={handleResetWaypoints}
                style={{
                  background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)',
                  padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer'
                }}
              >
                ↺ Luruskan (Reset)
              </button>
            )}
            <button
              onClick={handleSaveCablePath}
              disabled={isSaving}
              style={{
                background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', border: 'none',
                padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: isSaving ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
              }}
            >
              {isSaving ? '💾 Menyimpan...' : '💾 Simpan Belokan'}
            </button>
            <button
              onClick={() => setEditingTarget(null)}
              style={{
                background: 'rgba(255, 255, 255, 0.1)', color: '#cbd5e1', border: '1px solid rgba(255, 255, 255, 0.2)',
                padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer'
              }}
            >
              ✕ Batal
            </button>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {isLoading && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(255,255,255,0.7)', zIndex: 9999,
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 600, color: '#374151',
        }}>
          Memuat data jaringan...
        </div>
      )}

      <MapContainer
        center={[-7.5361, 112.4368]}
        zoom={15}
        style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 0 }}
      >
        <MapController center={mapCenter} />

        {/* Map Click Listener for adding waypoints */}
        <MapClickListener isEditing={!!editingTarget} onMapClick={handleAddWaypoint} />

        <TileLayer
          key={tileLayer}
          attribution={tileAttributions[tileLayer]}
          url={tileUrls[tileLayer]}
        />

        {/* ── Backbone: MikroTik ↔ OLT ──────────────────────── */}
        {showBackbone && mikrotik && olt && (
          <Polyline
            positions={[
              [parseFloat(mikrotik.inventory.location_lat), parseFloat(mikrotik.inventory.location_lon)],
              [parseFloat(olt.inventory.location_lat),      parseFloat(olt.inventory.location_lon)],
            ]}
            pathOptions={{
              color:     coreDown ? '#EF4444' : '#6366F1',
              weight:    4,
              opacity:   0.85,
              dashArray: '10, 8',
            }}
          />
        )}

        {/* ── Trunk: OLT → ODC ──────────────────────────────── */}
        {showTrunk && olt && odps.filter(o => o.type === 'ODC').map(odc => {
          const lat1 = parseFloat(olt.inventory.location_lat);
          const lon1 = parseFloat(olt.inventory.location_lon);
          const lat2 = parseFloat(odc.latitude);
          const lon2 = parseFloat(odc.longitude);

          return (
            <Polyline
              key={`trunk-odc-${odc.id}`}
              positions={[[lat1, lon1], [lat2, lon2]]}
              pathOptions={{ color: coreDown ? '#EF4444' : '#3B82F6', weight: 4, opacity: 0.9 }}
            />
          );
        })}

        {/* ── Distribusi: ODC → ODP (Kabel Utama Distribusi - Tebal 5px Cyan/Purple) ── */}
        {showDistribution && odps.filter(o => o.type === 'ODP' && o.odc_id).map(odp => {
          const parentOdc = odps.find(x => x.id === odp.odc_id);
          if (!parentOdc) return null;
          const start: [number, number] = [parseFloat(parentOdc.latitude), parseFloat(parentOdc.longitude)];
          const end: [number, number]   = [parseFloat(odp.latitude), parseFloat(odp.longitude)];
          const isBeingEdited = editingTarget?.type === 'odp' && editingTarget.id === odp.id;
          const positions = buildPolylinePositions(
            start,
            end,
            odp.path_geometry,
            isBeingEdited ? editingTarget.waypoints : undefined
          );

          return (
            <React.Fragment key={`dist-group-${odp.id}`}>
              <Polyline
                positions={positions}
                pathOptions={{
                  color: isBeingEdited ? '#F59E0B' : '#0284c7', // Warna Cyan/Biru Distribusi Tegas
                  weight: isBeingEdited ? 6 : 5,                // Ketebalan 5px (Kabel Distribusi Multicore)
                  opacity: 0.9,
                  dashArray: isBeingEdited ? '8,8' : undefined
                }}
                eventHandlers={{
                  click: () => !editingTarget && handleStartEditOdpCable(odp),
                }}
              >
                <Tooltip sticky permanent={false}>
                  <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 11, fontWeight: 600 }}>
                    <span style={{ color: '#0284c7', fontSize: 12 }}>🔀 <strong>[KABEL DISTRIBUSI]</strong></span><br />
                    ODC: <strong>{parentOdc.name}</strong> ➔ ODP: <strong>{odp.name}</strong><br />
                    <span style={{ color: '#0284c7', cursor: 'pointer', fontSize: 10 }}>✏️ Klik untuk edit rute belokan jalan</span>
                  </div>
                </Tooltip>
              </Polyline>

              {/* Waypoint Handle Markers when editing */}
              {isBeingEdited && editingTarget.waypoints.map((wp, idx) => (
                <Marker
                  key={`wp-odp-${odp.id}-${idx}`}
                  position={wp}
                  icon={waypointIcon}
                  draggable={true}
                  eventHandlers={{
                    dragend: (e) => {
                      const marker = e.target;
                      const pos = marker.getLatLng();
                      handleDragWaypoint(idx, pos.lat, pos.lng);
                    },
                  }}
                >
                  <Tooltip permanent direction="top" offset={[0, -8]}>
                    <span style={{ fontSize: 10, fontWeight: 700 }}>Belokan Distribusi #{idx + 1}</span>
                  </Tooltip>
                </Marker>
              ))}
            </React.Fragment>
          );
        })}

        {/* ── Drop: ODP → Pelanggan/Client (Kabel Drop Tipis 2.5px) ── */}
        {showDropLines && onus.filter(onu => {
          const rx = parseFloat(onu.rx_power);
          const isDisconnected = onu.status === "Koneksi terputus" || onu.rx_power === "N/A" || onu.rx_power === "0";
          if (onuFilter === 'disconnected') return isDisconnected;
          if (isDisconnected && onuFilter !== 'all') return false;

          const isCritical = !isDisconnected && rx <= -27;
          const isWarning  = !isDisconnected && rx > -27 && rx <= -25;
          const isOk       = !isDisconnected && rx > -25;
          
          if (onuFilter === 'ok') return isOk;
          if (onuFilter === 'warning') return isWarning;
          if (onuFilter === 'critical') return isCritical;
          return true;
        }).map(onu => {
          const parent = odps.find(o => o.id === onu.odp_id);
          if (!parent) return null;
          const start: [number, number] = [parseFloat(parent.latitude), parseFloat(parent.longitude)];
          const end: [number, number]   = [parseFloat(onu.latitude), parseFloat(onu.longitude)];
          const isBeingEdited = editingTarget?.type === 'onu' && editingTarget.id === onu.id;
          const positions = buildPolylinePositions(
            start,
            end,
            onu.path_geometry,
            isBeingEdited ? editingTarget.waypoints : undefined
          );

          const rx = parseFloat(onu.rx_power);
          const isDisconnected = onu.status === "Koneksi terputus" || onu.rx_power === "N/A" || onu.rx_power === "0";
          const color = isBeingEdited ? '#F59E0B' : isDisconnected ? '#dc2626' : rx <= -27 ? '#ef4444' : rx <= -25 ? '#f59e0b' : '#16a34a';

          return (
            <React.Fragment key={`drop-group-${onu.id}`}>
              <Polyline
                positions={positions}
                pathOptions={{
                  color,
                  weight: isBeingEdited ? 5 : 2.5,  // Kabel Drop Pelanggan Tipis (2.5px)
                  opacity: 0.85,
                  dashArray: isBeingEdited ? '6,6' : '6,4' // Dashed line khas kabel drop pelanggan
                }}
                eventHandlers={{
                  click: () => !editingTarget && handleStartEditOnuCable(onu),
                }}
              >
                <Tooltip sticky permanent={false}>
                  <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 11, fontWeight: 600 }}>
                    <span style={{ color: color, fontSize: 12 }}>🏠 <strong>[KABEL DROP PELANGGAN]</strong></span><br />
                    ODP: <strong>{parent.name}</strong> ➔ Client: <strong>{onu.customer || onu.mac_address}</strong><br />
                    <span style={{ color: '#2563eb', cursor: 'pointer', fontSize: 10 }}>✏️ Klik untuk edit rute belokan jalan</span>
                  </div>
                </Tooltip>
              </Polyline>

              {/* Waypoint Handle Markers when editing */}
              {isBeingEdited && editingTarget.waypoints.map((wp, idx) => (
                <Marker
                  key={`wp-onu-${onu.id}-${idx}`}
                  position={wp}
                  icon={waypointIcon}
                  draggable={true}
                  eventHandlers={{
                    dragend: (e) => {
                      const marker = e.target;
                      const pos = marker.getLatLng();
                      handleDragWaypoint(idx, pos.lat, pos.lng);
                    },
                  }}
                >
                  <Tooltip permanent direction="top" offset={[0, -8]}>
                    <span style={{ fontSize: 10, fontWeight: 700 }}>Belokan Drop #{idx + 1}</span>
                  </Tooltip>
                </Marker>
              ))}
            </React.Fragment>
          );
        })}

        {/* ── Marker Cluster: Core Infra (OLT & MikroTik) ──── */}
        {/* @ts-ignore */}
        <MarkerClusterGroup iconCreateFunction={createCoreClusterIcon}>
          {infras.map(infra => {
            const isDown  = infra.interfaces?.some(i => i.available === '2') || false;
            const isMikro = infra.name.toLowerCase().includes('mikrotik');
            const iconEl  = isMikro
              ? <MikrotikIcon down={isDown} />
              : <OltIcon      down={isDown} />;
            const iconSize: [number, number] = isMikro ? [38, 38] : [40, 40];

            return (
              <Marker
                key={infra.hostid}
                position={[
                  parseFloat(infra.inventory.location_lat),
                  parseFloat(infra.inventory.location_lon),
                ]}
                icon={createIcon(iconEl, iconSize)}
              >
                <Popup>
                  <InfoCard>
                    <div style={pp.head}>
                      <div style={{
                        ...pp.icon,
                        background: isDown ? '#FFF1F2' : isMikro ? '#F3E8FF' : '#DBEAFE',
                      }}>
                        {isMikro ? '🔀' : '📡'}
                      </div>
                      <div>
                        <div style={pp.name}>{infra.name}</div>
                        <div style={pp.sub}>{isMikro ? 'Router Core' : 'Optical Line Terminal'}</div>
                      </div>
                    </div>
                    <div style={pp.row}>
                      <span style={pp.lbl}>Status</span>
                      <StatusBadge ok={!isDown} />
                    </div>
                    <div style={pp.row}>
                      <span style={pp.lbl}>Tipe</span>
                      <span style={{ ...pp.val, color: isMikro ? '#7C3AED' : '#2563EB' }}>
                        {isMikro ? 'MikroTik' : 'OLT HIOSO'}
                      </span>
                    </div>
                  </InfoCard>
                </Popup>
              </Marker>
            );
          })}
        </MarkerClusterGroup>

        {/* ── Marker: ODC ───────────────────────────────────── */}
        {showOdcMarkers && odps.filter(o => o.type === 'ODC').map(odc => (
          <Marker
            key={`odc-${odc.id}`}
            position={[parseFloat(odc.latitude), parseFloat(odc.longitude)]}
            icon={createIcon(<OdcIcon full={false} />, [36, 36])} 
          >
            <Popup>
              <InfoCard>
                <div style={pp.head}>
                  <div style={{ ...pp.icon, background: '#EDE9FE' }}>🔀</div>
                  <div>
                    <div style={pp.name}>{odc.name}</div>
                    <div style={pp.sub}>Optical Distribution Cabinet</div>
                  </div>
                </div>
                <div style={pp.row}>
                  <span style={pp.lbl}>Tipe</span>
                  <span style={{ ...pp.val, color: '#6D28D9' }}>ODC Splitter</span>
                </div>
                <div style={pp.row}>
                  <span style={pp.lbl}>ODP terhubung</span>
                  <span style={pp.val}>
                    {odps.filter(o => o.type === 'ODP' && o.odc_id === odc.id).length}
                  </span>
                </div>
              </InfoCard>
            </Popup>
          </Marker>
        ))}

        {/* ── Marker: ODP ───────────────────────────────────── */}
        {showOdpMarkers && odps.filter(o => o.type === 'ODP').map(odp => {
          const terisi = onus.filter(o => o.odp_id === odp.id).length;
          const pct    = odp.total_port > 0 ? Math.round((terisi / odp.total_port) * 100) : 0;
          const level: 'ok' | 'warn' | 'full' =
            pct >= 100 ? 'full' : pct >= 75 ? 'warn' : 'ok';
          const levelColor =
            level === 'full' ? '#EF4444' : level === 'warn' ? '#EA580C' : '#16A34A';

          return (
            <Marker
              key={`odp-${odp.id}`}
              position={[parseFloat(odp.latitude), parseFloat(odp.longitude)]}
              icon={createIcon(<OdpIcon level={level} />, [32, 32])}
            >
              <Popup>
                <InfoCard>
                  <div style={pp.head}>
                    <div style={{
                      ...pp.icon,
                      background: level === 'full' ? '#FFF1F2' : level === 'warn' ? '#FFF7ED' : '#F0FDF4',
                    }}>
                      🔌
                    </div>
                    <div>
                      <div style={pp.name}>{odp.name}</div>
                      <div style={pp.sub}>Optical Distribution Point</div>
                    </div>
                  </div>
                  <div style={pp.row}>
                    <span style={pp.lbl}>Port terpakai</span>
                    <span style={{ ...pp.val, color: levelColor }}>
                      {terisi} / {odp.total_port}
                    </span>
                  </div>
                  <div style={pp.row}>
                    <span style={pp.lbl}>Kapasitas</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{
                        width: 60, height: 4, background: '#E4E7EF',
                        borderRadius: 2, overflow: 'hidden',
                      }}>
                        <div style={{
                          width: `${pct}%`, height: '100%',
                          background: levelColor, borderRadius: 2,
                        }} />
                      </div>
                      <span style={{ ...pp.val, fontSize: 11 }}>{pct}%</span>
                    </div>
                  </div>
                  <div style={pp.row}>
                    <span style={pp.lbl}>Status</span>
                    <StatusBadge
                      ok={level === 'ok'}
                      okLabel="Tersedia"
                      failLabel={level === 'full' ? 'Penuh' : 'Hampir Penuh'}
                    />
                  </div>
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #f3f4f6', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <button
                      onClick={() => setPortGridOdp(odp)}
                      style={{
                        width: '100%', padding: '6px 10px', fontSize: 11, fontWeight: 700,
                        background: '#0284c7', color: '#ffffff', border: 'none',
                        borderRadius: 6, cursor: 'pointer', boxShadow: '0 2px 6px rgba(2, 132, 199, 0.2)'
                      }}
                    >
                      🔌 Denah Port Mapping ODP
                    </button>
                    <button
                      onClick={() => handleStartEditOdpCable(odp)}
                      style={{
                        width: '100%', padding: '6px 10px', fontSize: 11, fontWeight: 600,
                        background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0',
                        borderRadius: 6, cursor: 'pointer'
                      }}
                    >
                      ✏️ Edit Belokan Kabel Distribusi
                    </button>
                  </div>
                </InfoCard>
              </Popup>
            </Marker>
          );
        })}

        {/* ── Marker: ONU ───────────────────────────────────── */}
        {showOnuMarkers && onus.filter(onu => {
          const rx = parseFloat(onu.rx_power);
          const isDisconnected = onu.status === "Koneksi terputus" || onu.status === "Terputus" || onu.status === "Down" || onu.rx_power === "N/A" || onu.rx_power === "0" || onu.rx_power === "";
          if (onuFilter === 'disconnected') return isDisconnected;
          if (isDisconnected && onuFilter !== 'all') return false;

          const isCritical = !isDisconnected && rx <= -26.0;
          const isWarning  = !isDisconnected && rx > -26.0 && rx <= -25.0;
          const isOk       = !isDisconnected && rx > -25.0;
          
          if (onuFilter === 'ok') return isOk;
          if (onuFilter === 'warning') return isWarning;
          if (onuFilter === 'critical') return isCritical;
          return true;
        }).map(onu => {
          const rx         = parseFloat(onu.rx_power);
          const isDisconnected = onu.status === "Koneksi terputus" || onu.status === "Terputus" || onu.status === "Down" || onu.rx_power === "N/A" || onu.rx_power === "0" || onu.rx_power === "";
          const isCritical = !isDisconnected && rx <= -26.0;
          const isWarning  = !isDisconnected && rx > -26.0 && rx <= -25.0;
          const level      = isDisconnected ? 'critical' : isCritical ? 'critical' : isWarning ? 'warning' : 'ok';
          const rxColor    = isDisconnected ? '#b91c1c' : isCritical ? '#EF4444'  : isWarning ? '#D97706' : '#16A34A';

          return (
            <Marker
              key={`onu-${onu.id}`}
              position={[parseFloat(onu.latitude), parseFloat(onu.longitude)]}
              icon={createIcon(<OnuIcon level={level} />, [28, 28])}
            >
              <Popup>
                <InfoCard>
                  <div style={pp.head}>
                    <div style={{
                      ...pp.icon,
                      background: isDisconnected ? '#fee2e2' : isCritical ? '#FFF1F2' : isWarning ? '#FFFBEB' : '#F0FDF4',
                    }}>
                      🏠
                    </div>
                    <div>
                      <div style={pp.name}>{onu.customer || 'Pelanggan'}</div>
                      <div style={pp.sub} title={onu.mac_address}>
                        {onu.mac_address.length > 14
                          ? onu.mac_address.slice(0, 14) + '…'
                          : onu.mac_address}
                      </div>
                    </div>
                  </div>
                  <div style={pp.row}>
                    <span style={pp.lbl}>Redaman (Rx)</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {!isDisconnected && <SignalBars rx={rx} />}
                      <span style={{ ...pp.val, color: rxColor }}>
                        {isDisconnected ? 'N/A (Terputus)' : `${onu.rx_power} dBm`}
                      </span>
                    </div>
                  </div>
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #f3f4f6', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <button
                      onClick={() => handleStartEditOnuCable(onu)}
                      style={{
                        width: '100%', padding: '6px 10px', fontSize: 11, fontWeight: 600,
                        background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe',
                        borderRadius: 6, cursor: 'pointer'
                      }}
                    >
                      ✏️ Edit Belokan Kabel Drop
                    </button>
                  </div>
                </InfoCard>
              </Popup>
            </Marker>
          );
        })}

      </MapContainer>

      {/* Interactive Port Grid Modal */}
      {portGridOdp && (
        <OdpPortGridModal
          odp={portGridOdp}
          onus={onus as any}
          allOdps={odps as any}
          unassignedOnus={onus.filter(o => !o.odp_id) as any}
          onClose={() => setPortGridOdp(null)}
          onAssignPort={async (macAddress, odpId, portNumber) => {
            const targetOnu = onus.find(o => o.mac_address === macAddress);
            const token = localStorage.getItem('auth_token') || '';
            const res = await fetch(`/api/onu/${macAddress}`, {
              method: 'PUT',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                customer: targetOnu?.customer || '',
                latitude: targetOnu?.latitude || '',
                longitude: targetOnu?.longitude || '',
                odp_id: odpId,
                port_number: portNumber,
              }),
            });
            if (res.ok) fetchAll();
          }}
          onUnassignPort={async (macAddress) => {
            const targetOnu = onus.find(o => o.mac_address === macAddress);
            const token = localStorage.getItem('auth_token') || '';
            const res = await fetch(`/api/onu/${macAddress}`, {
              method: 'PUT',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                customer: targetOnu?.customer || '',
                latitude: targetOnu?.latitude || '',
                longitude: targetOnu?.longitude || '',
                odp_id: targetOnu?.odp_id || null,
                port_number: null,
              }),
            });
            if (res.ok) fetchAll();
          }}
          onAssignOdcPort={async (childOdpId, odcId, portNumber) => {
            const targetOdp = odps.find(o => o.id === childOdpId);
            const token = localStorage.getItem('auth_token') || '';
            const res = await fetch(`/api/odp/${childOdpId}`, {
              method: 'PUT',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                name: targetOdp?.name,
                type: targetOdp?.type,
                latitude: targetOdp?.latitude,
                longitude: targetOdp?.longitude,
                total_port: targetOdp?.total_port,
                odc_id: odcId,
                port_number: portNumber,
              }),
            });
            if (res.ok) fetchAll();
          }}
          onUnassignOdcPort={async (childOdpId) => {
            const targetOdp = odps.find(o => o.id === childOdpId);
            const token = localStorage.getItem('auth_token') || '';
            const res = await fetch(`/api/odp/${childOdpId}`, {
              method: 'PUT',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                name: targetOdp?.name,
                type: targetOdp?.type,
                latitude: targetOdp?.latitude,
                longitude: targetOdp?.longitude,
                total_port: targetOdp?.total_port,
                odc_id: null,
                port_number: null,
              }),
            });
            if (res.ok) fetchAll();
          }}
        />
      )}
    </div>
  );
}