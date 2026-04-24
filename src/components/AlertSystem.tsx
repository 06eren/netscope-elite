import React, { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldAlert, KeyRound, Wifi, Bell, X, AlertTriangle } from 'lucide-react'

export interface Alert {
  id: string
  type: 'new_device' | 'credential' | 'high_risk' | 'arp_change' | 'info'
  title: string
  body: string
  timestamp: string
  read: boolean
}

interface AlertSystemProps {
  alerts: Alert[]
  onDismiss: (id: string) => void
  onDismissAll: () => void
}

const ICONS: Record<Alert['type'], React.ReactNode> = {
  new_device: <Wifi className="w-4 h-4 text-cyan-400" />,
  credential: <KeyRound className="w-4 h-4 text-red-400" />,
  high_risk: <ShieldAlert className="w-4 h-4 text-amber-400" />,
  arp_change: <AlertTriangle className="w-4 h-4 text-orange-400" />,
  info: <Bell className="w-4 h-4 text-indigo-400" />,
}

const COLORS: Record<Alert['type'], string> = {
  new_device: 'border-cyan-500/20 bg-cyan-500/5',
  credential: 'border-red-500/30 bg-red-500/10',
  high_risk: 'border-amber-500/20 bg-amber-500/5',
  arp_change: 'border-orange-500/20 bg-orange-500/5',
  info: 'border-indigo-500/20 bg-indigo-500/5',
}

// Toast notification (bottom right, auto-dismiss)
export const AlertToast: React.FC<{ alert: Alert; onDismiss: () => void }> = ({ alert, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <motion.div
      initial={{ x: 100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 100, opacity: 0 }}
      className={`flex items-start gap-3 p-3 rounded-2xl border backdrop-blur-xl shadow-2xl w-[300px] ${COLORS[alert.type]}`}
    >
      <div className="flex-shrink-0 mt-0.5">{ICONS[alert.type]}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-white/90 truncate">{alert.title}</p>
        <p className="text-[10px] text-white/50 mt-0.5 leading-relaxed">{alert.body}</p>
      </div>
      <button onClick={onDismiss} className="flex-shrink-0 text-white/20 hover:text-white/50 transition-colors">
        <X className="w-3.5 h-3.5" />
      </button>
      {/* Progress bar */}
      <motion.div
        className="absolute bottom-0 left-0 h-0.5 bg-white/10 rounded-full"
        initial={{ width: '100%' }}
        animate={{ width: '0%' }}
        transition={{ duration: 5, ease: 'linear' }}
      />
    </motion.div>
  )
}

// Alert history panel
const AlertSystem: React.FC<AlertSystemProps> = ({ alerts, onDismiss, onDismissAll }) => {
  const unreadCount = alerts.filter(a => !a.read).length

  return (
    <div className="flex flex-col h-full bg-black/40 rounded-3xl border border-white/5 overflow-hidden">
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-indigo-400" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">Uyarılar</span>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[8px] font-bold">
              {unreadCount}
            </span>
          )}
        </div>
        {alerts.length > 0 && (
          <button onClick={onDismissAll} className="text-[9px] text-white/20 hover:text-white/50 transition-colors">
            Tümünü Temizle
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
        {alerts.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center opacity-20 gap-3 text-center p-6">
            <Bell className="w-8 h-8" />
            <p className="text-xs">Henüz uyarı yok</p>
          </div>
        )}
        <AnimatePresence>
          {alerts.map(alert => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className={`p-3 rounded-xl border ${COLORS[alert.type]} ${!alert.read ? 'ring-1 ring-white/10' : 'opacity-60'}`}
            >
              <div className="flex items-start gap-2">
                <div className="flex-shrink-0 mt-0.5">{ICONS[alert.type]}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-white/90">{alert.title}</p>
                  <p className="text-[9px] text-white/40 mt-0.5 leading-relaxed">{alert.body}</p>
                  <p className="text-[8px] text-white/20 mt-1 font-mono">{alert.timestamp}</p>
                </div>
                <button onClick={() => onDismiss(alert.id)} className="text-white/15 hover:text-white/40 transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default AlertSystem
