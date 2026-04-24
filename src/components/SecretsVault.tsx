import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { KeyRound, Eye, EyeOff, AlertTriangle, X } from 'lucide-react'
import { useState } from 'react'

export interface Credential {
  source_ip: string
  dest_ip: string
  protocol: string
  username?: string
  password?: string
  raw: string
}

interface SecretsVaultProps {
  credentials: Credential[]
  onClear: () => void
}

const SecretsVault: React.FC<SecretsVaultProps> = ({ credentials, onClear }) => {
  const [revealedIndex, setRevealedIndex] = useState<number | null>(null)

  return (
    <div className="flex flex-col h-full bg-black/40 rounded-3xl border border-red-500/10 overflow-hidden shadow-2xl shadow-red-500/5">
      <div className="p-4 border-b border-red-500/10 bg-red-500/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-red-400" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-red-400/80">Secrets Vault</span>
          {credentials.length > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 text-[9px] font-bold">
              {credentials.length}
            </span>
          )}
        </div>
        {credentials.length > 0 && (
          <button onClick={onClear} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/30 hover:text-white/50 transition-all">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        {credentials.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center opacity-20 text-center gap-3 p-6">
            <KeyRound className="w-10 h-10" />
            <p className="text-xs">Kimlik bilgisi bekleniyor.<br/>HTTP/FTP trafiği izleniyor.</p>
          </div>
        )}

        <AnimatePresence>
          {[...credentials].reverse().map((cred, i) => {
            const isRevealed = revealedIndex === i
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="rounded-2xl bg-red-950/30 border border-red-500/20 overflow-hidden"
              >
                {/* Header */}
                <div className="p-3 flex items-center justify-between bg-red-500/5">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-red-500/20 text-red-400 uppercase">
                      {cred.protocol}
                    </span>
                    <span className="text-[10px] text-white/40 font-mono">{cred.source_ip} → {cred.dest_ip}</span>
                  </div>
                  <button
                    onClick={() => setRevealedIndex(isRevealed ? null : i)}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/30 hover:text-white/60 transition-all"
                  >
                    {isRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </button>
                </div>

                {/* Credentials */}
                <div className="p-3 space-y-2">
                  {cred.username && (
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-white/30 w-16 flex-shrink-0 uppercase font-bold">Kullanıcı</span>
                      <span className="text-xs font-mono text-amber-300/90">{cred.username}</span>
                    </div>
                  )}
                  {cred.password && (
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-white/30 w-16 flex-shrink-0 uppercase font-bold">Şifre</span>
                      <span className={`text-xs font-mono transition-all ${isRevealed ? 'text-red-300' : 'blur-[3px] select-none text-red-300'}`}>
                        {cred.password}
                      </span>
                    </div>
                  )}
                </div>

                {/* Raw Payload (when revealed) */}
                {isRevealed && (
                  <motion.div
                    initial={{ height: 0 }} animate={{ height: 'auto' }}
                    className="p-3 bg-black/30 border-t border-red-500/10"
                  >
                    <pre className="text-[8px] text-white/30 font-mono whitespace-pre-wrap break-all leading-relaxed max-h-24 overflow-y-auto">
                      {cred.raw}
                    </pre>
                  </motion.div>
                )}
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default SecretsVault
