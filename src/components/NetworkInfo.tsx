import { Globe, Router, Network } from 'lucide-react'

interface NetworkInfoProps {
  localIp: string
  gateway: string
  subnet: string
  deviceCount: number
  isScanning: boolean
}

export default function NetworkInfo({ localIp, gateway, subnet, deviceCount, isScanning }: NetworkInfoProps) {
  return (
    <div className="flex items-center gap-3 px-5 py-3 flex-shrink-0"
      style={{ borderBottom: '1px solid rgba(99,102,241,0.1)' }}>
      {/* Local IP */}
      <div className="stat-box flex-1">
        <div className="flex items-center gap-2 mb-1">
          <Globe className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-white/40 text-xs uppercase tracking-widest">Cihaz IP</span>
        </div>
        <span className="mono-text text-white/90 font-medium">
          {localIp || '—'}
        </span>
      </div>

      {/* Gateway */}
      <div className="stat-box flex-1">
        <div className="flex items-center gap-2 mb-1">
          <Router className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-white/40 text-xs uppercase tracking-widest">Modem</span>
        </div>
        <span className="mono-text text-cyan-300 font-medium">
          {gateway || '—'}
        </span>
      </div>

      {/* Subnet */}
      <div className="stat-box flex-1">
        <div className="flex items-center gap-2 mb-1">
          <Network className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-white/40 text-xs uppercase tracking-widest">Subnet</span>
        </div>
        <span className="mono-text text-purple-300 font-medium">
          {subnet || '—'}
        </span>
      </div>

      {/* Device Count */}
      <div className="stat-box flex-1">
        <div className="flex items-center gap-2 mb-1">
          <div className={`w-3.5 h-3.5 rounded-full ${isScanning ? 'bg-yellow-400 animate-pulse' : 'bg-emerald-400'}`} />
          <span className="text-white/40 text-xs uppercase tracking-widest">Cihazlar</span>
        </div>
        <span className="text-white/90 font-bold text-base">
          {deviceCount > 0 ? deviceCount : '—'}
        </span>
      </div>
    </div>
  )
}
