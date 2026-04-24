import React from 'react'
import { X, Minus, Maximize2 } from 'lucide-react'
import { getCurrentWindow } from '@tauri-apps/api/window'

const TitleBar: React.FC = () => {
  const win = getCurrentWindow()
  
  return (
    <div 
      data-tauri-drag-region
      className="h-10 flex items-center px-4 bg-transparent select-none flex-shrink-0 border-b border-white/5"
    >
      <div className="flex items-center gap-2" data-tauri-drag-region>
        <div className="w-2.5 h-2.5 rounded-full bg-indigo-500/60" />
        <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.25em]">
          NetScope Elite v2.0
        </span>
      </div>
      <div className="ml-auto flex items-center gap-1">
        <button 
          onClick={() => win.minimize()}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/30 hover:text-white/70 transition-all"
        >
          <Minus className="w-3 h-3" />
        </button>
        <button 
          onClick={() => win.toggleMaximize()}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/30 hover:text-white/70 transition-all"
        >
          <Maximize2 className="w-3 h-3" />
        </button>
        <button 
          onClick={() => win.close()}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-all"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}

export default TitleBar
