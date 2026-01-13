"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Loader2, ArrowLeft, ArrowRight, Sparkles, CheckCircle, Copy, RefreshCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { SiteHeader } from "@/components/site-header"
import { getJob, generateCaptionWithGemini, updateJobReelCaptions } from "@/app/actions"
import { cn } from "@/lib/utils"

export default function CaptionsPage() {
    const params = useParams()
    const router = useRouter()
    const jobId = params.id as string

    const [job, setJob] = useState<any>(null)
    const [reels, setReels] = useState<any[]>([])
    const [captions, setCaptions] = useState<Record<string, string>>({})
    const [selectedReels, setSelectedReels] = useState<Set<string>>(new Set())

    // Gemini State
    const [geminiApiKey, setGeminiApiKey] = useState("")
    const [isGenerating, setIsGenerating] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        async function loadJob() {
            const data = await getJob(jobId)
            if (data) {
                setJob(data)
                // Filter processed reels
                const validReels = (data.reels || []).filter((r: any) =>
                    r.status === 'approved' && r.processed_path
                )
                setReels(validReels)

                // Initialize captions from existing data
                const initialCaptions: Record<string, string> = {}
                validReels.forEach((r: any) => {
                    if (r.generated_caption) {
                        initialCaptions[r.id] = r.generated_caption
                    } else {
                        // Fallback to original caption/title
                        initialCaptions[r.id] = r.caption || r.title || ""
                    }
                })
                setCaptions(initialCaptions)

                // Select all by default
                setSelectedReels(new Set(validReels.map((r: any) => r.id)))
            }
        }
        loadJob()
    }, [jobId])

    const handleGenerateCaptions = async () => {
        if (!geminiApiKey) {
            alert("Please enter a Gemini API Key first")
            return
        }
        if (selectedReels.size === 0) {
            alert("Please select at least one video")
            return
        }

        setIsGenerating(true)
        const newCaptions = { ...captions }
        let successCount = 0

        for (const reel of reels) {
            if (selectedReels.has(reel.id)) {
                try {
                    const context = reel.title || reel.processed_path || "Viral Video"
                    // Generate
                    const caption = await generateCaptionWithGemini(geminiApiKey, context)
                    newCaptions[reel.id] = caption
                    successCount++
                } catch (e) {
                    console.error(`Failed for ${reel.id}:`, e)
                }
            }
        }

        setCaptions(newCaptions)
        setIsGenerating(false)
        // Auto-save effectively happens on "Next" but we can do it here if we want persistent feel directly?
        // Let's rely on user clicking Next or explicit Save, but we'll prioritize "Next" doing the saving.
    }

    const handleSaveAndNext = async () => {
        setIsSaving(true)
        try {
            await updateJobReelCaptions(jobId, captions)
            router.push(`/jobs/${jobId}/schedule`)
        } catch (e) {
            alert("Failed to save captions: " + e)
            setIsSaving(false)
        }
    }

    const toggleReel = (id: string) => {
        const next = new Set(selectedReels)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        setSelectedReels(next)
    }

    if (!job) return <div className="min-h-screen bg-black text-slate-50 pt-24 flex justify-center"><Loader2 className="animate-spin" /></div>

    return (
        <div className="min-h-screen bg-black text-slate-50 flex flex-col pt-24 pb-24 relative">
            <SiteHeader
                step={5}
                backUrl={`/jobs/${jobId}/processing`}
            />

            <div className="container max-w-7xl mx-auto px-6 flex flex-col gap-6">

                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-6">
                    <div>
                        <h1 className="text-2xl font-bold mb-2">Caption AI Studio</h1>
                        <p className="text-zinc-400 text-sm">Generate and edit viral captions for your videos before scheduling.</p>
                    </div>

                    <div className="flex items-center gap-3 bg-zinc-900/50 p-2 rounded-xl border border-white/5">
                        <div className="relative">
                            <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-violet-400" />
                            <Input
                                type="password"
                                placeholder="Gemini API Key"
                                value={geminiApiKey}
                                onChange={(e) => setGeminiApiKey(e.target.value)}
                                className="pl-9 bg-black border-white/10 w-64 h-10 focus:border-violet-500/50"
                            />
                        </div>
                        <Button
                            onClick={handleGenerateCaptions}
                            disabled={isGenerating || !geminiApiKey || selectedReels.size === 0}
                            className="bg-violet-600 hover:bg-violet-700 text-white font-bold"
                        >
                            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                            Generate ({selectedReels.size})
                        </Button>
                    </div>
                </div>

                {/* Content Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {reels.map(reel => (
                        <div key={reel.id} className="bg-zinc-900/40 border border-white/10 rounded-xl overflow-hidden flex flex-col group hover:border-white/20 transition-all">
                            {/* Video Preview Header */}
                            <div className="h-48 bg-black relative">
                                <video
                                    src={`/downloads/${jobId}/${reel.processed_path}`}
                                    className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity"
                                    onMouseOver={e => e.currentTarget.play()}
                                    onMouseOut={e => {
                                        e.currentTarget.pause()
                                        e.currentTarget.currentTime = 0
                                    }}
                                    muted
                                    loop
                                />
                                <div className="absolute top-3 left-3">
                                    <div
                                        onClick={() => toggleReel(reel.id)}
                                        className={cn(
                                            "w-6 h-6 rounded-full border flex items-center justify-center cursor-pointer transition-all",
                                            selectedReels.has(reel.id) ? "bg-violet-500 border-violet-500" : "bg-black/50 border-white/30 hover:bg-white/10"
                                        )}
                                    >
                                        {selectedReels.has(reel.id) && <CheckCircle className="w-4 h-4 text-white" />}
                                    </div>
                                </div>
                                <div className="absolute bottom-0 left-0 w-full p-3 bg-gradient-to-t from-black/90 to-transparent">
                                    <p className="text-xs text-zinc-300 truncate font-mono">{reel.processed_path}</p>
                                </div>
                            </div>

                            {/* Caption Editor */}
                            <div className="p-4 flex-1 flex flex-col gap-3">
                                <Label className="text-xs text-zinc-500 uppercase font-bold tracking-wider">Caption</Label>
                                <Textarea
                                    value={captions[reel.id] || ""}
                                    onChange={(e) => setCaptions(prev => ({ ...prev, [reel.id]: e.target.value }))}
                                    className="flex-1 bg-black/50 border-white/5 resize-none text-sm min-h-[120px] focus:bg-black transition-colors"
                                    placeholder="Enter or generate caption..."
                                />
                                <div className="flex justify-end gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs text-zinc-500 hover:text-zinc-300"
                                        onClick={() => {
                                            const original = reel.generated_caption || reel.caption || reel.title || ""
                                            if (confirm("Revert to original/last generated caption?")) {
                                                setCaptions(prev => ({ ...prev, [reel.id]: original }))
                                            }
                                        }}
                                        disabled={!reel.generated_caption && !reel.caption && !reel.title}
                                    >
                                        <RefreshCcw className="w-3 h-3 mr-1.5" /> Revert
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs text-zinc-500 hover:text-zinc-300"
                                        onClick={() => {
                                            navigator.clipboard.writeText(captions[reel.id] || "")
                                        }}
                                    >
                                        <Copy className="w-3 h-3 mr-1.5" /> Copy
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

            </div>

            {/* Bottom Bar */}
            <div className="fixed bottom-0 left-0 w-full p-4 bg-black/90 backdrop-blur border-t border-white/10 flex justify-end gap-4 z-40">
                <Button variant="ghost" onClick={() => router.back()}>Back</Button>
                <Button
                    size="lg"
                    className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold px-8 shadow-glow-lg"
                    onClick={handleSaveAndNext}
                    disabled={isSaving}
                >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Next Step: Schedule <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
            </div>
        </div>
    )
}
