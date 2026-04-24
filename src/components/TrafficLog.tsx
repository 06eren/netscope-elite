import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Activity, Globe, Shield, Terminal, Filter, X } from 'lucide-react'

export interface CapturedPacket {
  source: string
  destination: string
  protocol: string
  length: number
  info: string
}

interface TrafficLogProps {
  packets: CapturedPacket[]
  filterIp: string | null
  onClearFilter: () => void
}

const TrafficLog: React.FC<TrafficLogProps> = ({ packets, filterIp, onClearFilter }) => {
  const filteredPackets = filterIp 
    ? packets.filter(p => p.source === filterIp || p.destination === filterIp)
    : packets

  const getProtocolIcon = (proto: string) => {
    switch (proto) {
      case 'DNS': return <Globe className="w-3 h-3 text-cyan-400" />
      case 'TCP': return <Terminal className="w-3 h-3 text-indigo-400" />
      case 'UDP': return <Activity className="w-3 h-3 text-emerald-400" />
      default: return <Shield className="w-3 h-3 text-slate-400" />
    }
  }

  return (
    <div className="flex flex-col h-full bg-black/40 rounded-3xl border border-white/5 overflow-hidden shadow-2xl">
      <div className="p-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
           <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-400 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-widest text-white/90">Canlı Trafik Analizi</span>
           </div>
           {filterIp && (
             <div className="flex items-center gap-1.5 text-[10px] text-indigo-300 font-mono">
                <Filter className="w-3 h-3" />
                Filtre: {filterIp}
             </div>
           )}
        </div>
        
        {filterIp ? (
          <button 
            onClick={onClearFilter}
            className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <div className="px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">
             <span className="text-[10px] font-mono text-indigo-300">DİNLENİYOR</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 font-mono text-[10px] space-y-1 custom-scrollbar">
        {filteredPackets.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center opacity-20 gap-3 italic text-center p-4">
            <Activity className="w-8 h-8 opacity-50" />
            {filterIp ? `${filterIp} için trafik bekleniyor...` : 'Ağ trafiği dinleniyor...'}
          </div>
        )}
        <AnimatePresence initial={false}>
          {filteredPackets.map((pkt, i) => (
            <motion.div
              key={`${pkt.source}-${pkt.destination}-${i}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`p-2 rounded-lg border transition-all ${
                pkt.source === filterIp || pkt.destination === filterIp 
                  ? 'bg-indigo-500/10 border-indigo-500/20 shadow-inner' 
                  : 'bg-white/5 border-white/5 hover:bg-white/10'
              } flex flex-col gap-1`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className={`px-1 rounded text-[9px] font-bold ${
                    pkt.protocol === 'DNS' ? 'bg-cyan-500/20 text-cyan-400' : 
                    pkt.protocol === 'TCP' ? 'bg-indigo-500/20 text-indigo-400' :
                    'bg-white/5 text-white/60'
                  }`}>
                    {pkt.protocol}
                  </span>
                  <span className={`truncate ${pkt.source === filterIp ? 'text-indigo-300 font-bold' : 'text-white/60'}`}>
                    {pkt.source}
                  </span>
                  <span className="text-white/20">→</span>
                  <span className={`truncate ${pkt.destination === filterIp ? 'text-indigo-300 font-bold' : 'text-white/60'}`}>
                    {pkt.destination}
                  </span>
                </div>
                <span className="text-white/10 text-[8px] flex-shrink-0">{pkt.length}B</span>
              </div>
              <div className="flex items-center gap-2 text-white/30 truncate italic">
                {getProtocolIcon(pkt.protocol)}
                <span className="truncate">{pkt.info}</span>
              </div>
            </motion.div>
          )).reverse()}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default TrafficLog
