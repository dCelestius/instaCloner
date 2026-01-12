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
    filename_base?: string
    local_video_path?: string
}

interface VideoCardProps {
    reel: Reel
    onStatusChange: (id: string, status: "approved" | "rejected" | "pending") => void
    jobId?: string
}

export function VideoCard({ reel, onStatusChange, jobId }: VideoCardProps) {
    const videoRef = useRef<HTMLVideoElement>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [isHovered, setIsHovered] = useState(false)
    const [imgError, setImgError] = useState(false)
    const [imgLoaded, setImgLoaded] = useState(false)

    // Smart Fallback State
    // Default to the provided URL, but if it fails, try the Source Folder
    const [currentThumb, setCurrentThumb] = useState(reel.thumbnail)

    const handleImgError = () => {
        // If we simply failed to part metadata or file not found
        // Try fallback to the known source folder if we haven't already
        const SOURCE_ID = "0a4c50d9-b8c5-40ff-8ac4-b0449c6d446d"

        if (reel.filename_base && !currentThumb.includes(SOURCE_ID)) {
            console.log(`VideoCard ${reel.id}: 404 on local. Falling back to source: ${SOURCE_ID}`)
            setCurrentThumb(`/downloads/${SOURCE_ID}/${reel.filename_base}.jpg`)
        } else {
            setImgError(true)
        }
    }

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
                "relative group aspect-[9/16] rounded-xl overflow-hidden bg-card border border-border transition-all duration-300",
                reel.status === "approved" && "ring-2 ring-emerald-500 border-transparent shadow-[0_0_20px_rgba(16,185,129,0.2)]",
                reel.status === "rejected" && "opacity-50 grayscale border-border",
                reel.status === "pending" && "hover:border-primary/50 shadow-sm"
            )}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Video / Thumbnail */}
            <div className="absolute inset-0 bg-muted/50 flex items-center justify-center">
                {!imgError && !imgLoaded && (
                    <div className="absolute inset-0 bg-muted animate-pulse" />
                )}

                {!imgError ? (
                    <img
                        src={currentThumb}
                        alt={`Reel ${reel.id}`}
                        onError={handleImgError}
                        onLoad={() => setImgLoaded(true)}
                        className={cn(
                            "w-full h-full object-cover transition-opacity duration-500",
                            isPlaying ? "opacity-0" : "opacity-100",
                            !imgLoaded && "opacity-0"
                        )}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center text-muted-foreground p-4 text-center">
                        <MoreVertical className="w-8 h-8 mb-2 opacity-50" />
                        <span className="text-[10px]">Image Unavailable</span>
                    </div>
                )}

                <video
                    ref={videoRef}
                    src={reel.url}
                    className="absolute inset-0 w-full h-full object-cover"
                    muted
                    loop
                    playsInline
                />
            </div>

            {/* Info Overlay (Always visible status) */}
            <div className="absolute top-2 right-2 z-10 flex flex-col gap-2 items-end">
                {reel.status === "approved" && (
                    <div className="bg-emerald-500 text-white p-1 rounded-full shadow-lg">
                        <Check className="w-3 h-3" />
                    </div>
                )}
            </div>

            {/* Username Overlay - Always Visible */}
            <div className="absolute bottom-2 left-2 z-10 max-w-[calc(100%-1rem)]">
                <div className="bg-black/60 backdrop-blur-md px-2 py-1 rounded-md text-[10px] font-medium text-white border border-white/10 shadow-sm truncate">
                    @{reel.username}
                </div>
            </div>

            {/* Hover Overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/0 to-black/90 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4 z-20">

                {/* Stats Row */}
                <div className="flex flex-col gap-2 mb-3 backdrop-blur-md bg-black/60 p-2.5 rounded-lg border border-white/10">
                    <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-3 text-xs text-slate-200 font-medium">
                            <span className="flex items-center gap-1.5"><Eye className="w-3.5 h-3.5 text-slate-400" /> {formatNumber(reel.views)}</span>
                            <span className="flex items-center gap-1.5"><Heart className="w-3.5 h-3.5 text-slate-400" /> {formatNumber(reel.likes)}</span>
                        </div>
                    </div>

                    <div className="flex items-center justify-between w-full border-t border-white/10 pt-2 mt-0.5">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Quality Score</span>
                        <span className="text-emerald-400 font-bold font-mono text-sm">{formatNumber(reel.score)}</span>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-2">
                    <Button
                        variant={reel.status === 'rejected' ? 'destructive' : 'secondary'}
                        size="sm"
                        className="w-full bg-white/10 hover:bg-red-500/20 hover:text-red-500 border-white/5 h-8 text-xs"
                        onClick={(e) => {
                            e.stopPropagation()
                            onStatusChange(reel.id, 'rejected')
                        }}
                    >
                        <X className="w-3.5 h-3.5 mr-1.5" /> Remove
                    </Button>

                    <Button
                        variant={reel.status === 'approved' ? 'default' : 'secondary'}
                        size="sm"
                        className={cn(
                            "w-full border-white/5 h-8 text-xs",
                            reel.status === 'approved'
                                ? "bg-emerald-600 hover:bg-emerald-700 text-white border-transparent"
                                : "bg-white/10 hover:bg-emerald-500/20 hover:text-emerald-500"
                        )}
                        onClick={(e) => {
                            e.stopPropagation()
                            onStatusChange(reel.id, 'approved')
                        }}
                    >
                        <Check className="w-3.5 h-3.5 mr-1.5" /> Approve
                    </Button>
                </div>
            </div>

            {/* Processing Tag Example */}
            {reel.headerHeight && (
                <div className="absolute top-2 left-2 bg-background/80 backdrop-blur text-[10px] px-2 py-0.5 rounded border border-border text-foreground font-mono">
                    H: {reel.headerHeight}px
                </div>
            )}
        </motion.div>
    )
}
