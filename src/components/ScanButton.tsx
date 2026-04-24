import React from 'react'
import { Radar, Square, Play } from 'lucide-react'
import { motion } from 'framer-motion'

interface ScanButtonProps {
  isScanning: boolean
  progress: number
  onScan: () => void
  onStop: () => void
}

const ScanButton: React.FC<ScanButtonProps> = ({ isScanning, progress, onScan, onStop }) => {
  return (
    <div className="relative flex flex-col items-center">
      {/* Background Ripple Animation */}
      {isScanning && (
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0.5 }}
            animate={{ scale: 2.2, opacity: 0 }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeOut" }}
            className="w-32 h-32 rounded-full bg-indigo-500/20 border border-indigo-500/30"
          />
          <motion.div 
            initial={{ scale: 0.8, opacity: 0.3 }}
            animate={{ scale: 1.8, opacity: 0 }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeOut", delay: 0.7 }}
            className="w-32 h-32 rounded-full bg-cyan-500/20 border border-cyan-500/30"
          />
        </div>
      )}

      {/* Main Button */}
      <button
        onClick={isScanning ? onStop : onScan}
        className={`relative w-28 h-28 rounded-full flex flex-col items-center justify-center gap-1.5 transition-all duration-500 z-10 ${
          isScanning 
            ? 'bg-red-500/10 border-red-500/30 text-red-400' 
            : 'bg-indigo-600/20 border-indigo-500/30 text-indigo-100 hover:bg-indigo-600/30 hover:scale-105 shadow-2xl shadow-indigo-500/20'
        } border-2 backdrop-blur-xl group`}
      >
        {isScanning ? (
          <>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
            >
              <Radar className="w-8 h-8" />
            </motion.div>
            <span className="text-[10px] font-bold tracking-tighter uppercase">Durdur</span>
          </>
        ) : (
          <>
            <div className="relative">
               <Play className="w-8 h-8 fill-current" />
               <motion.div 
                  className="absolute inset-0 text-indigo-400/30"
                  animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
                  transition={{ repeat: Infinity, duration: 2 }}
               >
                  <Play className="w-8 h-8 fill-current" />
               </motion.div>
            </div>
            <span className="text-[10px] font-bold tracking-tighter uppercase">Ağı Tara</span>
          </>
        )}

        {/* Progress Ring */}
        {isScanning && (
          <svg className="absolute inset-0 -rotate-90 w-full h-full p-1">
            <circle
              cx="54"
              cy="54"
              r="50"
              fill="transparent"
              stroke="currentColor"
              strokeWidth="3"
              strokeDasharray="314"
              strokeDashoffset={314 - (314 * progress) / 100}
              className="transition-all duration-300 opacity-20"
            />
          </svg>
        )}
      </button>

      {/* Progress Label */}
      {isScanning && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 flex flex-col items-center"
        >
          <span className="text-[10px] font-bold text-indigo-400 tracking-widest uppercase">Tarama Yapılıyor</span>
          <span className="text-2xl font-bold text-white tabular-nums">%{progress}</span>
        </motion.div>
      )}
    </div>
  )
}

export default ScanButton
