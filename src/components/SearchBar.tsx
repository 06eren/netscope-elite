import React from 'react'
import { Search, X, Filter, SlidersHorizontal } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface SearchBarProps {
  value: string
  onChange: (v: string) => void
  filterLabel: string
  onFilterLabel: (v: string) => void
  totalDevices: number
  filteredCount: number
}

const LABELS = [
  { id: '', label: 'Tümü', color: 'text-white/50' },
  { id: 'trusted', label: 'Güvenilir', color: 'text-emerald-400' },
  { id: 'suspicious', label: 'Şüpheli', color: 'text-red-400' },
  { id: 'unknown', label: 'Bilinmiyor', color: 'text-amber-400' },
]

const SearchBar: React.FC<SearchBarProps> = ({
  value, onChange, filterLabel, onFilterLabel, totalDevices, filteredCount
}) => {
  return (
    <div className="flex items-center gap-2">
      {/* Search input */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="IP, hostname, vendor ara..."
          className="w-full pl-9 pr-8 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white/80 placeholder:text-white/20 focus:outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-all"
        />
        {value && (
          <button
            onClick={() => onChange('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/60"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Label filters */}
      <div className="flex gap-1">
        {LABELS.map(l => (
          <button
            key={l.id}
            onClick={() => onFilterLabel(filterLabel === l.id ? '' : l.id)}
            className={`px-2 py-1.5 rounded-lg text-[9px] font-bold border transition-all ${
              filterLabel === l.id
                ? `bg-white/10 border-white/20 ${l.color}`
                : 'bg-white/3 border-white/5 text-white/25 hover:bg-white/8'
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>

      {/* Count */}
      <span className="text-[10px] text-white/20 font-mono flex-shrink-0">
        {filteredCount}/{totalDevices}
      </span>
    </div>
  )
}

export default SearchBar
