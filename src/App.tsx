import { useState, useEffect, useMemo } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { save } from '@tauri-apps/plugin-dialog'
import {
  AlertTriangle, Network, Activity, Eye, Power,
  SearchCode, ShieldAlert, Ghost,
  Map, List, Radio, WifiOff, X
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import TitleBar from './components/TitleBar'
import NetworkInfo from './components/NetworkInfo'
import ScanButton from './components/ScanButton'
import DeviceCard, { Device } from './components/DeviceCard'
import TrafficLog, { CapturedPacket } from './components/TrafficLog'
import IntelligencePanel from './components/IntelligencePanel'
import NetworkTopology from './components/NetworkTopology'
import SecretsVault, { Credential } from './components/SecretsVault'
import SearchBar from './components/SearchBar'
import AlertSystem, { Alert, AlertToast } from './components/AlertSystem'
import ExportPanel from './components/ExportPanel'
import DeviceLabelEditor from './components/DeviceLabelEditor'

interface NetworkInfoData { local_ip: string; gateway: string; subnet: string; interface_name: string }
interface MitmStatus { active: boolean; target_ip: string; packets_intercepted: number; mode: string }
interface AppStats { dns_count: number; data_count: number; high_risk_count: number; total_traffic_bytes: number }
type ScanStatus = 'idle' | 'scanning' | 'done' | 'error'
type ViewMode = 'list' | 'topology'
type RightPanel = 'traffic' | 'secrets' | 'alerts'



function App() {
  const [networkInfo, setNetworkInfo] = useState<NetworkInfoData | null>(null)
  const [devices, setDevices] = useState<Device[]>([])
  const [packets, setPackets] = useState<CapturedPacket[]>([])
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [toasts, setToasts] = useState<Alert[]>([])
  const [appStats, setAppStats] = useState<AppStats>({ dns_count: 0, data_count: 0, high_risk_count: 0, total_traffic_bytes: 0 })
  const [currentSpeedBps, setCurrentSpeedBps] = useState(0)
  const [scanStatus, setScanStatus] = useState<ScanStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [selectedIp, setSelectedIp] = useState<string | null>(null)
  const [isSniffing, setIsSniffing] = useState(true)
  const [isRecordingPcap, setIsRecordingPcap] = useState(false)
  const [showIntel, setShowIntel] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [rightPanel, setRightPanel] = useState<RightPanel>('traffic')
  const [mitmStatus, setMitmStatus] = useState<MitmStatus | null>(null)
  const [isolateActive, setIsolateActive] = useState(false)
  const [isolatedIp, setIsolatedIp] = useState<string | null>(null)
  const [stealthMode, setStealthMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterLabel, setFilterLabel] = useState('')
  const [localLabels, setLocalLabels] = useState<Record<string, { label: string; note: string }>>({})
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)

  const selectedDevice = useMemo(() => devices.find(d => d.ip === selectedIp) || null, [devices, selectedIp])



  const pushAlert = (a: Alert) => {
    setAlerts(prev => [a, ...prev].slice(0, 100))
    setToasts(prev => [a, ...prev].slice(0, 3))
  }

  // Check admin on startup and load history
  useEffect(() => {
    invoke<boolean>('check_admin').then(setIsAdmin).catch(() => setIsAdmin(false))
    
    // Load device history for labels/notes
    invoke<any[]>('get_device_history').then(history => {
      const dbLabels: Record<string, {label: string, note: string}> = {}
      history.forEach(r => {
        if (r.label || r.note) dbLabels[r.ip] = { label: r.label, note: r.note }
      })
      setLocalLabels(dbLabels)
    }).catch(console.error)

    invoke<NetworkInfoData>('get_network_info')
      .then(info => {
        setNetworkInfo(info)
        invoke('start_sniffing').catch(console.error)
      })
      .catch(err => console.error('Network info error:', err))
  }, [])

  // Poll for stats every second
  useEffect(() => {
    let lastBytes = 0;
    const interval = setInterval(() => {
      invoke<AppStats>('get_app_stats').then(stats => {
        setAppStats(stats)
        setCurrentSpeedBps(stats.total_traffic_bytes - lastBytes)
        lastBytes = stats.total_traffic_bytes
      }).catch(() => {})
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Device found listener
  useEffect(() => {
    const unlisten = listen<Device>('device-found', (e) => {
      setDevices(prev => {
        const exists = prev.find(d => d.ip === e.payload.ip)
        if (!exists) {
          return [...prev, e.payload].sort((a, b) => a.ip.localeCompare(b.ip, undefined, { numeric: true }))
        }
        return prev
      })
    })
    return () => { unlisten.then(f => f()) }
  }, [])

  // Alerts listener
  useEffect(() => {
    const unlisten = listen<Alert>('new-alert', (e) => {
      pushAlert(e.payload)
    })
    return () => { unlisten.then(f => f()) }
  }, [])

  // Packet batch listener
  useEffect(() => {
    const unlisten = listen<CapturedPacket[]>('packets-captured-batch', (e) => {
      if (!isSniffing) return
      setPackets(prev => [...prev, ...e.payload].slice(-200))
    })
    return () => { unlisten.then(f => f()) }
  }, [isSniffing])

  // Credential found listener
  useEffect(() => {
    const unlisten = listen<Credential>('credential-found', (e) => {
      setCredentials(prev => [e.payload, ...prev].slice(0, 50))
      setRightPanel('secrets')
    })
    return () => { unlisten.then(f => f()) }
  }, [])

  useEffect(() => {
    const u1 = listen<number>('scan-progress', (e) => setProgress(e.payload))
    const u2 = listen<void>('scan-complete', () => setScanStatus('done'))
    const u3 = listen<MitmStatus>('mitm-status', (e) => setMitmStatus(e.payload))
    const u4 = listen<void>('mitm-stopped', () => { setMitmStatus(null); setIsolateActive(false); setIsolatedIp(null) })
    return () => { [u1,u2,u3,u4].forEach(u => u.then(f => f())) }
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 's') { e.preventDefault(); handleScan() }
      if (e.key === 'Escape') { setShowIntel(false); setSelectedIp(null) }
      if (e.ctrlKey && e.key === 'f') { e.preventDefault(); document.querySelector<HTMLInputElement>('.search-input')?.focus() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleScan = async () => {
    setDevices([]); setProgress(0); setScanStatus('scanning')
    try { await invoke('scan_network') } catch (err) { setError(String(err)); setScanStatus('error') }
  }
  const toggleSniffing = async () => {
    if (isSniffing) { await invoke('stop_sniffing'); setIsSniffing(false) }
    else { await invoke('start_sniffing'); setIsSniffing(true) }
  }
  const handleStartMitm = async () => {
    if (!selectedIp) return
    if (mitmStatus?.active && mitmStatus.mode === 'intercept') { await invoke('stop_mitm') }
    else { try { await invoke('start_mitm', { targetIp: selectedIp }) } catch (err) { setError(`MitM: ${err}`) } }
  }
  const handleIsolate = async () => {
    if (!selectedIp) return
    if (isolateActive && isolatedIp === selectedIp) {
      await invoke('stop_isolate'); setIsolateActive(false); setIsolatedIp(null)
    } else {
      try { await invoke('isolate_device', { targetIp: selectedIp }); setIsolateActive(true); setIsolatedIp(selectedIp) }
      catch (err) { setError(`İzolasyon: ${err}`) }
    }
  }
  const wakeDevice = async (mac: string) => {
    try { await invoke('wake_on_lan', { mac }) } catch (err) { setError(`WoL: ${err}`) }
  }

  const handlePcapRecord = async () => {
    if (isRecordingPcap) {
      await invoke('stop_pcap_export')
      setIsRecordingPcap(false)
      pushAlert({ id: Date.now().toString(), type: 'info', title: 'PCAP Kaydedildi', body: 'Trafik kaydı başarıyla sonlandırıldı.', timestamp: new Date().toLocaleTimeString('tr-TR'), read: false })
    } else {
      const filePath = await save({ filters: [{ name: 'Wireshark Capture', extensions: ['pcap'] }] })
      if (filePath) {
        try {
          await invoke('start_pcap_export', { path: filePath })
          setIsRecordingPcap(true)
        } catch (e) {
          setError(`PCAP Hatası: ${e}`)
        }
      }
    }
  }

  // Filtered device list
  const filteredDevices = useMemo(() => {
    return devices.filter(d => {
      const q = searchQuery.toLowerCase()
      const matchSearch = !q || d.ip.includes(q) || d.hostname.toLowerCase().includes(q) || d.vendor.toLowerCase().includes(q)
      const deviceLabel = localLabels[d.ip]?.label || ''
      const matchLabel = !filterLabel || deviceLabel === filterLabel
      return matchSearch && matchLabel
    })
  }, [devices, searchQuery, filterLabel, localLabels])



  const unreadAlerts = alerts.filter(a => !a.read).length

  return (
    <div className="app-container bg-[#030508] flex flex-col overflow-hidden" style={{ fontFamily: 'Inter, sans-serif' }}>
      <TitleBar />

      {/* Admin Warning */}
      <AnimatePresence>
        {isAdmin === false && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="px-5 py-2 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-2 text-amber-400 text-[10px] font-bold">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              YÖNETİCİ YETKİSİ GEREKLİ — Paket yakalama ve ARP özellikleri için uygulamayı "Yönetici olarak çalıştır"
              <button onClick={() => setIsAdmin(null)} className="ml-auto text-amber-400/50 hover:text-amber-400"><X className="w-3.5 h-3.5" /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <NetworkInfo localIp={networkInfo?.local_ip ?? ''} gateway={networkInfo?.gateway ?? ''} subnet={networkInfo?.subnet ?? ''} deviceCount={devices.length} isScanning={scanStatus === 'scanning'} />

      {/* Active mode banner */}
      <AnimatePresence>
        {mitmStatus?.active && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className={`px-5 py-1.5 border-b flex items-center gap-3 ${mitmStatus.mode === 'isolate' ? 'bg-orange-500/10 border-orange-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
              <Radio className={`w-3.5 h-3.5 animate-pulse ${mitmStatus.mode === 'isolate' ? 'text-orange-400' : 'text-red-400'}`} />
              <span className={`text-[10px] font-bold uppercase tracking-widest ${mitmStatus.mode === 'isolate' ? 'text-orange-400' : 'text-red-400'}`}>
                {mitmStatus.mode === 'isolate' ? '🔌 İZOLASYON' : '📡 MitM'} AKTİF — {mitmStatus.target_ip}
              </span>
              <span className="text-[10px] text-white/30 font-mono ml-1">{mitmStatus.packets_intercepted} paket</span>
              <button onClick={() => mitmStatus.mode === 'isolate' ? invoke('stop_isolate') : invoke('stop_mitm')} className="ml-auto text-white/30 hover:text-white/70"><X className="w-4 h-4" /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex overflow-hidden p-4 gap-4">
        {/* ===== LEFT ===== */}
        <div className="w-[56%] flex flex-col gap-3 overflow-hidden">
          {/* Header */}
          <div className="glass-panel rounded-3xl p-5 flex items-center gap-4 relative overflow-hidden border-white/5">
            <div className="flex-1 z-10">
              <div className="flex items-center gap-2 mb-1">
                <SearchCode className="w-4 h-4 text-indigo-400" />
                <h1 className="text-lg font-black tracking-tighter text-white">NETSCOPE <span className="text-indigo-500">ELITE</span></h1>
                {stealthMode && <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[8px] font-bold text-emerald-400">STEALTH</span>}
              </div>
              <div className="flex gap-2 mt-3">
                {[{ l: 'Hız', v: `${(currentSpeedBps / 1024).toFixed(1)} KB/s`, c: 'text-emerald-400' }, { l: 'DNS', v: appStats.dns_count, c: 'text-cyan-400' }, { l: 'Veri', v: appStats.data_count, c: 'text-indigo-400' }, { l: 'Risk', v: appStats.high_risk_count, c: 'text-red-400' }, { l: 'Cred', v: credentials.length, c: 'text-amber-400' }].map(s => (
                  <div key={s.l} className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/5 text-center">
                    <div className="text-[8px] text-white/30 font-bold uppercase">{s.l}</div>
                    <div className={`text-sm font-mono font-bold ${s.c}`}>{s.v}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 z-10">
              <ScanButton isScanning={scanStatus === 'scanning'} progress={progress} onScan={handleScan} onStop={() => invoke('stop_scan')} />
              <div className="flex gap-2">
                <ExportPanel deviceCount={devices.length} />
                <button onClick={() => setStealthMode(v => !v)} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[9px] font-bold border transition-all ${stealthMode ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-white/5 text-white/30 border-white/5'}`}>
                  <Ghost className="w-3 h-3" /> STEALTH
                </button>
              </div>
            </div>
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-indigo-600/5 rounded-full blur-3xl" />
          </div>

          {/* View + Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {[{ id: 'list', Icon: List, label: 'Liste' }, { id: 'topology', Icon: Map, label: 'Topoloji' }].map(({ id, Icon, label }) => (
              <button key={id} onClick={() => setViewMode(id as ViewMode)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all ${viewMode === id ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' : 'bg-white/5 text-white/30 border-white/5 hover:bg-white/10'}`}>
                <Icon className="w-3.5 h-3.5" />{label}
              </button>
            ))}
            {selectedIp && (
              <div className="ml-auto flex items-center gap-1.5">
                <button onClick={() => wakeDevice(selectedDevice?.mac || '')} className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-bold text-emerald-400 hover:bg-emerald-500/20 transition-all">
                  <Power className="w-3 h-3" /> WoL
                </button>
                <button onClick={handleStartMitm} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[9px] font-bold border transition-all ${mitmStatus?.active && mitmStatus.mode === 'intercept' && mitmStatus.target_ip === selectedIp ? 'bg-red-500/20 text-red-400 border-red-500/30 animate-pulse' : 'bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/20'}`}>
                  <Radio className="w-3 h-3" /> MitM
                </button>
                <button onClick={handleIsolate} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[9px] font-bold border transition-all ${isolateActive && isolatedIp === selectedIp ? 'bg-orange-500/20 text-orange-400 border-orange-500/30 animate-pulse' : 'bg-orange-500/10 text-orange-400 border-orange-500/20 hover:bg-orange-500/20'}`}>
                  <WifiOff className="w-3 h-3" /> {isolateActive && isolatedIp === selectedIp ? 'BAĞLAN' : 'KOPAR'}
                </button>
                <button onClick={() => setShowIntel(true)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-[9px] font-bold text-indigo-400 hover:bg-indigo-500/20 transition-all">
                  <Eye className="w-3 h-3" /> DETAY
                </button>
              </div>
            )}
          </div>

          {/* Risk bar */}
          {devices.some(d => d.risk_score > 30) && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-red-500/5 border border-red-500/10 text-[10px]">
              <ShieldAlert className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
              <span className="text-red-300/70">{devices.filter(d => d.risk_score > 30).length} yüksek riskli: {devices.filter(d => d.risk_score > 30).slice(0, 3).map(d => d.ip).join(', ')}</span>
            </div>
          )}

          {/* Search */}
          <SearchBar value={searchQuery} onChange={setSearchQuery} filterLabel={filterLabel} onFilterLabel={setFilterLabel} totalDevices={devices.length} filteredCount={filteredDevices.length} />

          {/* Device list / topology */}
          <div className="flex-1 min-h-0">
            {viewMode === 'topology' ? (
              <NetworkTopology devices={devices} selectedIp={selectedIp} onSelectDevice={ip => setSelectedIp(ip === selectedIp ? null : ip)} />
            ) : (
              <div className="h-full overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                <AnimatePresence>
                  {filteredDevices.map((device, i) => (
                    <div key={device.ip} onClick={() => setSelectedIp(device.ip === selectedIp ? null : device.ip)} className={`cursor-pointer transition-all rounded-2xl ${device.ip === selectedIp ? 'ring-2 ring-indigo-500/40' : ''}`}>
                      <div className="relative">
                        <DeviceCard device={device} index={i} />
                        <div className="absolute bottom-3 right-10">
                          <DeviceLabelEditor
                            ip={device.ip}
                            currentLabel={localLabels[device.ip]?.label || ''}
                            currentNote={localLabels[device.ip]?.note || ''}
                            onUpdate={(label, note) => setLocalLabels(prev => ({ ...prev, [device.ip]: { label, note } }))}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </AnimatePresence>
                {filteredDevices.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center opacity-10 gap-3 text-center p-12 border-2 border-dashed border-white/5 rounded-3xl">
                    <Network className="w-14 h-14" />
                    <h3 className="text-lg font-bold">{searchQuery || filterLabel ? 'Sonuç Bulunamadı' : 'Tarama Bekleniyor'}</h3>
                    <p className="text-xs">Ctrl+S ile taramayı başlatın</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ===== RIGHT ===== */}
        <div className="w-[44%] flex flex-col gap-3">
          {/* Panel tabs */}
          <div className="flex gap-2">
            {[
              { id: 'traffic', label: 'Canlı Trafik', dot: isSniffing ? 'bg-indigo-400' : 'bg-red-400' },
              { id: 'secrets', label: 'Secrets', dot: credentials.length > 0 ? 'bg-amber-400 animate-pulse' : 'bg-white/10' },
              { id: 'alerts', label: 'Uyarılar', dot: unreadAlerts > 0 ? 'bg-red-400 animate-pulse' : 'bg-white/10' },
            ].map(({ id, label, dot }) => (
              <button key={id} onClick={() => setRightPanel(id as RightPanel)} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-bold border transition-all ${rightPanel === id ? 'bg-white/10 text-white border-white/10' : 'bg-white/5 text-white/30 border-white/5 hover:bg-white/10'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                {label}
                {id === 'alerts' && unreadAlerts > 0 && <span className="px-1 rounded bg-red-500/20 text-red-400 text-[8px]">{unreadAlerts}</span>}
              </button>
            ))}
          </div>

          {/* Sniffing control */}
          <div className="glass-panel p-3 rounded-2xl flex items-center justify-between border-white/5">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-lg ${isSniffing ? 'bg-indigo-500/20 text-indigo-400' : 'bg-red-500/20 text-red-400'}`}>
                <Activity className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-white/80">{isSniffing ? 'Dinleme Aktif' : 'Durduruldu'}</p>
                <p className="text-[9px] text-white/30">{packets.length} paket • Ctrl+S = Tara • Esc = Kapat</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handlePcapRecord} className={`px-2.5 py-1.5 rounded-xl text-[9px] font-bold border transition-all ${isRecordingPcap ? 'bg-red-500/20 text-red-400 border-red-500/30 animate-pulse' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/20'}`}>{isRecordingPcap ? 'KAYDEDİLİYOR' : 'PCAP KAYDET'}</button>
              <button onClick={() => setPackets([])} className="px-2.5 py-1.5 rounded-xl text-[9px] font-bold bg-white/5 border border-white/5 text-white/30 hover:bg-white/10 transition-all">TEMİZLE</button>
              <button onClick={toggleSniffing} className={`px-2.5 py-1.5 rounded-xl text-[9px] font-bold border transition-all ${isSniffing ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'}`}>{isSniffing ? 'DURDUR' : 'BAŞLAT'}</button>
            </div>
          </div>

          {/* Panel content */}
          <div className="flex-1 min-h-0">
            {rightPanel === 'traffic' && <TrafficLog packets={packets} filterIp={selectedIp} onClearFilter={() => setSelectedIp(null)} />}
            {rightPanel === 'secrets' && <SecretsVault credentials={credentials} onClear={() => setCredentials([])} />}
            {rightPanel === 'alerts' && <AlertSystem alerts={alerts} onDismiss={id => setAlerts(prev => prev.filter(a => a.id !== id))} onDismissAll={() => setAlerts([])} />}
          </div>
        </div>
      </div>

      {/* Intelligence Panel */}
      <AnimatePresence>
        {showIntel && selectedDevice && <IntelligencePanel device={selectedDevice} onClose={() => setShowIntel(false)} />}
      </AnimatePresence>

      {/* Toast notifications */}
      <div className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2 items-end">
        <AnimatePresence>
          {toasts.slice(0, 3).map(toast => (
            <AlertToast key={toast.id} alert={toast} onDismiss={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} />
          ))}
        </AnimatePresence>
      </div>

      {/* Error toast */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[201] px-5 py-3 rounded-2xl bg-red-500/10 border border-red-500/20 backdrop-blur-xl flex items-center gap-3 shadow-2xl">
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <span className="text-xs font-semibold text-red-200 max-w-xs">{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-white ml-2"><X className="w-4 h-4" /></button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default App
