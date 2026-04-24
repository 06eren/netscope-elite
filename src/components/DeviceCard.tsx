import React, { useState } from 'react'
import { 
  ChevronRight, 
  ChevronDown, 
  Cpu, 
  Globe, 
  Copy, 
  Check, 
  Activity,
  Shield,
  Smartphone,
  Monitor,
  Wifi,
  Server,
  Terminal,
  ShieldAlert
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

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

interface DeviceCardProps {
  device: Device
  index: number
}

const DeviceCard: React.FC<DeviceCardProps> = ({ device, index }) => {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const getDeviceIcon = () => {
    if (device.is_gateway) return <Wifi className="w-5 h-5 text-indigo-400" />
    const os = device.os_type.toLowerCase()
    const host = device.hostname.toLowerCase()
    const vend = device.vendor.toLowerCase()
    if (os.includes('android') || os.includes('ios') || host.includes('phone') || vend.includes('apple')) return <Smartphone className="w-5 h-5 text-cyan-400" />
    if (os.includes('windows') || host.includes('desktop')) return <Monitor className="w-5 h-5 text-blue-400" />
    if (os.includes('linux') || device.open_ports.includes(22)) return <Terminal className="w-5 h-5 text-emerald-400" />
    if (device.open_ports.includes(80) || device.open_ports.includes(443)) return <Server className="w-5 h-5 text-amber-400" />
    return <Cpu className="w-5 h-5 text-slate-400" />
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="group relative overflow-hidden rounded-2xl transition-all duration-300 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-indigo-500/30 border-l-4 border-l-transparent hover:border-l-indigo-500"
    >
      <div className="p-4 flex items-center gap-4">
        <div className="p-2.5 rounded-xl bg-white/5 group-hover:bg-indigo-500/10 transition-colors">
          {getDeviceIcon()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white/90 truncate">
              {device.hostname !== 'unknown' ? device.hostname : (device.extra_info['Title'] || device.ip)}
            </h3>
            {device.risk_score > 0 && (
              <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border ${
                device.risk_score > 50 ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              }`}>
                <ShieldAlert className="w-2.5 h-2.5" />
                Risk: {device.risk_score}
              </div>
            )}
          </div>
          <p className="text-[10px] text-white/40 font-mono mt-0.5 flex items-center gap-2">
            {device.ip}
            <span className="opacity-40">•</span>
            {device.os_type}
          </p>
        </div>

        <div className="flex items-center gap-3 pr-2">
           <div className="flex flex-col items-end">
              <span className="text-[8px] text-white/20 uppercase font-bold tracking-widest">Gecikme</span>
              <span className="text-xs text-emerald-400/80 font-mono">{device.latency_ms}ms</span>
           </div>
           <div className="p-2 rounded-lg bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
              <ChevronRight className="w-4 h-4 text-white/40" />
           </div>
        </div>
      </div>

      {/* Quick Access to Stats */}
      <div className="px-4 pb-3 flex gap-2">
         {device.open_ports.slice(0, 3).map(p => (
           <span key={p} className="text-[8px] font-mono px-1.5 py-0.5 bg-black/20 text-white/40 rounded border border-white/5">
              P:{p}
           </span>
         ))}
         {device.open_ports.length > 3 && <span className="text-[8px] text-white/20">+{device.open_ports.length - 3} more</span>}
      </div>
    </motion.div>
  )
}

export default DeviceCard
