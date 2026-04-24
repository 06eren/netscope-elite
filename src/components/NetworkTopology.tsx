import React, { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Wifi, Monitor, Smartphone, Server, Cpu } from 'lucide-react'

interface TopoDevice {
  ip: string
  hostname: string
  is_gateway: boolean
  os_type: string
  vendor: string
  risk_score: number
  open_ports: number[]
}

interface NetworkTopologyProps {
  devices: TopoDevice[]
  selectedIp: string | null
  onSelectDevice: (ip: string) => void
}

const DeviceNode: React.FC<{ device: TopoDevice; x: number; y: number; isSelected: boolean; onClick: () => void }> = ({ device, x, y, isSelected, onClick }) => {
  const getIcon = () => {
    if (device.is_gateway) return '🌐'
    const os = device.os_type.toLowerCase()
    const vend = device.vendor.toLowerCase()
    if (os.includes('android') || vend.includes('samsung')) return '📱'
    if (os.includes('ios') || vend.includes('apple')) return '📱'
    if (os.includes('windows')) return '🖥️'
    if (os.includes('linux')) return '🐧'
    if (device.open_ports.includes(80) || device.open_ports.includes(443)) return '🖥️'
    return '📡'
  }

  const riskColor = device.risk_score > 50 ? '#ef4444' : device.risk_score > 20 ? '#f59e0b' : '#22c55e'

  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      {/* Risk glow ring */}
      {device.risk_score > 0 && (
        <circle cx={x} cy={y} r={28} fill="none" stroke={riskColor} strokeWidth={2} opacity={0.3}>
          <animate attributeName="r" values="28;34;28" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.3;0.0;0.3" dur="2s" repeatCount="indefinite" />
        </circle>
      )}
      {/* Node background */}
      <circle cx={x} cy={y} r={24} fill={isSelected ? '#6366f1' : '#1e293b'} stroke={isSelected ? '#818cf8' : '#334155'} strokeWidth={2} />
      {/* Emoji icon */}
      <text x={x} y={y + 5} textAnchor="middle" fontSize={14}>{getIcon()}</text>
      {/* Risk score badge */}
      {device.risk_score > 0 && (
        <circle cx={x + 16} cy={y - 16} r={8} fill={riskColor} />
      )}
      {/* Label */}
      <text x={x} y={y + 40} textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize={9} fontFamily="monospace">
        {device.ip}
      </text>
    </g>
  )
}

const NetworkTopology: React.FC<NetworkTopologyProps> = ({ devices, selectedIp, onSelectDevice }) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const width = 900
  const height = 400
  const cx = width / 2
  const cy = height / 2 - 20

  const gateway = devices.find(d => d.is_gateway)
  const others = devices.filter(d => !d.is_gateway)

  const getPosition = (index: number, total: number) => {
    const radius = Math.min(160, 60 + total * 20)
    const angle = (index / total) * 2 * Math.PI - Math.PI / 2
    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    }
  }

  return (
    <div className="w-full h-full bg-black/30 rounded-3xl border border-white/5 overflow-hidden">
      <div className="p-4 border-b border-white/5 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">Ağ Topolojisi</span>
        <span className="ml-auto text-[10px] text-white/20">{devices.length} Cihaz</span>
      </div>
      <svg ref={svgRef} width="100%" height="calc(100% - 49px)" viewBox={`0 0 ${width} ${height}`}>
        {/* Draw lines from gateway to all devices */}
        {gateway && others.map((device, i) => {
          const pos = getPosition(i, others.length)
          return (
            <line
              key={device.ip}
              x1={cx} y1={cy}
              x2={pos.x} y2={pos.y}
              stroke={selectedIp === device.ip ? '#6366f1' : 'rgba(255,255,255,0.07)'}
              strokeWidth={selectedIp === device.ip ? 2 : 1}
              strokeDasharray={selectedIp === device.ip ? "4 2" : "none"}
            />
          )
        })}

        {/* Draw gateway node */}
        {gateway && (
          <DeviceNode
            device={gateway}
            x={cx} y={cy}
            isSelected={selectedIp === gateway.ip}
            onClick={() => onSelectDevice(gateway.ip)}
          />
        )}

        {/* Draw device nodes */}
        {others.map((device, i) => {
          const pos = getPosition(i, others.length)
          return (
            <DeviceNode
              key={device.ip}
              device={device}
              x={pos.x} y={pos.y}
              isSelected={selectedIp === device.ip}
              onClick={() => onSelectDevice(device.ip)}
            />
          )
        })}

        {/* Empty state */}
        {devices.length === 0 && (
          <text x={cx} y={cy} textAnchor="middle" fill="rgba(255,255,255,0.1)" fontSize={13} fontFamily="monospace">
            Tarama yapın...
          </text>
        )}
      </svg>
    </div>
  )
}

export default NetworkTopology
