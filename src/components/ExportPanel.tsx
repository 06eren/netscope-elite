import React, { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Download, FileJson, FileText, X, Check, Loader } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface ExportPanelProps {
  deviceCount: number
}

type ExportState = 'idle' | 'loading' | 'done' | 'error'

const ExportPanel: React.FC<ExportPanelProps> = ({ deviceCount }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [exportState, setExportState] = useState<ExportState>('idle')
  const [lastExport, setLastExport] = useState('')

  const handleExport = async (format: 'json' | 'csv') => {
    setExportState('loading')
    try {
      // Build a file path in the Downloads folder
      const filename = `netscope_report_${new Date().toISOString().replace(/[:.]/g, '-')}.${format}`
      const downloadsPath = `${window.navigator.userAgent.includes('Windows') ? 'C:\\Users' : '/Users'}\\${Date.now()}\\Downloads\\${filename}`
      
      // Use a simpler path based on the browser's download
      const tmpPath = `C:\\Users\\Public\\${filename}`
      
      if (format === 'json') {
        await invoke('export_devices_json', { path: tmpPath })
      } else {
        await invoke('export_devices_csv', { path: tmpPath })
      }
      
      setLastExport(tmpPath)
      setExportState('done')
      setTimeout(() => setExportState('idle'), 3000)
    } catch (err) {
      console.error(err)
      setExportState('error')
      setTimeout(() => setExportState('idle'), 3000)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold text-white/50 hover:bg-white/10 hover:text-white/70 transition-all"
      >
        <Download className="w-3.5 h-3.5" />
        EXPORT
        {deviceCount > 0 && (
          <span className="px-1 py-0.5 rounded bg-white/10 text-[8px] font-mono">{deviceCount}</span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full right-0 mt-2 z-50 w-60 rounded-2xl bg-slate-900 border border-white/10 shadow-2xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Dışa Aktar</span>
                <button onClick={() => setIsOpen(false)} className="text-white/20 hover:text-white/50">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-2">
                {[
                  { format: 'json' as const, Icon: FileJson, label: 'JSON', desc: 'Tüm veri, makine okunabilir' },
                  { format: 'csv' as const, Icon: FileText, label: 'CSV', desc: 'Excel\'de açılır' },
                ].map(({ format, Icon, label, desc }) => (
                  <button
                    key={format}
                    onClick={() => handleExport(format)}
                    disabled={exportState === 'loading' || deviceCount === 0}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/15 transition-all text-left disabled:opacity-40"
                  >
                    <Icon className="w-5 h-5 text-indigo-400 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-white/80">{label}</p>
                      <p className="text-[9px] text-white/30">{desc}</p>
                    </div>
                    {exportState === 'loading' && <Loader className="w-3 h-3 animate-spin text-white/30 ml-auto" />}
                    {exportState === 'done' && <Check className="w-3 h-3 text-emerald-400 ml-auto" />}
                  </button>
                ))}
              </div>

              {exportState === 'done' && lastExport && (
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <p className="text-[9px] text-emerald-400 font-mono break-all">✓ {lastExport}</p>
                </div>
              )}
              {exportState === 'error' && (
                <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20">
                  <p className="text-[9px] text-red-400">Export başarısız. Tarama yapıldı mı?</p>
                </div>
              )}

              {deviceCount === 0 && (
                <p className="text-[9px] text-white/20 text-center italic">Önce bir tarama yapın</p>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

export default ExportPanel
