import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const PWD_KEY = 'dashboard_pwd';
const headers = () => ({ 'x-dashboard-password': localStorage.getItem(PWD_KEY) || '' });

export default function App() {
  const [pwd, setPwd] = useState(localStorage.getItem(PWD_KEY) || '');
  const [auth, setAuth] = useState(!!pwd);
  const [messages, setMessages] = useState([]);
  const [stats, setStats] = useState(null);
  const [status, setStatus] = useState({});
  const [q, setQ] = useState(''); const [otpOnly, setOtpOnly] = useState(false);
  const [dark, setDark] = useState(localStorage.getItem('dark') === '1');

  useEffect(() => { document.documentElement.classList.toggle('dark', dark); localStorage.setItem('dark', dark?'1':'0'); }, [dark]);

  const load = async () => {
    const params = new URLSearchParams(); if (q) params.set('q', q); if (otpOnly) params.set('otp','1');
    const [m, s, st] = await Promise.all([
      fetch('/api/messages?'+params, { headers: headers() }).then(r => r.json()),
      fetch('/api/stats', { headers: headers() }).then(r => r.json()),
      fetch('/api/status', { headers: headers() }).then(r => r.json()),
    ]);
    setMessages(m); setStats(s); setStatus(st);
  };

  useEffect(() => { if (!auth) return; load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [auth, q, otpOnly]);

  useEffect(() => {
    if (!auth) return;
    const s = io(); s.on('new_message', m => {
      setMessages(prev => [{ ...m, id: Date.now() }, ...prev].slice(0,200));
      try { new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=').play(); } catch {}
    });
    return () => s.close();
  }, [auth]);

  if (!auth) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow w-full max-w-sm">
        <h1 className="text-xl font-bold mb-4">Dashboard Login</h1>
        <input type="password" value={pwd} onChange={e=>setPwd(e.target.value)}
          className="w-full px-3 py-2 border rounded mb-3 dark:bg-slate-700" placeholder="Password" />
        <button className="w-full bg-blue-600 text-white py-2 rounded" onClick={()=>{ localStorage.setItem(PWD_KEY, pwd); setAuth(true); }}>Enter</button>
      </div>
    </div>
  );

  const ctrl = async (path) => { await fetch('/api'+path, { method:'POST', headers: headers() }); load(); };

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">📩 IVASMS OTP Dashboard</h1>
        <div className="flex gap-2 items-center">
          <span className={`px-2 py-1 rounded text-xs ${status.loggedIn?'bg-green-200 text-green-900':'bg-red-200 text-red-900'}`}>{status.loggedIn?'Logged in':'Offline'}</span>
          <span className={`px-2 py-1 rounded text-xs ${status.running?'bg-blue-200 text-blue-900':'bg-slate-300 text-slate-800'}`}>{status.running?'Running':'Stopped'}</span>
          <button className="px-3 py-1 rounded bg-emerald-600 text-white" onClick={()=>ctrl('/start')}>Start</button>
          <button className="px-3 py-1 rounded bg-rose-600 text-white" onClick={()=>ctrl('/stop')}>Stop</button>
          <button className="px-3 py-1 rounded border" onClick={()=>setDark(!dark)}>{dark?'☀️':'🌙'}</button>
        </div>
      </header>

      {stats && <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card label="Total" value={stats.total}/>
        <Card label="With OTP" value={stats.withOtp}/>
        <Card label="Today" value={stats.today}/>
        <Card label="Top sender" value={stats.topSenders[0]?.sender || '-'}/>
      </div>}

      <div className="flex flex-wrap gap-3 mb-4">
        <input className="px-3 py-2 border rounded flex-1 dark:bg-slate-800" placeholder="Search number / sender / text"
          value={q} onChange={e=>setQ(e.target.value)} />
        <label className="flex items-center gap-2"><input type="checkbox" checked={otpOnly} onChange={e=>setOtpOnly(e.target.checked)}/> OTP only</label>
        <a href={'/api/export.csv'} onClick={e=>{e.preventDefault(); fetch('/api/export.csv',{headers:headers()}).then(r=>r.blob()).then(b=>{const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download='messages.csv';a.click();});}}
          className="px-3 py-2 rounded bg-slate-700 text-white">Export CSV</a>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 dark:bg-slate-700"><tr>
            <th className="text-left p-3">Time</th><th className="text-left p-3">Number</th>
            <th className="text-left p-3">Sender</th><th className="text-left p-3">Message</th>
            <th className="text-left p-3">OTP</th>
          </tr></thead>
          <tbody>
            {messages.map(m => (<tr key={m.id} className="border-t border-slate-200 dark:border-slate-700">
              <td className="p-3 whitespace-nowrap">{m.received_at}</td>
              <td className="p-3">{m.number}</td><td className="p-3">{m.sender}</td>
              <td className="p-3">{m.message}</td>
              <td className="p-3 font-mono text-blue-600 dark:text-blue-300">{m.otp}</td>
            </tr>))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function Card({label, value}) {
  return <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow">
    <div className="text-slate-500 text-sm">{label}</div>
    <div className="text-2xl font-bold mt-1">{value}</div></div>;
}
