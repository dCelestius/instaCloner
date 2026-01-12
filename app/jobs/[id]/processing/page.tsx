"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Loader2, Download, CheckCircle, ArrowLeft, Play, FileVideo } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { getJob, createJobZip } from "@/app/actions"
import { cn } from "@/lib/utils"
import { SiteHeader } from "@/components/site-header"

export default function ProcessingPage() {
    const params = useParams()
    const router = useRouter()
    const [job, setJob] = useState<any>(null)
    const [processedReels, setProcessedReels] = useState<any[]>([])
    const [pendingReels, setPendingReels] = useState<any[]>([])
    const [progress, setProgress] = useState(0)
    const [isZipping, setIsZipping] = useState(false)
    const [status, setStatus] = useState("processing")

    useEffect(() => {
        let interval: NodeJS.Timeout

        async function checkStatus() {
            try {
                const latestJob = await getJob(params.id as string)
                if (latestJob) {
                    setJob(latestJob)
                    setStatus(latestJob.status || "processing")

                    const approved = latestJob.reels.filter((r: any) => r.status === "approved")
                    const processed = approved.filter((r: any) => r.processed_path)
                    const pending = approved.filter((r: any) => !r.processed_path)

                    setProcessedReels(processed)
                    setPendingReels(pending)

                    const pct = Math.round((processed.length / approved.length) * 100)
                    setProgress(pct)

                    if (latestJob.status === "completed") {
                        clearInterval(interval)
                    }
                }
            } catch (err) {
                console.error("Failed to poll status", err)
            }
        }

        checkStatus()
        interval = setInterval(checkStatus, 3000) // Poll every 3s
        return () => clearInterval(interval)
    }, [params.id])

    const handleDownload = async () => {
        setIsZipping(true)
        try {
            const url = await createJobZip(params.id as string)
            const link = document.createElement('a')
            link.href = url
            link.download = `batch_output.zip`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
        } catch (e) {
            console.error(e)
            alert("Download failed: " + (e instanceof Error ? e.message : "Try again"))
        } finally {
            setIsZipping(false)
        }
    }

    if (!job) return <div className="min-h-screen bg-black flex items-center justify-center text-slate-400 animate-pulse tracking-widest uppercase text-xs font-bold">Loading Job...</div>

    return (

        <div className="min-h-screen bg-black text-slate-50 flex flex-col pt-24 pb-8">
            <SiteHeader
                step={4}
                backUrl={`/jobs/${params.id}`}
                rightContent={
                    <div className="flex flex-col items-end w-48">
                        <div className="flex items-center gap-2 mb-1">
                            {status === 'completed' ? (
                                <span className="text-emerald-500 text-xs font-bold flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" /> COMPLETE
                                </span>
                            ) : (
                                <span className="text-slate-400 text-xs flex items-center gap-1">
                                    <Loader2 className="w-3 h-3 animate-spin" /> {Math.round(progress)}%
                                </span>
                            )}
                        </div>
                        <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-emerald-500 transition-all duration-500 ease-out"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                }
            />

            {/* Content Grid */}
            <div className="flex-1 p-6 container max-w-7xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">

                    <AnimatePresence mode="popLayout">
                        {/* Processed Cards (Animated In) */}
                        {processedReels.map((reel) => (
                            <motion.div
                                key={reel.id}
                                layout
                                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                transition={{ duration: 0.3 }}
                                className="group relative aspect-[9/16] bg-black rounded-xl overflow-hidden border border-white/10 shadow-lg hover:border-emerald-500/50 transition-colors"
                            >
                                <video
                                    src={`/downloads/${job.id}/${reel.processed_path || reel.local_video_path}`}
                                    className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                                    muted
                                    loop
                                    playsInline
                                    onMouseOver={(e) => e.currentTarget.play()}
                                    onMouseOut={(e) => e.currentTarget.pause()}
                                />

                                <div className="absolute top-2 right-2 z-20">
                                    <div className="bg-emerald-500 text-black text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-glow">
                                        <CheckCircle className="w-3 h-3" /> READY
                                    </div>
                                </div>

                                <div className="absolute bottom-0 left-0 w-full p-3 bg-gradient-to-t from-black/80 to-transparent">
                                    <p className="text-xs text-white truncate font-medium">{reel.id.slice(0, 8)}...</p>
                                </div>
                            </motion.div>
                        ))}

                        {/* Pending Cards (Skeletons) */}
                        {pendingReels.map((reel) => (
                            <motion.div
                                key={reel.id}
                                layout
                                initial={{ opacity: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="relative aspect-[9/16] bg-slate-900 rounded-xl overflow-hidden border border-dashed border-white/10 flex flex-col items-center justify-center p-4 gap-3 text-slate-600"
                            >
                                <div className="w-12 h-12 rounded-full border-2 border-slate-800 flex items-center justify-center animate-pulse">
                                    <FileVideo className="w-5 h-5 opacity-50" />
                                </div>
                                <div className="text-center">
                                    <p className="text-xs font-mono mb-1">Queue #{reel.id.slice(0, 4)}</p>
                                    <div className="h-1 w-16 bg-zinc-800 rounded-full overflow-hidden mx-auto">
                                        <div className="h-full w-1/2 bg-emerald-500/50 animate-progress" />
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>

                </div>
            </div>

            {/* Bottom Action Bar */}
            <div className={cn(
                "fixed bottom-0 left-0 w-full p-4 bg-black/90 backdrop-blur border-t border-white/10 flex justify-center gap-4 transition-transform duration-500 z-40",
                status === 'completed' ? "translate-y-0" : "translate-y-full"
            )}>
                <Button
                    variant="outline"
                    className="border-white/10 hover:bg-white/5 hover:text-white"
                    onClick={() => router.push(`/jobs/${params.id}`)}
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Review
                </Button>

                <Button
                    size="lg"
                    className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold shadow-glow-lg px-8"
                    onClick={handleDownload}
                    disabled={isZipping}
                >
                    {isZipping ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Compressing...
                        </>
                    ) : (
                        <>
                            <Download className="w-4 h-4 mr-2" /> Download All ({processedReels.length})
                        </>
                    )}
                </Button>
            </div>

            {/* Styles for custom animations if not in global css */}
            <style jsx global>{`
                @keyframes progress {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
                .animate-progress {
                    animation: progress 1.5s infinite linear;
                }
                .shadow-glow {
                    box-shadow: 0 0 10px rgba(16, 185, 129, 0.5);
                }
                .shadow-glow-lg {
                    box-shadow: 0 0 20px rgba(16, 185, 129, 0.4);
                }
            `}</style>
        </div>
    )
}
