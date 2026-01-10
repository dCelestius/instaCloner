"use client"

import { useRef, useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Check, Eye, Heart, MessageCircle, MoreVertical, Play, X, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatNumber } from "@/lib/format"

export interface Reel {
    id: string
    url: string
    thumbnail: string
    username: string
    views: number
    likes: number
    comments: number
    score: number
    status: "pending" | "approved" | "rejected"
    headerHeight?: number
}

interface VideoCardProps {
    reel: Reel
    onStatusChange: (id: string, status: "approved" | "rejected" | "pending") => void
}

export function VideoCard({ reel, onStatusChange }: VideoCardProps) {
    const videoRef = useRef<HTMLVideoElement>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [isHovered, setIsHovered] = useState(false)

    // Autoplay on hover logic
    useEffect(() => {
        let timeout: NodeJS.Timeout
        if (isHovered && videoRef.current) {
            timeout = setTimeout(() => {
                videoRef.current?.play().catch(() => { })
                setIsPlaying(true)
            }, 200) // Slight delay to prevent flashing
        } else if (videoRef.current) {
            videoRef.current.pause()
            videoRef.current.currentTime = 0
            setIsPlaying(false)
        }
        return () => clearTimeout(timeout)
    }, [isHovered])

    return (
        <motion.div
            layout
            className={cn(
                "relative group aspect-[9/16] rounded-xl overflow-hidden bg-slate-900 border transition-all duration-300",
                reel.status === "approved" && "ring-2 ring-green-500 border-transparent shadow-[0_0_20px_rgba(34,197,94,0.3)]",
                reel.status === "rejected" && "opacity-50 grayscale border-slate-700",
                reel.status === "pending" && "border-slate-800 hover:border-slate-600 shadow-md"
            )}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Video / Thumbnail */}
            <div className="absolute inset-0">
                <img
                    src={reel.thumbnail}
                    alt={`Reel ${reel.id}`}
                    className={cn(
                        "w-full h-full object-cover transition-opacity duration-500",
                        isPlaying ? "opacity-0" : "opacity-100"
                    )}
                />
                <video
                    ref={videoRef}
                    src={reel.url}
                    className="w-full h-full object-cover"
                    muted
                    loop
                    playsInline
                />
            </div>

            {/* Info Overlay (Always visible status) */}
            <div className="absolute top-2 right-2 z-10 flex flex-col gap-2 items-end">
                {reel.status === "approved" && (
                    <div className="bg-green-500 text-black p-1.5 rounded-full shadow-lg">
                        <Check className="w-3 h-3" />
                    </div>
                )}
            </div>

            {/* Username Overlay - Always Visible */}
            <div className="absolute bottom-2 left-2 z-10">
                <div className="bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[10px] font-medium text-white border border-white/10 shadow-sm truncate max-w-[100px]">
                    @{reel.username}
                </div>
            </div>

            {/* Hover Overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/0 to-black/90 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4 z-20">

                {/* Stats Row */}
                {/* Stats Row */}
                <div className="flex flex-col gap-2 mb-3 backdrop-blur-md bg-black/60 p-2.5 rounded-lg border border-white/10">
                    <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-3 text-xs text-slate-300 font-medium">
                            <span className="flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" /> {formatNumber(reel.views)}</span>
                            <span className="flex items-center gap-1.5"><Heart className="w-3.5 h-3.5" /> {formatNumber(reel.likes)}</span>
                        </div>
                    </div>

                    <div className="flex items-center justify-between w-full border-t border-white/5 pt-2 mt-0.5">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Quality Score</span>
                        <span className="text-emerald-400 font-bold font-mono text-sm">{formatNumber(reel.score)}</span>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-2">
                    <Button
                        variant={reel.status === 'rejected' ? 'destructive' : 'secondary'}
                        size="sm"
                        className="w-full bg-white/10 hover:bg-red-500/20 hover:text-red-500 border-white/5"
                        onClick={(e) => {
                            e.stopPropagation()
                            onStatusChange(reel.id, 'rejected')
                        }}
                    >
                        <X className="w-4 h-4 mr-1" /> Remove
                    </Button>

                    <Button
                        variant={reel.status === 'approved' ? 'default' : 'secondary'}
                        size="sm"
                        className={cn(
                            "w-full border-white/5",
                            reel.status === 'approved'
                                ? "bg-green-500 hover:bg-green-600 text-black border-transparent"
                                : "bg-white/10 hover:bg-green-500/20 hover:text-green-500"
                        )}
                        onClick={(e) => {
                            e.stopPropagation()
                            // Toggle approval logic could go here, but strictly setting
                            onStatusChange(reel.id, 'approved')
                        }}
                    >
                        <Check className="w-4 h-4 mr-1" /> Approve
                    </Button>
                </div>
            </div>

            {/* Processing Tag Example - Could be dynamic later */}
            {reel.headerHeight && (
                <div className="absolute top-2 left-2 bg-black/50 backdrop-blur text-[10px] px-2 py-0.5 rounded border border-white/10 text-slate-300">
                    H: {reel.headerHeight}px
                </div>
            )}
        </motion.div>
    )
}
