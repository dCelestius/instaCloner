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
    const videoSrc = `/downloads/${jobId}/${reel.processed_path || reel.local_video_path}`

    const handleDownload = (e: React.MouseEvent) => {
        e.stopPropagation()
        const link = document.createElement('a')
        link.href = videoSrc
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
                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-500"
                autoPlay
                muted
                loop
                playsInline
            />

            {/* Ready Badge */}
            <div className="absolute top-2 right-2 z-20">
                <div className="bg-emerald-500 text-black text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-pulse">
                    <CheckCircle className="w-3 h-3" /> READY
                </div>
            </div>

            {/* Download Button Overlay */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-30">
                <Button
                    size="sm"
                    className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded-full shadow-glow py-5 px-6"
                    onClick={handleDownload}
                >
                    <Download className="w-4 h-4 mr-2" /> Download
                </Button>
            </div>

            {/* User Overlay */}
            <div className="absolute bottom-3 left-3 z-10">
                <div className="bg-black/60 backdrop-blur-md px-2 py-1 rounded-md text-[10px] font-medium text-white border border-white/10">
                    @{reel.username}
                </div>
            </div>

            {/* Bottom Gradient Overlay */}
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black via-black/40 to-transparent opacity-60 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

            <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <p className="text-[10px] text-zinc-400 font-mono italic">#{reel.id.slice(0, 8)}</p>
            </div>
        </div>
    )
}
