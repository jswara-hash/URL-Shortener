import React, { useState, useEffect } from 'react';
import { sendOtp, verifyOtp, createShortUrl, getMyUrls } from './api';

export default function App() {
  // Navigation: 'auth' | 'dashboard' | '404'
  const [currentPage, setCurrentPage] = useState('auth');
  
  // Auth State
  const [token, setToken] = useState(() => localStorage.getItem('urlshortener_token') || '');
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('urlshortener_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Auth Form State
  const [phone, setPhone] = useState('+91');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState(null); // { type: 'error' | 'success' | 'info', text: '' }

  // Shortener State
  const [longUrl, setLongUrl] = useState('');
  const [shortenLoading, setShortenLoading] = useState(false);
  const [shortenMessage, setShortenMessage] = useState(null);
  const [latestCreated, setLatestCreated] = useState(null);
  const [urls, setUrls] = useState([]);
  const [urlsLoading, setUrlsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  // Initialize view based on stored token
  useEffect(() => {
    if (token && user) {
      setCurrentPage('dashboard');
      loadUrls(token);
    } else {
      setCurrentPage('auth');
    }
  }, [token]);

  // Handle URL hash / path check for 404 page demonstration
  useEffect(() => {
    if (window.location.pathname === '/404') {
      setCurrentPage('404');
    }
  }, []);

  async function loadUrls(activeToken) {
    try {
      setUrlsLoading(true);
      const data = await getMyUrls(activeToken);
      setUrls(data);
    } catch (err) {
      console.error(err);
    } finally {
      setUrlsLoading(false);
    }
  }

  // Auth Handlers
  async function handleSendOtp(e) {
    e.preventDefault();
    setAuthMessage(null);
    if (!phone || phone.trim().length < 8) {
      setAuthMessage({ type: 'error', text: 'Please enter a valid phone number with country code (e.g. +919876543210)' });
      return;
    }

    try {
      setAuthLoading(true);
      const res = await sendOtp(phone);
      setOtpSent(true);
      setAuthMessage({
        type: res.isDemo ? 'info' : 'success',
        text: res.message || 'OTP sent successfully!'
      });
    } catch (err) {
      setAuthMessage({ type: 'error', text: err.message });
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setAuthMessage(null);
    if (!otpCode || otpCode.trim().length !== 6) {
      setAuthMessage({ type: 'error', text: 'Please enter the 6-digit verification code' });
      return;
    }

    try {
      setAuthLoading(true);
      const res = await verifyOtp(phone, otpCode);
      setToken(res.token);
      setUser(res.user);
      localStorage.setItem('urlshortener_token', res.token);
      localStorage.setItem('urlshortener_user', JSON.stringify(res.user));
      setCurrentPage('dashboard');
      setOtpSent(false);
      setOtpCode('');
      setAuthMessage(null);
    } catch (err) {
      setAuthMessage({ type: 'error', text: err.message });
    } finally {
      setAuthLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem('urlshortener_token');
    localStorage.removeItem('urlshortener_user');
    setToken('');
    setUser(null);
    setUrls([]);
    setLatestCreated(null);
    setCurrentPage('auth');
    setOtpSent(false);
    setOtpCode('');
  }

  // Shortener Handlers
  async function handleShorten(e) {
    e.preventDefault();
    setShortenMessage(null);
    const trimmed = longUrl.trim();

    if (!trimmed) {
      setShortenMessage({ type: 'error', text: 'Please paste a destination URL' });
      return;
    }

    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      setShortenMessage({ type: 'error', text: 'URL must start with http:// or https://' });
      return;
    }

    try {
      setShortenLoading(true);
      const newUrl = await createShortUrl(trimmed, token);
      setLatestCreated(newUrl);
      setLongUrl('');
      setShortenMessage({ type: 'success', text: 'Short URL created successfully!' });
      // Refresh list
      loadUrls(token);
    } catch (err) {
      setShortenMessage({ type: 'error', text: err.message });
    } finally {
      setShortenLoading(false);
    }
  }

  function copyToClipboard(urlText, id) {
    navigator.clipboard.writeText(urlText);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  }

  // Total clicks calculation
  const totalClicks = urls.reduce((acc, curr) => acc + (curr.clicks || 0), 0);

  return (
    <div className="app-container">
      {/* Navigation Header */}
      <header className="navbar">
        <div className="brand" onClick={() => setCurrentPage(token ? 'dashboard' : 'auth')}>
          <div className="brand-icon">⚡</div>
          <span className="brand-title">URLShortener</span>
        </div>

        <div className="nav-actions">
          {token && user ? (
            <>
              <div className="user-badge">
                <span>📱</span> {user.phone}
              </div>
              <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
                Sign Out
              </button>
            </>
          ) : (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setCurrentPage(currentPage === '404' ? 'auth' : '404')}
            >
              {currentPage === '404' ? 'Back to Login' : '404 Preview'}
            </button>
          )}
        </div>
      </header>

      {/* Main Page Content */}
      <main className="main-content">
        {/* ================================================== */}
        {/* PAGE 1: AUTH PAGE (Registration / Login via Minimoth OTP) */}
        {/* ================================================== */}
        {currentPage === 'auth' && (
          <div className="auth-wrapper">
            <div className="card">
              <div className="auth-header">
                <h1>Welcome Back</h1>
                <p>Sign in or register with instant OTP verification</p>
                <div className="minimoth-badge">
                  <span>🔒</span> Powered by Minimoth API
                </div>
              </div>

              {authMessage && (
                <div className={`banner banner-${authMessage.type}`}>
                  {authMessage.type === 'error' && '⚠️ '}
                  {authMessage.type === 'success' && '✅ '}
                  {authMessage.type === 'info' && '💡 '}
                  {authMessage.text}
                </div>
              )}

              {!otpSent ? (
                /* Step 1: Request OTP */
                <form onSubmit={handleSendOtp}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="phone-input">Mobile Phone Number</label>
                    <input
                      id="phone-input"
                      type="tel"
                      className="form-input"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+919876543210"
                      required
                    />
                    <div className="form-hint">
                      Include country code (e.g., +91 for India). OTP is delivered via WhatsApp / SMS.
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={authLoading}
                  >
                    {authLoading ? 'Sending OTP...' : 'Send Verification OTP'}
                  </button>
                </form>
              ) : (
                /* Step 2: Verify OTP */
                <form onSubmit={handleVerifyOtp}>
                  <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <label className="form-label" htmlFor="otp-input">6-Digit OTP Code</label>
                      <button
                        type="button"
                        style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', fontSize: '0.8rem' }}
                        onClick={() => { setOtpSent(false); setAuthMessage(null); }}
                      >
                        Change number
                      </button>
                    </div>
                    <input
                      id="otp-input"
                      type="text"
                      maxLength={6}
                      className="form-input"
                      style={{ letterSpacing: '0.3em', textAlign: 'center', fontSize: '1.25rem', fontFamily: 'var(--font-mono)' }}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••••"
                      autoFocus
                      required
                    />
                    <div className="form-hint">
                      Sent to <strong>{phone}</strong>. Enter code to log in or register.
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={authLoading}
                  >
                    {authLoading ? 'Verifying...' : 'Verify OTP & Continue'}
                  </button>

                  <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                    <button
                      type="button"
                      style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: '0.85rem', cursor: 'pointer' }}
                      onClick={handleSendOtp}
                      disabled={authLoading}
                    >
                      Didn't get code? Resend OTP
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* ================================================== */}
        {/* PAGE 2: DASHBOARD / URL SHORTENER PAGE */}
        {/* ================================================== */}
        {currentPage === 'dashboard' && (
          <div style={{ width: '100%' }}>
            {/* Shortener Card */}
            <div className="card">
              <h2 style={{ fontSize: '1.4rem', fontWeight: '700', marginBottom: '0.35rem' }}>
                Shorten a Long URL
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Create clean, high-performance short links and track their clicks in real time.
              </p>

              {shortenMessage && (
                <div className={`banner banner-${shortenMessage.type}`} style={{ marginTop: '1rem' }}>
                  {shortenMessage.type === 'error' && '⚠️ '}
                  {shortenMessage.type === 'success' && '✅ '}
                  {shortenMessage.text}
                </div>
              )}

              <form onSubmit={handleShorten} className="shortener-bar">
                <input
                  id="long-url-input"
                  type="url"
                  className="form-input"
                  placeholder="https://example.com/long-page-address-to-shorten"
                  value={longUrl}
                  onChange={(e) => setLongUrl(e.target.value)}
                  required
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={shortenLoading}
                >
                  {shortenLoading ? 'Shortening...' : '⚡ Shorten'}
                </button>
              </form>

              {/* Latest Created Link Banner */}
              {latestCreated && (
                <div className="created-highlight">
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '0.2rem' }}>
                      Ready to share:
                    </div>
                    <div className="created-url">
                      {latestCreated.shortUrl}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => copyToClipboard(latestCreated.shortUrl, 'latest')}
                    >
                      {copiedId === 'latest' ? '✓ Copied!' : '📋 Copy'}
                    </button>
                    <a
                      href={latestCreated.shortUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary btn-sm"
                    >
                      Visit ↗
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Stats Summary */}
            <div className="stats-row">
              <div className="stat-card">
                <span className="stat-label">Links Shortened</span>
                <span className="stat-value">{urls.length}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Total Clicks Tracked</span>
                <span className="stat-value" style={{ color: '#34d399' }}>{totalClicks}</span>
              </div>
            </div>

            {/* Links List Section */}
            <div className="links-section">
              <div className="section-title">
                <span>My Shortened Links</span>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => loadUrls(token)}
                  disabled={urlsLoading}
                >
                  {urlsLoading ? 'Refreshing...' : '🔄 Refresh Clicks'}
                </button>
              </div>

              {urls.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🔗</div>
                  <h3>No short links yet</h3>
                  <p>Paste a destination link in the field above to create your first short URL.</p>
                </div>
              ) : (
                <div className="links-list">
                  {urls.map((item) => (
                    <div key={item.id} className="link-row">
                      <div className="link-details">
                        <div className="short-link-line">
                          <a
                            href={item.shortUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="short-link-anchor"
                          >
                            {item.shortUrl}
                          </a>
                          <span className="clicks-badge">
                            👁️ {item.clicks} {item.clicks === 1 ? 'click' : 'clicks'}
                          </span>
                        </div>
                        <div className="original-link-line" title={item.original_url}>
                          {item.original_url}
                        </div>
                      </div>

                      <div className="link-actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => copyToClipboard(item.shortUrl, item.id)}
                        >
                          {copiedId === item.id ? '✓ Copied' : '📋 Copy'}
                        </button>
                        <a
                          href={item.shortUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-icon"
                          title="Open Link"
                        >
                          ↗
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================================== */}
        {/* PAGE 3: 404 / NOT FOUND PAGE */}
        {/* ================================================== */}
        {currentPage === '404' && (
          <div className="card not-found-card">
            <div className="error-code">404</div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Link Not Found</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.75rem', lineHeight: '1.6' }}>
              The short link you are looking for has expired, does not exist, or the destination URL was removed.
            </p>
            <button
              className="btn btn-primary"
              style={{ width: 'auto', margin: '0 auto' }}
              onClick={() => setCurrentPage(token ? 'dashboard' : 'auth')}
            >
              ← Back to {token ? 'Dashboard' : 'Home'}
            </button>
          </div>
        )}
      </main>

      {/* Workshop Footer */}
      <footer className="footer">
        ⚡ <strong>URLShortener</strong> — 45-Minute Workshop Project • Built with React, Node.js & Minimoth OTP
      </footer>
    </div>
  );
}
