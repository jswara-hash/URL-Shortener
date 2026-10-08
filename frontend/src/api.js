const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export async function sendOtp(phone) {
  const res = await fetch(`${API_BASE}/api/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to send OTP');
  return data;
}

export async function verifyOtp(phone, code) {
  const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, code })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Invalid OTP code');
  return data;
}

export async function createShortUrl(originalUrl, token) {
  const res = await fetch(`${API_BASE}/api/urls`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ originalUrl })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to shorten URL');
  return data.url;
}

export async function getMyUrls(token) {
  const res = await fetch(`${API_BASE}/api/urls`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load URLs');
  return data.urls;
}
