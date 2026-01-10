"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Loader2, Download, CheckCircle, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getJob, createJobZip } from "@/app/actions"

export default function ProcessingPage() {
    const params = useParams()
    const router = useRouter()
    const [status, setStatus] = useState("processing")
    const [processedCount, setProcessedCount] = useState(0)
    const [totalCount, setTotalCount] = useState(0)
    const [isZipping, setIsZipping] = useState(false)

    useEffect(() => {
        let interval: NodeJS.Timeout

        async function checkStatus() {
            try {
                const job = await getJob(params.id as string)
                if (job) {
                    setStatus(job.status || "processing")

                    // Simple progress estimation or check if completed
                    const approved = job.reels.filter((r: any) => r.status === "approved")
                    setTotalCount(approved.length)

                    if (job.status === "completed") {
                        setProcessedCount(approved.length)
                        clearInterval(interval)
                    }
                }
            } catch (err) {
                console.error("Failed to poll status", err)
            }
        }

        // Initial check
        checkStatus()

        // Poll every 2 seconds
        interval = setInterval(checkStatus, 2000)
        return () => clearInterval(interval)
    }, [params.id])

    const handleDownload = async () => {
        setIsZipping(true)
        try {
            const url = await createJobZip(params.id as string)
            // Trigger download
            const link = document.createElement('a')
            link.href = url
            link.download = `batch_output.zip`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
        } catch (e) {
            console.error(e)
            alert("Download failed: " + (e instanceof Error ? e.message : "Unknown error"))
        } finally {
            setIsZipping(false)
        }
    }

    return (
        <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center justify-center p-4">
            <div className="max-w-md w-full text-center space-y-8">

                {status === "processing" ? (
                    <>
                        <div className="relative w-24 h-24 mx-auto">
                            <div className="absolute inset-0 border-4 border-slate-800 rounded-full"></div>
                            <div className="absolute inset-0 border-4 border-emerald-500 rounded-full border-t-transparent animate-spin"></div>
                            <Loader2 className="absolute inset-0 m-auto w-8 h-8 text-emerald-500 animate-pulse" />
                        </div>

                        <div className="space-y-2">
                            <h2 className="text-2xl font-bold tracking-tight">Processing Videos...</h2>
                            <p className="text-slate-400">
                                Applying header overlays to your batch. <br />
                                This may take a few minutes.
                            </p>
                        </div>
                    </>
                ) : status === "completed" ? (
                    <>
                        <div className="w-24 h-24 mx-auto bg-emerald-500/20 rounded-full flex items-center justify-center border-2 border-emerald-500">
                            <CheckCircle className="w-10 h-10 text-emerald-500" />
                        </div>

                        <div className="space-y-4">
                            <h2 className="text-2xl font-bold tracking-tight text-white mb-2">Batch Complete!</h2>
                            <p className="text-slate-400">
                                Successfully processed {processedCount} videos.
                            </p>

                            <div className="grid gap-3 pt-4">
                                <Button
                                    size="lg"
                                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-semibold"
                                    onClick={handleDownload}
                                    disabled={isZipping}
                                >
                                    <Download className="w-4 h-4 mr-2" />
                                    {isZipping ? "Zipping..." : "Download All (ZIP)"}
                                </Button>

                                <Button
                                    variant="outline"
                                    className="w-full border-white/10 hover:bg-white/5 hover:text-white"
                                    onClick={() => router.push(`/jobs/${params.id}`)}
                                >
                                    <ArrowLeft className="w-4 h-4 mr-2" />
                                    Back to Review
                                </Button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="text-red-400">Unknown Status: {status}</div>
                )}

            </div>
        </div>
    )
}
