"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { VideoGrid } from "@/components/video-grid"
import { VideoCard, type Reel } from "@/components/video-card"
import { cn } from "@/lib/utils"
// We import the server action to fetch data
import { getJob } from "@/app/actions"

export default function JobPage() {
    const params = useParams()
    const router = useRouter()
    const [reels, setReels] = useState<Reel[]>([])
    const [loading, setLoading] = useState(true)
    const [isProcessing, setIsProcessing] = useState(false)

    useEffect(() => {
        async function fetchData() {
            try {
                const job = await getJob(params.id as string)
                if (job && job.reels) {
                    setReels(job.reels)
                }
            } catch (err) {
                console.error("Failed to fetch job", err)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [params.id])

    const handleStatusChange = (id: string, status: "approved" | "rejected" | "pending") => {
        setReels(prev => prev.map(r => r.id === id ? { ...r, status } : r))
    }

    const approvedCount = reels.filter(r => r.status === "approved").length
    const rejectedCount = reels.filter(r => r.status === "rejected").length

    const handleProcessConfirm = () => {
        // Navigate to configuration page
        router.push(`/jobs/${params.id}/configure`)
    }

    if (loading) {
        return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Loading reals...</div>
    }

    return (
        <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col">
            {/* Header Bar */}
            <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-slate-950/80 backdrop-blur supports-[backdrop-filter]:bg-slate-950/60">
                <div className="flex h-16 items-center px-4 md:px-8 justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => router.push("/")} className="text-slate-400 hover:text-white">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <div>
                            <h2 className="text-lg font-semibold tracking-tight">Job #{params.id?.slice(0, 8)}</h2>
                            <div className="flex items-center gap-2">
                                <p className="text-xs text-slate-400">@{reels[0]?.username || 'user'} • {reels.length} Reels Scraped</p>
                                {/* Check if job is mock - we need to pass this prop or infer it. 
                                    For now, we infer if all IDs start with 'mock-' */}
                                {reels.length > 0 && reels[0].id.startsWith('mock-') && (
                                    <span className="bg-amber-500/20 text-amber-500 text-[10px] px-2 py-0.5 rounded border border-amber-500/20 font-medium">SIMULATION MODE</span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="hidden md:flex items-center gap-4 text-sm text-slate-400 mr-4">
                            <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> {approvedCount} Approved</span>
                            <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500"></div> {rejectedCount} Rejected</span>
                        </div>

                        <Button
                            variant="default"
                            disabled={approvedCount === 0 || isProcessing}
                            onClick={handleProcessConfirm}
                            className={cn(
                                "bg-emerald-500 hover:bg-emerald-600 text-black font-semibold transition-all",
                                approvedCount === 0 && "opacity-50 cursor-not-allowed grayscale"
                            )}
                        >
                            {isProcessing ? "Processing..." : `Process ${approvedCount} Videos`}
                        </Button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1">
                <VideoGrid>
                    {reels.map(reel => (
                        <VideoCard
                            key={reel.id}
                            reel={reel}
                            onStatusChange={handleStatusChange}
                        />
                    ))}
                </VideoGrid>
            </main>
        </div>
    )
}
