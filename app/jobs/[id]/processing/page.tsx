"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Loader2, Download, CheckCircle, ArrowLeft, Play } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { getJob, createJobZip, cancelJob } from "@/app/actions"
import { cn } from "@/lib/utils"
import { SiteHeader } from "@/components/site-header"
import { ProcessedVideoCard } from "@/components/processed-video-card"

import { Skeleton } from "@/components/ui/skeleton"

export default function ProcessingPage() {
    const params = useParams()
    const router = useRouter()
    const jobId = params.id as string

    const [job, setJob] = useState<any>(null)
    const [processedReels, setProcessedReels] = useState<any[]>([])
    const [pendingReels, setPendingReels] = useState<any[]>([])
    const [progress, setProgress] = useState(0)
    const [isZipping, setIsZipping] = useState(false)
    const [status, setStatus] = useState("processing")

    useEffect(() => {
        let interval: NodeJS.Timeout
        let isDone = false

        async function checkStatus() {
            try {
                const latestJob = await getJob(jobId)
                if (latestJob) {
                    setJob(latestJob)
                    setStatus(latestJob.status || "processing")

                    const approved = latestJob.reels.filter((r: any) => r.status === "approved")
                    const processed = approved.filter((r: any) => r.processed_path)
                    const pending = approved.filter((r: any) => !r.processed_path)

                    setProcessedReels(processed)
                    setPendingReels(pending)

                    const pct = Math.round((processed.length / (approved.length || 1)) * 100)
                    setProgress(pct)

                    if (latestJob.status === "completed") {
                        isDone = true
                        clearInterval(interval)
                    }
                }
            } catch (err) {
                console.error("Failed to poll status", err)
            }
        }

        checkStatus()
        interval = setInterval(checkStatus, 3000) // Poll every 3s

        return () => {
            clearInterval(interval)
        }
    }, [jobId])

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

    if (!job) return (
        <div className="min-h-screen bg-black text-slate-50 flex flex-col pt-24 pb-8">
            <SiteHeader
                step={4}
                backUrl={`/jobs/${params.id}`}
                rightContent={<Skeleton className="h-4 w-32 bg-zinc-800" />}
            />
            <div className="flex-1 p-6 container max-w-7xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {[...Array(8)].map((_, i) => (
                        <div key={i} className="flex flex-col gap-2">
                            <Skeleton className="aspect-[9/16] rounded-xl bg-zinc-900 border border-white/5" />
                            <div className="px-1 flex justify-between items-center opacity-60">
                                <Skeleton className="h-3 w-20 bg-zinc-900" />
                                <Skeleton className="h-3 w-24 bg-zinc-900" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )

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
                        {/* Processed Cards (Animated In Sequentially) */}
                        {processedReels.map((reel) => (
                            <motion.div
                                key={reel.id}
                                layout
                                initial={{ opacity: 0, scale: 0.8, y: 50 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                transition={{
                                    type: "spring", stiffness: 300, damping: 30, mass: 0.8
                                }}
                                className="flex flex-col gap-2"
                            >
                                <ProcessedVideoCard
                                    reel={reel}
                                    jobId={params.id as string}
                                />
                                <div className="px-1 flex justify-between items-center opacity-60">
                                    <p className="text-[10px] font-mono text-zinc-500 truncate">REF: {reel.id}</p>
                                    <p className="text-[10px] font-medium text-emerald-500/80">@{reel.username}</p>
                                </div>
                            </motion.div>
                        ))}

                        {/* Pending Cards (Skeletons) */}
                        {pendingReels.map((reel) => (
                            <motion.div
                                key={reel.id}
                                layout
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex flex-col gap-2"
                            >
                                <div className="relative aspect-[9/16] rounded-xl overflow-hidden border border-white/5 bg-zinc-900/50 flex items-center justify-center group overflow-hidden">
                                    <Skeleton className="absolute inset-0 bg-zinc-900" />
                                    <div className="relative z-10 flex flex-col items-center gap-3">
                                        <div className="relative">
                                            <Loader2 className="w-8 h-8 text-emerald-500/20 animate-spin" />
                                            <Loader2 className="w-8 h-8 text-emerald-500 absolute inset-0 animate-pulse" />
                                        </div>
                                        <p className="text-[10px] font-bold text-emerald-500/40 uppercase tracking-widest animate-pulse">Processing...</p>
                                    </div>

                                    {/* Shimmer effect */}
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-shimmer" />
                                </div>
                                <div className="px-1 flex justify-between items-center opacity-40">
                                    <Skeleton className="h-3 w-16 bg-zinc-900" />
                                    <Skeleton className="h-3 w-20 bg-zinc-900" />
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
                @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
                .animate-progress {
                    animation: progress 1.5s infinite linear;
                }
                .animate-shimmer {
                    animation: shimmer 2s infinite linear;
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
