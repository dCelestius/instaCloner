"use client"

import { useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle, Download, MessageCircle, Copy, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface Reel {
    id: string
    username: string
    local_video_path?: string
    processed_path?: string
    caption?: string
}

interface ProcessedVideoCardProps {
    reel: Reel
    jobId: string
    className?: string
}

export function ProcessedVideoCard({ reel, jobId, className }: ProcessedVideoCardProps) {
    const videoRef = useRef<HTMLVideoElement>(null)
    const [isCopied, setIsCopied] = useState(false)

    const baseVideoSrc = `/downloads/${jobId}/${reel.processed_path || reel.local_video_path}`
    // Add cache-buster to ensure we see the latest processed version
    const videoSrc = `${baseVideoSrc}?t=${new Date().getTime()}`

    const handleDownload = (e: React.MouseEvent) => {
        e.stopPropagation()
        const link = document.createElement('a')
        link.href = baseVideoSrc // Use base for download
        link.download = `${reel.id}.mp4`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const handleCopyCaption = (e: React.MouseEvent) => {
        e.stopPropagation()
        if (!reel.caption) return

        // Remove quotes if present
        const cleanCaption = reel.caption.replace(/^["']|["']$/g, '')
        navigator.clipboard.writeText(cleanCaption)

        setIsCopied(true)
        setTimeout(() => setIsCopied(false), 2000)
    }

    return (
        <div className={cn("flex flex-col gap-3 group/card", className)}>
            <div
                className={cn(
                    "relative aspect-[9/16] bg-black rounded-xl overflow-hidden border border-white/10 shadow-lg group-hover/card:border-emerald-500/50 transition-colors"
                )}
            >
                <video
                    ref={videoRef}
                    src={videoSrc}
                    className="w-full h-full object-cover opacity-90 group-hover/card:opacity-100 transition-opacity duration-500"
                    autoPlay
                    muted
                    loop
                    playsInline
                />

                {/* Ready Badge */}
                <div className="absolute top-3 right-3 z-20">
                    <div className="bg-emerald-500 text-black text-[9px] font-black px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-pulse uppercase tracking-wider">
                        <CheckCircle className="w-3 h-3" /> READY
                    </div>
                </div>

                {/* Download Button Overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-all duration-300 z-30 bg-black/40 backdrop-blur-[2px]">
                    <Button
                        size="lg"
                        className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded-full shadow-[0_0_30px_rgba(16,185,129,0.5)] py-6 px-10 transition-transform active:scale-95 scale-90 group-hover/card:scale-100"
                        onClick={handleDownload}
                    >
                        <Download className="w-5 h-5 mr-2.5" /> Download MP4
                    </Button>
                </div>

                {/* Darker Bottom Gradient for legibility */}
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
            </div>

            {/* Caption Container */}
            {reel.caption && (
                <div
                    className="relative bg-zinc-900/40 border border-white/5 rounded-lg p-3 transition-all duration-300 group-hover/card:border-emerald-500/30 group-hover/card:bg-zinc-900/60"
                >
                    <div className="flex items-start gap-2 pr-8">
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-500/50 mt-1 shrink-0" />
                        <p className="text-[11px] text-zinc-400 leading-relaxed italic line-clamp-2 transition-all duration-300 group-hover/card:line-clamp-none cursor-default selection:bg-emerald-500/30">
                            {reel.caption}
                        </p>
                    </div>

                    {/* Copy Button */}
                    <button
                        onClick={handleCopyCaption}
                        className={cn(
                            "absolute top-2 right-2 p-1.5 rounded-md transition-all duration-200 border border-transparent",
                            isCopied
                                ? "bg-emerald-500/20 text-emerald-500 border-emerald-500/20 scale-100 opacity-100"
                                : "text-zinc-500 hover:text-white hover:bg-white/5 opacity-0 group-hover/card:opacity-100 scale-90 hover:scale-100"
                        )}
                        title="Copy caption"
                    >
                        {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>

                    {/* Copied Toltip/Indicator */}
                    <AnimatePresence>
                        {isCopied && (
                            <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.8 }}
                                animate={{ opacity: 1, y: -20, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                className="absolute -top-6 right-2 bg-emerald-500 text-black text-[9px] font-bold px-2 py-0.5 rounded shadow-lg pointer-events-none"
                            >
                                COPIED!
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}
        </div>
    )
}
