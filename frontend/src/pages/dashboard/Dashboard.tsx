import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  Onu, Odp, Infra,
  CoreStatusCard,
  OdcStatusCard,
  OdpCapacityCard,
  OnuHealthCard,
  LoadingScreen
} from './components';
import styles from './dashboard.module.css';

export default function Dashboard() {
  const [onus, setOnus] = useState<Onu[]>([]);
  const [infras, setInfras] = useState<Infra[]>([]);
  const [odps, setOdps] = useState<Odp[]>([]);
  const [odcs, setOdcs] = useState<Odp[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [infraError, setInfraError] = useState(false);     // Zabbix error, tidak ada data sama sekali
  const [zabbixOffline, setZabbixOffline] = useState(false); // Zabbix offline, tapi ada data cache DB
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {

    document.title = "Dashboard | AFF DATA SOLUSI";

    // ✅ UBAH KETIGA FETCH MENJADI RELATIVE PATH:
    Promise.all([
      fetch('/api/onu', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/zabbix-infra', { credentials: 'include' })
        .then(r => {
          if (!r.ok) { setInfraError(true); return { result: [] }; }
          return r.json();
        })
        .catch(() => { setInfraError(true); return { result: [] }; }),
      fetch('/api/odp', { credentials: 'include' }).then(r => r.json()),
    ]).then(([onuData, infraData, odpData]) => {
      // Deteksi apakah Zabbix offline (ada data cache) atau error total
      if (infraData?.zabbix_status === 'offline') {
        setZabbixOffline(true);
      }

      const rawInfras = Array.isArray(infraData) ? infraData : (infraData.result || []);
      const rawOdps = Array.isArray(odpData) ? odpData : (odpData.result || []);
      const rawOnus = Array.isArray(onuData) ? onuData : (onuData.result || []);

      let latest = 0;
      rawOnus.forEach((o: any) => {
        if (o.updated_at) {
          const t = new Date(o.updated_at).getTime();
          if (t > latest) latest = t;
        }
      });
      setLastUpdated(latest > 0 ? new Date(latest) : new Date());

      setOnus(rawOnus);
      setInfras(rawInfras);
      setOdps(rawOdps.filter((o: Odp) => o.type === 'ODP' || !o.type));
      setOdcs(rawOdps.filter((o: Odp) => o.type === 'ODC'));
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, []);

  if (isLoading) return <LoadingScreen />;

  // ── Core ───────────────────────────────────────────────────
  const mikrotik = infras.find(i => i.name.toLowerCase().includes('mikrotik'));
  const olt = infras.find(i => i.name.toLowerCase().includes('olt'));
  const isOltDown = olt?.interfaces?.some(i => i.available === '2') || false;
  const isMikrotikDown = mikrotik?.interfaces?.some(i => i.available === '2') || false;

  // ── ONU ───────────────────────────────────────────────────
  const getRxCategory = (o: Onu) => {
    const isDisconnected = o.status === "Koneksi terputus" || o.status === "Terputus" || o.status === "Down" || o.status === "Offline" || o.rx_power === "N/A" || o.rx_power === "0" || o.rx_power === "" || !o.rx_power;
    const rx = parseFloat(o.rx_power);
    if (isDisconnected || isNaN(rx) || rx <= -26.0) return 'critical';
    if (rx <= -25.0) return 'warning';
    return 'safe';
  };

  const totalOnu = onus.length;
  const criticalOnu = onus.filter(o => getRxCategory(o) === 'critical').length;
  const warningOnu = onus.filter(o => getRxCategory(o) === 'warning').length;
  const safeOnu = onus.filter(o => getRxCategory(o) === 'safe').length;

  // ── ODC ───────────────────────────────────────────────────
  const totalOdc = odcs.length;
  const odcUsage = odcs.map(odc => {
    const connected = odps.filter(o => o.odc_id === odc.id).length;
    return { ...odc, connected, pct: odc.total_port > 0 ? Math.round((connected / odc.total_port) * 100) : 0 };
  });
  const fullOdcs = odcUsage.filter(o => o.pct > 80).length;
  const avgOdcUsage = totalOdc > 0 ? odcUsage.reduce((s, o) => s + o.pct, 0) / totalOdc : 0;

  // ── ODP ───────────────────────────────────────────────────
  const totalOdp = odps.length;
  const totalPorts = odps.reduce((s, o) => s + (o.total_port || 0), 0);
  const usedPorts = onus.filter(o => o.odp_id).length;
  const freePorts = totalPorts - usedPorts;
  const usagePercent = totalPorts > 0 ? Math.round((usedPorts / totalPorts) * 100) : 0;



  return (
    <div className={styles.page}>

      {/* Header */}
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>AFF DATA SOLUSI · FTTH</p>
          <h1 className={styles.title}>Network Overview</h1>
        </div>
      </header>

      <div className={styles.divider} />

      {/* Cards */}
      <div className={styles.grid}>
        <CoreStatusCard
          isOltDown={isOltDown}
          isMikrotikDown={isMikrotikDown}
          infraUnreachable={infraError}
          zabbixOffline={zabbixOffline}
          infras={infras}
        />
        <OdcStatusCard
          totalOdc={totalOdc}
          fullOdcs={fullOdcs}
          avgOdcUsage={avgOdcUsage}
          odcs={odcs}
          odps={odps}
        />
        <OdpCapacityCard
          totalOdp={totalOdp}
          totalPorts={totalPorts}
          usedPorts={usedPorts}
          freePorts={freePorts}
          usagePercent={usagePercent}
          odps={odps}
          odcs={odcs}
          onus={onus}
        />
        <OnuHealthCard
          totalOnu={totalOnu}
          safeOnu={safeOnu}
          warningOnu={warningOnu}
          criticalOnu={criticalOnu}
          onus={onus}
          odps={odps}
        />
      </div>



    </div>
  );
}