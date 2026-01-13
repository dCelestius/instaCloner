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
    layout?: { y: number, h: number, correction: number, width?: number, height?: number }
    generated_headline?: string
}

interface ProcessedVideoCardProps {
    reel: Reel
    jobId: string
    className?: string
    previewCorrection?: number | null
    jobConfig?: any
}

export function ProcessedVideoCard({ reel, jobId, className, previewCorrection = null, jobConfig }: ProcessedVideoCardProps) {
    const videoRef = useRef<HTMLVideoElement>(null)
    const [isCopied, setIsCopied] = useState(false)

    // Preview Mode Logic
    const isPreview = previewCorrection !== null
    // If previewing, fallback to local (original) path so we see the raw video + overlay
    const baseVideoSrc = isPreview
        ? `/downloads/${jobId}/${reel.local_video_path}`
        : `/downloads/${jobId}/${reel.processed_path || reel.local_video_path}`

    // Add cache-buster to ensure we see the latest processed version
    const videoSrc = `${baseVideoSrc}?t=${new Date().getTime()}`

    // Calculate simulated overlay position
    // Use stored layout if available, otherwise guess generic 15%
    const baselineY = reel.layout ? (reel.layout.y - (reel.layout.correction || 0)) : 0
    const baselineH = reel.layout ? reel.layout.h : 250 // Fallback px height
    const baseWidth = reel.layout?.width || 1080
    const baseHeight = reel.layout?.height || 1920

    // Apply correction (inverted? No, + goes down, - goes up usually)
    const previewY = baselineY + (previewCorrection || 0)

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
                style={{ containerType: 'size' }}
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


                {/* PREVIEW OVERLAY BOX (Simulated Design) */}
                {isPreview && jobConfig && (
                    <div
                        className="absolute inset-x-0 z-40 pointer-events-none transition-all duration-200 ease-out flex flex-col items-start px-2 py-1"
                        style={{
                            top: `${(previewY / baseHeight) * 100}%`,
                            height: `${(baselineH / baseHeight) * 100}%`,
                            backgroundColor: jobConfig.bannerColor || '#000000',
                            fontFamily: 'sans-serif' // Fallback, we'd need to load fonts but standard sans is close enough for preview
                        }}
                    >
                        {/* This structure mimics generate_design_overlay roughly */}
                        <div className="flex items-center gap-3 w-full" style={{ paddingTop: '2%' }}>
                            {/* Logo Proxy */}
                            <div
                                className="rounded-full bg-black shrink-0 overflow-hidden relative"
                                style={{
                                    width: `${jobConfig.logoSize || 15}%`,
                                    aspectRatio: '1/1',
                                    border: '1px solid rgba(255,255,255,0.1)'
                                }}
                            >
                                {/* Use actual logo if available */}
                                <img
                                    src={`/downloads/${jobId}/logo.png`}
                                    alt="Logo"
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        e.currentTarget.style.display = 'none'
                                        e.currentTarget.parentElement!.style.backgroundColor = 'rgba(255,255,255,0.1)'
                                    }}
                                />
                            </div>

                            <div className="flex flex-col min-w-0 flex-1 justify-center translate-y-[2px]">
                                <h3 className="font-bold text-white leading-tight truncate flex items-center gap-1" style={{ fontSize: `${((jobConfig.nameFontSize || 18) * 1.35) / 3.8}cqw` }}>
                                    {jobConfig.designName || jobConfig.name || "user"}
                                    {/* Verified Badge */}
                                    {/* Matches process_batch.py: public/Twitter_Verified_Badge_Gold.svg.png */}
                                    <img
                                        src="/Twitter_Verified_Badge_Gold.svg.png"
                                        alt="Verified"
                                        className="w-[1em] h-[1em] object-contain"
                                    />
                                </h3>
                                <p className="text-white/60 font-medium truncate" style={{ fontSize: `${((jobConfig.handleFontSize || 14) * 1.35) / 3.8}cqw` }}>
                                    @{jobConfig.designHandle || jobConfig.handle || reel.username}
                                </p>
                            </div>
                        </div>

                        {/* Headline */}
                        {(jobConfig.showHeadline ?? true) && (
                            <div className="mt-2 w-full">
                                <h2
                                    className="font-bold text-white leading-[1.3]"
                                    style={{
                                        fontSize: `${((jobConfig.headlineFontSize || 24) * 1.35) / 3.8}cqw`,
                                        color: jobConfig.headlineColor || '#ffffff',
                                        wordWrap: 'break-word'
                                    }}
                                >
                                    {jobConfig.headlineMode === 'manual'
                                        ? (jobConfig.manualHeadline || "Your Headline Here")
                                        : (reel.generated_headline || "AI Headline Pending...")}
                                </h2>
                            </div>
                        )}

                        {/* Green Indicator Border (Visible only on hover or always to show it's active) */}
                        <div className="absolute inset-0 border-2 border-emerald-500/50 pointer-events-none" />

                    </div>
                )}

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
