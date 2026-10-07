import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import styles from './navbar.module.css';

export default function Navbar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  if (pathname === '/login') return null;

  const handleLogout = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    try {
      await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.warn('Logout request error:', error);
    } finally {
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/login';
    }
  };

  const navLinks = [
    { href: '/', label: 'Dashboard', icon: '▦' },
    { href: '/mikrotik', label: 'MikroTik', icon: '📡' },
    { href: '/odp', label: 'Manajemen ODP', icon: '⬡' },
    { href: '/onu', label: 'Manajemen ONU', icon: '⊡' },
    { href: '/map', label: 'Peta Topologi', icon: '◈' },
  ];

  return (
    <nav className={styles.nav}>
      {/* Brand */}
      <div className={styles.brand}>
        <div className={styles.brandIcon}>
          <img src="/logo-AFF.jpeg" alt="AFF DATA SOLUSI Logo" className={styles.logoImg} />
        </div>
        <div className={styles.brandText}>
          <div className={styles.brandName}>AFF DATA SOLUSI</div>
          <div className={styles.brandSub}>GIS Platform</div>
        </div>
      </div>

      {/* Mobile Toggle */}
      <button
        className={styles.mobileToggle}
        onClick={() => setIsMobileOpen(!isMobileOpen)}
      >
        {isMobileOpen ? '✕' : '☰'}
      </button>

      {/* Menu */}
      <div className={`${styles.menu} ${isMobileOpen ? styles.menuOpen : ''}`}>
        <div className={styles.links}>
          {navLinks.map(({ href, label, icon }) => (
            <Link
              key={href}
              to={href}
              className={`${styles.link} ${pathname === href ? styles.linkActive : ''}`}
              onClick={() => setIsMobileOpen(false)}
            >
              <span className={styles.linkIcon}>{icon}</span>
              {label}
            </Link>
          ))}
        </div>

        <div className={styles.right}>
          <div className={styles.separator} />
          <button className={styles.logoutBtn} onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}