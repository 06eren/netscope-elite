import React, { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  X, 
  ShieldAlert, 
  Database, 
  Server, 
  Terminal, 
  Info, 
  ExternalLink,
  Zap,
  Activity,
  Cpu,
  Map,
  Skull,
  Eye,
  ShieldOff,
  Radio,
  Power
} from 'lucide-react'

export interface Device {
  ip: string
  mac: string
  hostname: string
  vendor: string
  latency_ms: number
  is_gateway: boolean
  open_ports: number[]
  os_type: string
  extra_info: Record<string, string>
  risk_score: number
  vulnerabilities: string[]
  shares: string[]
}

interface IntelligencePanelProps {
  device: Device | null
  onClose: () => void
}

const IntelligencePanel: React.FC<IntelligencePanelProps> = ({ device, onClose }) => {
  const [hops, setHops] = useState<{hop: number, ip: string, time: string}[]>([])
  const [isTracing, setIsTracing] = useState(false)
  const [isIsolated, setIsIsolated] = useState(false)
  const [isIntercepting, setIsIntercepting] = useState(false)
  const [interceptCount, setInterceptCount] = useState(0)

  useEffect(() => {
    setHops([])
    setIsTracing(false)
    setIsIsolated(false)
    setIsIntercepting(false)
    setInterceptCount(0)
  }, [device?.ip])

  useEffect(() => {
    const unlistenHop = listen<{hop: number, ip: string, time: string}>('traceroute-hop', (e) => {
      setHops(prev => [...prev, e.payload])
    })
    const unlistenEnd = listen('traceroute-complete', () => {
      setIsTracing(false)
    })
    const unlistenMitm = listen<any>('mitm-status', (e) => {
      if (device && e.payload.target_ip === device.ip) {
        setInterceptCount(e.payload.packets_intercepted)
      }
    })

    return () => {
      unlistenHop.then(f => f())
      unlistenEnd.then(f => f())
      unlistenMitm.then(f => f())
    }
  }, [device?.ip])

  const handleTrace = async () => {
    if (!device || isTracing) return
    setIsTracing(true)
    setHops([])
    try {
      await invoke('traceroute', { target: device.ip })
    } catch (e) {
      console.error(e)
      setIsTracing(false)
    }
  }

  const handleIsolate = async () => {
    if (!device) return
    try {
      if (isIsolated) {
        await invoke('stop_isolate')
        setIsIsolated(false)
      } else {
        await invoke('isolate_device', { target_ip: device.ip })
        setIsIsolated(true)
      }
    } catch (e) { console.error(e) }
  }

  const handleIntercept = async () => {
    if (!device) return
    try {
      if (isIntercepting) {
        await invoke('stop_mitm')
        setIsIntercepting(false)
      } else {
        await invoke('start_mitm', { target_ip: device.ip })
        setIsIntercepting(true)
      }
    } catch (e) { console.error(e) }
  }

  const handleWake = async () => {
    if (!device) return
    try {
      await invoke('wake_on_lan', { mac: device.mac })
    } catch (e) { console.error(e) }
  }

  if (!device) return null

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed top-0 right-0 h-full w-[400px] bg-slate-900/95 border-l border-white/10 backdrop-blur-2xl z-[100] shadow-2xl overflow-y-auto custom-scrollbar"
    >
      {/* Header */}
      <div className="p-6 border-b border-white/5 bg-indigo-500/5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-indigo-400" />
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">Derin İstihbarat</span>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4 text-white/50" />
          </button>
        </div>

        <h2 className="text-2xl font-bold text-white truncate">
          {device.hostname !== 'unknown' ? device.hostname : device.ip}
        </h2>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-xs font-mono text-indigo-300">{device.ip}</span>
          <div className="h-1 w-1 rounded-full bg-white/20" />
          <span className="text-xs text-white/40 uppercase font-bold tracking-widest">{device.os_type}</span>
        </div>
      </div>

      <div className="p-6 space-y-8">
        {/* Risk Assessment */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white/40 uppercase tracking-widest">Risk Analizi</span>
            <span className={`text-xs font-bold ${device.risk_score > 50 ? 'text-red-400' : 'text-emerald-400'}`}>
              %{device.risk_score} Kritiklik
            </span>
          </div>
          <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${device.risk_score}%` }}
              className={`h-full ${device.risk_score > 50 ? 'bg-red-500' : 'bg-indigo-500'}`}
            />
          </div>
        </div>

        {/* Offensive Controls */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-indigo-400">
            <Radio className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-widest">Ofansif Kontroller</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={handleIsolate}
              className={`flex flex-col items-center justify-center gap-3 p-4 rounded-2xl border transition-all duration-300 ${
                isIsolated 
                  ? 'bg-red-500/20 border-red-500 text-red-400 animate-pulse' 
                  : 'bg-white/5 border-white/10 text-white/40 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400'
              }`}
            >
              <Skull className={`w-6 h-6 ${isIsolated ? 'opacity-100' : 'opacity-40'}`} />
              <div className="text-center">
                <span className="text-[10px] font-bold uppercase block">Bağlantıyı Kes</span>
                <span className="text-[8px] opacity-50">{isIsolated ? 'PASİFLEŞTİR' : 'AĞDAN AT'}</span>
              </div>
            </button>

            <button 
              onClick={handleIntercept}
              className={`flex flex-col items-center justify-center gap-3 p-4 rounded-2xl border transition-all duration-300 ${
                isIntercepting 
                  ? 'bg-amber-500/20 border-amber-500 text-amber-400' 
                  : 'bg-white/5 border-white/10 text-white/40 hover:bg-amber-500/10 hover:border-amber-500/30 hover:text-amber-400'
              }`}
            >
              <Eye className={`w-6 h-6 ${isIntercepting ? 'opacity-100' : 'opacity-40'}`} />
              <div className="text-center">
                <span className="text-[10px] font-bold uppercase block">Trafiği İzle</span>
                <span className="text-[8px] opacity-50">{isIntercepting ? `${interceptCount} PAKET` : 'MİTM BAŞLAT'}</span>
              </div>
            </button>
          </div>
          
          <button 
            onClick={handleWake}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 hover:border-indigo-500/30 hover:text-indigo-400 transition-all group"
          >
            <Power className="w-4 h-4 opacity-40 group-hover:opacity-100" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Cihazı Uyandır (WoL)</span>
          </button>
        </div>

        {/* Vulnerabilities */}
        {device.vulnerabilities.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-red-400">
              <ShieldAlert className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-widest">Tespit Edilen Zayıflıklar</span>
            </div>
            <div className="space-y-2">
              {device.vulnerabilities.map((v, i) => (
                <div key={i} className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-200/80 leading-relaxed">
                  {v}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SMB Shares */}
        {device.shares.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-indigo-400">
              <Database className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-widest">Ağ Paylaşımları (SMB)</span>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {device.shares.map((s, i) => (
                <div key={i} className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
                  <span className="text-xs text-white/70 font-mono">{s}</span>
                  <ExternalLink className="w-3 h-3 text-white/20" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Service Banners */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-amber-400">
            <Server className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-widest">Servis İmzaları</span>
          </div>
          <div className="space-y-2">
            {Object.entries(device.extra_info).filter(([k]) => k.startsWith('Banner:')).map(([k, v]) => (
              <div key={k} className="p-3 rounded-xl bg-black/30 border border-white/5 font-mono text-[10px] leading-tight">
                <span className="text-white/30 block mb-1 uppercase tracking-tighter">PORT {k.split(':')[1]}</span>
                <span className="text-white/70 break-all">{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* System Info */}
        <div className="space-y-3 pt-4 border-t border-white/5">
          <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest block">Donanım ve Protokol Detayları</span>
          <div className="grid grid-cols-2 gap-3">
             <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <span className="text-[9px] text-white/30 block">ÜRETİCİ</span>
                <span className="text-[11px] text-white/70 font-medium truncate">{device.vendor}</span>
             </div>
             <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <span className="text-[9px] text-white/30 block">MAC ADRESİ</span>
                <span className="text-[11px] text-white/70 font-mono">{device.mac}</span>
             </div>
             <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <span className="text-[9px] text-white/30 block">GECİKME</span>
                <span className="text-[11px] text-emerald-400 font-mono">{device.latency_ms}ms</span>
             </div>
             <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <span className="text-[9px] text-white/30 block">PORT SAYISI</span>
                <span className="text-[11px] text-amber-400 font-mono">{device.open_ports.length} Açık</span>
             </div>
          </div>
        </div>

        {/* Traceroute */}
        <div className="space-y-3 mt-6 border-t border-white/5 pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-cyan-400">
              <Map className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-widest">Traceroute (Ağ Yolu)</span>
            </div>
            <button 
              onClick={handleTrace}
              disabled={isTracing}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${isTracing ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30 animate-pulse' : 'bg-white/5 text-white/50 border-white/10 hover:bg-white/10 hover:text-white'}`}
            >
              {isTracing ? 'İZLENİYOR...' : 'YOLU İZLE'}
            </button>
          </div>
          
          {hops.length > 0 && (
            <div className="space-y-1 bg-black/20 rounded-xl p-2 border border-white/5 max-h-[200px] overflow-y-auto custom-scrollbar">
              {hops.map((h, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors group">
                  <div className="flex items-center gap-3">
                    <span className="w-5 text-center text-[10px] font-bold text-white/20 group-hover:text-cyan-400/50">{h.hop}</span>
                    <span className="text-xs font-mono text-white/70">{h.ip}</span>
                  </div>
                  <span className={`text-[10px] font-mono ${h.time.includes('*') ? 'text-red-400/50' : 'text-emerald-400/80'}`}>{h.time}</span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </motion.div>
  )
}

export default IntelligencePanel
