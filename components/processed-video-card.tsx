"use client"

import { useRef } from "react"
import { motion } from "framer-motion"
import { CheckCircle, Download } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface Reel {
    id: string
    username: string
    local_video_path?: string
    processed_path?: string
}

interface ProcessedVideoCardProps {
    reel: Reel
    jobId: string
    className?: string
}

export function ProcessedVideoCard({ reel, jobId, className }: ProcessedVideoCardProps) {
    const videoRef = useRef<HTMLVideoElement>(null)
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

    return (
        <div
            className={cn(
                "group relative aspect-[9/16] bg-black rounded-xl overflow-hidden border border-white/10 shadow-lg hover:border-emerald-500/50 transition-colors",
                className
            )}
        >
            <video
                ref={videoRef}
                src={videoSrc}
                className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-500"
                autoPlay
                muted
                loop
                playsInline
            />

            {/* Ready Badge */}
            <div className="absolute top-4 right-4 z-20">
                <div className="bg-emerald-500 text-black text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1.5 shadow-[0_0_20px_rgba(16,185,129,0.6)] animate-pulse">
                    <CheckCircle className="w-3.5 h-3.5" /> READY
                </div>
            </div>

            {/* Download Button Overlay */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-30">
                <Button
                    size="lg"
                    className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded-full shadow-[0_0_30px_rgba(16,185,129,0.5)] py-6 px-10 transition-transform active:scale-95"
                    onClick={handleDownload}
                >
                    <Download className="w-5 h-5 mr-2.5" /> Download MP4
                </Button>
            </div>

            {/* Darker Bottom Gradient for legibility */}
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black via-black/40 to-transparent pointer-events-none" />
        </div>
    )
}
