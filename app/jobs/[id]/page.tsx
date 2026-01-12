"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { VideoGrid } from "@/components/video-grid"
import { VideoCard, type Reel } from "@/components/video-card"
import { cn } from "@/lib/utils"
import { SiteHeader } from "@/components/site-header"
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
        return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Loading reels...</div>
    }

    return (
        <div className="min-h-screen bg-black text-foreground flex flex-col pt-24">
            <SiteHeader
                step={2}
                backUrl="/"
                rightContent={
                    <div className="flex items-center gap-3">
                        <div className="hidden md:flex items-center gap-4 text-xs text-muted-foreground mr-2">
                            <span className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"></span>
                                {approvedCount}
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 opacity-60"></span>
                                {rejectedCount}
                            </span>
                        </div>

                        <Button
                            variant={approvedCount === 0 ? "secondary" : "default"}
                            disabled={approvedCount === 0 || isProcessing}
                            onClick={handleProcessConfirm}
                            size="sm"
                            className={cn(
                                "font-semibold transition-all h-8 text-xs",
                                approvedCount > 0 && "bg-emerald-500 hover:bg-emerald-600 text-black shadow-lg shadow-emerald-900/20"
                            )}
                        >
                            {isProcessing ? "Processing..." : `Process ${approvedCount}`}
                        </Button>
                    </div>
                }
            />

            {/* Main Content */}
            <main className="flex-1 p-4 md:p-8">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
                            Job #{params.id?.slice(0, 8)}
                        </h2>
                        <div className="flex items-center gap-2 mt-1">
                            <p className="text-xs text-muted-foreground">
                                <span className="font-medium text-foreground">@{reels[0]?.username || 'user'}</span>
                                <span className="mx-1">•</span>
                                {reels.length} Reels
                            </p>
                            {reels.length > 0 && reels[0].id.startsWith('mock-') && (
                                <span className="bg-amber-500/10 text-amber-500 text-[10px] px-2 py-0.5 rounded-full border border-amber-500/20 font-medium tracking-wide">SIMULATION</span>
                            )}
                        </div>
                    </div>
                </div>
                <VideoGrid>
                    {reels.map(reel => (
                        <VideoCard
                            key={reel.id}
                            reel={reel}
                            onStatusChange={handleStatusChange}
                            jobId={params.id as string}
                        />
                    ))}
                </VideoGrid>
            </main>
        </div>
    )
}
