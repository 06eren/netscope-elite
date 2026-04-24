import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Shield, ShieldAlert, HelpCircle, Tag, StickyNote, 
  Check, Edit3, Save, X 
} from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'

interface DeviceLabelProps {
  ip: string
  currentLabel: string
  currentNote: string
  onUpdate: (label: string, note: string) => void
}

const LABELS = [
  { id: 'trusted', icon: Shield, label: 'Güvenilir', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  { id: 'suspicious', icon: ShieldAlert, label: 'Şüpheli', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  { id: 'unknown', icon: HelpCircle, label: 'Bilinmiyor', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
]

const DeviceLabelEditor: React.FC<DeviceLabelProps> = ({ ip, currentLabel, currentNote, onUpdate }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedLabel, setSelectedLabel] = useState(currentLabel)
  const [note, setNote] = useState(currentNote)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await invoke('set_device_label', { ip, label: selectedLabel })
      await invoke('set_device_note', { ip, note })
      onUpdate(selectedLabel, note)
      setIsOpen(false)
    } catch (err) {
      console.error(err)
    }
    setSaving(false)
  }

  const currentLabelInfo = LABELS.find(l => l.id === currentLabel)

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-bold border transition-all ${
          currentLabelInfo ? currentLabelInfo.bg + ' ' + currentLabelInfo.color : 'bg-white/5 border-white/10 text-white/30'
        } hover:opacity-80`}
      >
        {currentLabelInfo ? (
          <>
            <currentLabelInfo.icon className="w-3 h-3" />
            {currentLabelInfo.label}
          </>
        ) : (
          <>
            <Tag className="w-3 h-3" />
            Etiket
          </>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute top-full left-0 mt-1 z-50 w-56 rounded-2xl bg-slate-900 border border-white/10 shadow-2xl p-3 space-y-3"
          >
            {/* Label Selection */}
            <div className="space-y-1.5">
              <span className="text-[9px] text-white/30 uppercase font-bold tracking-widest block">Etiket Seç</span>
              {LABELS.map(l => (
                <button
                  key={l.id}
                  onClick={() => setSelectedLabel(selectedLabel === l.id ? '' : l.id)}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[10px] font-bold border transition-all ${
                    selectedLabel === l.id ? l.bg + ' ' + l.color : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'
                  }`}
                >
                  <l.icon className="w-3 h-3" />
                  {l.label}
                  {selectedLabel === l.id && <Check className="w-3 h-3 ml-auto" />}
                </button>
              ))}
            </div>

            {/* Note */}
            <div className="space-y-1">
              <span className="text-[9px] text-white/30 uppercase font-bold tracking-widest block">Not</span>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Cihaz hakkında not ekle..."
                rows={3}
                className="w-full px-2.5 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] text-white/70 placeholder:text-white/20 resize-none focus:outline-none focus:border-indigo-500/40 transition-all"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setIsOpen(false)}
                className="flex-1 py-1.5 rounded-xl bg-white/5 text-[9px] font-bold text-white/30 hover:bg-white/10 transition-all"
              >
                İptal
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-1.5 rounded-xl bg-indigo-500/20 text-[9px] font-bold text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/30 transition-all"
              >
                {saving ? '...' : 'Kaydet'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default DeviceLabelEditor
