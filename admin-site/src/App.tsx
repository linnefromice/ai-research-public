import { useState, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { ReportDetail } from './pages/ReportDetail';
import { Trends } from './pages/Trends';
import { ResearchRequests } from './pages/ResearchRequests';
import Events from './pages/Events';
import './admin.css';

/**
 * Cloudflare Access で保護されたセッションからログアウトする。
 * `/cdn-cgi/access/logout` は Access が提供するエンドポイントで、
 * セッション cookie を失効させてから Access のトップに戻す。
 */
function logoutFromAccess() {
  window.location.href = '/cdn-cgi/access/logout';
}

function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const navItems = [
    { path: '/', label: 'Reports', icon: '📊' },
    { path: '/trends', label: 'Trends', icon: '📈' },
    { path: '/research-requests', label: 'Research', icon: '🔬' },
    { path: '/events', label: 'Events', icon: '⚠️' },
  ];

  return (
    <div className="admin-layout">
      {/* Desktop: Left sidebar */}
      <nav className="admin-sidebar" aria-label="Main navigation">
        <div className="sidebar-header">
          <h2>📊 Admin</h2>
          <p>OpenClaw Reports</p>
        </div>

        <div className="sidebar-nav">
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`sidebar-link ${location.pathname === item.path ? 'active' : ''}`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </div>

        <button className="disconnect-btn" onClick={logoutFromAccess}>
          Logout
        </button>
      </nav>

      {/* Mobile: Bottom tab bar (primary items + More menu) */}
      <nav className="mobile-bar" aria-label="Mobile navigation">
        {navItems.map(item => (
          <Link
            key={item.path}
            to={item.path}
            className={`mobile-tab ${location.pathname === item.path ? 'active' : ''}`}
          >
            <span className="mobile-icon">{item.icon}</span>
            <span className="mobile-label">{item.label}</span>
          </Link>
        ))}
        <button
          className={`mobile-tab ${moreOpen ? 'active' : ''}`}
          onClick={() => setMoreOpen(v => !v)}
          aria-expanded={moreOpen}
          aria-label="More"
        >
          <span className="mobile-icon">⋯</span>
          <span className="mobile-label">More</span>
        </button>
      </nav>

      {/* Mobile More menu popup (rendered above mobile-bar when open) */}
      {moreOpen && (
        <>
          <div
            className="mobile-more-overlay"
            onClick={() => setMoreOpen(false)}
            aria-hidden="true"
          />
          <div className="mobile-more-menu" role="menu">
            <button
              className="mobile-more-item"
              onClick={() => { setMoreOpen(false); logoutFromAccess(); }}
              role="menuitem"
            >
              <span>🔌</span>
              <span>Logout</span>
            </button>
          </div>
        </>
      )}

      {/* Main content */}
      <main className="admin-main">
        {children}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/trends" element={<Trends />} />
          <Route path="/research-requests" element={<ResearchRequests />} />
          <Route path="/events" element={<Events />} />
          <Route path="/report/:id" element={<ReportDetail />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
