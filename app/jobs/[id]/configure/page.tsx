
"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Upload, Check, ChevronRight, Wand2, Type, ImageIcon, LayoutTemplate } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
// Server action
import { getJob, startProcessingJob } from "@/app/actions"

export default function ConfigurePage() {
    const params = useParams()
    const router = useRouter()

    // Mode: 'upload' or 'design'
    const [mode, setMode] = useState<'upload' | 'design'>('upload')

    // Common
    const [headerHeight, setHeaderHeight] = useState(15) // percentage (Upload mode only)
    const [verticalPosition, setVerticalPosition] = useState(5) // percentage (Design mode only)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [sampleVideoUrl, setSampleVideoUrl] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    // Upload Mode State
    const [headerImage, setHeaderImage] = useState<string | null>(null)
    const [headerFile, setHeaderFile] = useState<File | null>(null)

    // Design Mode State
    const [designLogo, setDesignLogo] = useState<string | null>(null)
    const [designLogoFile, setDesignLogoFile] = useState<File | null>(null)
    const [logoSize, setLogoSize] = useState(12) // percentage relative to width, default 12

    const [designName, setDesignName] = useState("Your Name")
    const [nameFontSize, setNameFontSize] = useState(18)
    const [nameColor, setNameColor] = useState("#ffffff")

    const [badgeSize, setBadgeSize] = useState(18)

    const [designHandle, setDesignHandle] = useState("username")
    const [handleFontSize, setHandleFontSize] = useState(14)
    const [handleColor, setHandleColor] = useState("#94a3b8") // slate-400

    const [designBgColor, setDesignBgColor] = useState("#000000")
    const [designOpacity, setDesignOpacity] = useState(80)

    const [headlineMode, setHeadlineMode] = useState<'manual' | 'ai'>('manual')
    const [manualHeadline, setManualHeadline] = useState("This is an example headline that captures attention.")
    const [headlineFontSize, setHeadlineFontSize] = useState(32)
    const [headlineColor, setHeadlineColor] = useState("#ffffff")

    // Refs
    const fileInputRef = useRef<HTMLInputElement>(null)
    const logoInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        async function fetchData() {
            try {
                const job = await getJob(params.id as string)
                if (job && job.reels && job.reels.length > 0) {
                    // Pick the first approved video, or just the first video
                    const approved = job.reels.find((r: any) => r.status === "approved")
                    setSampleVideoUrl(approved ? approved.playable_url : job.reels[0].playable_url)
                }
            } catch (err) {
                console.error("Failed to fetch job", err)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [params.id])

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, isLogo = false) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0]
            const url = URL.createObjectURL(file)

            if (isLogo) {
                setDesignLogoFile(file)
                setDesignLogo(url)
            } else {
                setHeaderFile(file)
                setHeaderImage(url)
            }
        }
    }

    // Helper to convert hex + opacity to rgba string for preview
    const getRgbaColor = (hex: string, opacityPercent: number) => {
        const r = parseInt(hex.slice(1, 3), 16)
        const g = parseInt(hex.slice(3, 5), 16)
        const b = parseInt(hex.slice(5, 7), 16)
        return `rgba(${r}, ${g}, ${b}, ${opacityPercent / 100})`
    }

    const handleStartProcessing = async () => {
        if (mode === 'upload' && !headerFile) return
        if (mode === 'design' && !designLogoFile) return // Logo required? Maybe optional? Assuming required.

        setIsSubmitting(true)
        try {
            const formData = new FormData()
            formData.append("jobId", params.id as string)
            formData.append("mode", mode)
            formData.append("headerHeight", headerHeight.toString())
            formData.append("verticalPosition", verticalPosition.toString())

            if (mode === 'upload' && headerFile) {
                formData.append("headerImage", headerFile)
            } else if (mode === 'design') {
                if (designLogoFile) formData.append("designLogo", designLogoFile)
                formData.append("designName", designName)
                formData.append("designHandle", designHandle)
                formData.append("designBgColor", designBgColor)
                formData.append("designOpacity", designOpacity.toString())

                // New Metrics
                formData.append("logoSize", logoSize.toString())
                formData.append("nameFontSize", nameFontSize.toString())
                formData.append("nameColor", nameColor)
                formData.append("badgeSize", badgeSize.toString())
                formData.append("handleFontSize", handleFontSize.toString())
                formData.append("handleColor", handleColor)
                formData.append("headlineFontSize", headlineFontSize.toString())
                formData.append("headlineColor", headlineColor)

                formData.append("headlineMode", headlineMode)
                if (headlineMode === 'manual') {
                    formData.append("manualHeadline", manualHeadline)
                }
            }

            await startProcessingJob(formData)
        } catch (e) {
            console.error(e)
            alert("Failed to start processing")
            setIsSubmitting(false)
        }
    }

    // ... (render) ...

    {
        mode === 'design' && (
            <div
                className="absolute w-full z-10 flex flex-col pointer-events-none transition-all duration-75 box-content"
                style={{
                    top: `${verticalPosition}%`,
                    backgroundColor: getRgbaColor(designBgColor, designOpacity)
                }}
            >
                {/* Header Strip */}
                <div className="w-full px-4 py-3 flex items-center gap-3 shrink-0">
                    {designLogo ? (
                        <img src={designLogo} className="w-8 h-8 rounded-full border border-white object-cover" />
                    ) : (
                        <div className="w-8 h-8 rounded-full border border-white bg-slate-800" />
                    )}
                    <div className="flex flex-col justify-center min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                            <span className="text-white font-semibold text-sm truncate font-inter leading-none">
                                {designName}
                            </span>
                            {/* Twitter Verified Badge Mock */}
                            <img src="/Twitter_Verified_Badge_Gold.svg.png" className="w-4 h-4 object-contain" alt="Verified" />
                        </div>
                        <span className="text-slate-400 text-xs font-medium truncate mt-0.5">
                            {designHandle.startsWith('@') ? designHandle : (designHandle ? '@' + designHandle : '')}
                        </span>
                    </div>
                </div>

                {/* Headline Block */}
                <div className="px-6 pt-2 pb-4">
                    <p className="text-white text-lg font-light leading-snug drop-shadow-md">
                        {headlineMode === 'manual' ? manualHeadline : "AI generated headline will appear here..."}
                    </p>
                </div>
            </div>
        )
    }

    if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Loading...</div>

    return (
        <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col">
            {/* Header */}
            <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-slate-950/80 backdrop-blur">
                <div className="flex h-16 items-center px-4 md:px-8 justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-slate-400 hover:text-white">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <h2 className="text-lg font-semibold tracking-tight">Configure Processing</h2>
                    </div>
                </div>
            </header>

            <main className="flex-1 container max-w-6xl mx-auto py-8 px-4 flex flex-col lg:flex-row gap-8">

                {/* Configuration Panel */}
                <div className="flex-1 space-y-6">
                    <div className="flex bg-slate-900 p-1 rounded-lg border border-white/10 w-fit">
                        <button
                            onClick={() => setMode('upload')}
                            className={cn(
                                "px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2",
                                mode === 'upload' ? "bg-slate-800 text-white shadow-sm" : "text-slate-400 hover:text-white"
                            )}
                        >
                            <Upload className="w-4 h-4" />
                            Upload Overlay
                        </button>
                        <button
                            onClick={() => setMode('design')}
                            className={cn(
                                "px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2",
                                mode === 'design' ? "bg-slate-800 text-white shadow-sm" : "text-slate-400 hover:text-white"
                            )}
                        >
                            <LayoutTemplate className="w-4 h-4" />
                            Create Design
                        </button>
                    </div>

                    <Card className="bg-slate-900 border-white/10">
                        <CardContent className="p-6 space-y-8">

                            {mode === 'upload' ? (
                                <div>
                                    <h3 className="text-lg font-medium text-white mb-2">Upload Header Image</h3>
                                    <p className="text-sm text-slate-400 mb-4">
                                        Upload a pre-made PNG or JPG overlay.
                                    </p>

                                    <div
                                        className="border-2 border-dashed border-white/10 rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-colors"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        {headerImage ? (
                                            <div className="relative">
                                                <img src={headerImage} alt="Header Preview" className="h-20 object-contain" />
                                                <div className="absolute -top-2 -right-2 bg-emerald-500 rounded-full p-1">
                                                    <Check className="w-3 h-3 text-black" />
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <ImageIcon className="w-8 h-8 text-slate-500 mb-2" />
                                                <p className="text-sm font-medium text-slate-300">Click to upload header</p>
                                                <span className="text-xs text-slate-500">PNG or JPG recommended</span>
                                            </>
                                        )}
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            className="hidden"
                                            accept="image/*"
                                            onChange={(e) => handleFileChange(e, false)}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Design Mode Inputs */}
                                    {/* Design Mode Inputs - Compact & Precise */}
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-sm font-medium text-white uppercase tracking-wider">Header Design</h3>
                                            <span className="text-[10px] text-slate-500">Precise Controls</span>
                                        </div>

                                        {/* Row 1: Logo & Background */}
                                        <div className="grid grid-cols-12 gap-3">
                                            {/* Logo Section */}
                                            <div className="col-span-4 bg-black/20 border border-white/10 rounded-md p-2 flex flex-col gap-2">
                                                <div
                                                    className="aspect-square rounded-md border-2 border-dashed border-white/10 flex items-center justify-center cursor-pointer hover:bg-white/5 bg-black/40 relative overflow-hidden"
                                                    onClick={() => logoInputRef.current?.click()}
                                                >
                                                    {designLogo ? (
                                                        <img src={designLogo} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="text-center">
                                                            <Upload className="w-4 h-4 mx-auto text-slate-500" />
                                                            <span className="text-[8px] text-slate-500 block mt-1">LOGO</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="flex justify-between text-[8px] text-slate-400">
                                                        <span>Size</span>
                                                        <span>{logoSize}</span>
                                                    </div>
                                                    <input type="range" min="5" max="30" value={logoSize} onChange={(e) => setLogoSize(parseInt(e.target.value))} className="w-full h-1 bg-slate-800 rounded-full appearance-none accent-white" />
                                                </div>
                                            </div>

                                            {/* Background & Opacity */}
                                            <div className="col-span-8 bg-black/20 border border-white/10 rounded-md p-2 flex flex-col gap-2">
                                                <label className="text-[10px] text-slate-400 font-medium">Background</label>
                                                <div className="flex gap-2">
                                                    <input type="color" value={designBgColor} onChange={(e) => setDesignBgColor(e.target.value)} className="h-6 w-6 p-0 rounded cursor-pointer border-none" />
                                                    <input
                                                        type="text"
                                                        value={designBgColor}
                                                        onChange={(e) => setDesignBgColor(e.target.value)}
                                                        className="flex-1 bg-transparent border-b border-white/10 text-xs text-white font-mono h-6 focus:outline-none focus:border-emerald-500"
                                                    />
                                                </div>
                                                <div className="space-y-1 mt-1">
                                                    <div className="flex justify-between text-[8px] text-slate-400">
                                                        <span>Opacity</span>
                                                        <span>{designOpacity}%</span>
                                                    </div>
                                                    <input type="range" min="0" max="100" value={designOpacity} onChange={(e) => setDesignOpacity(parseInt(e.target.value))} className="w-full h-1 bg-slate-800 rounded-full appearance-none accent-emerald-500" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Row 2: Name & Badge */}
                                        <div className="bg-black/20 border border-white/10 rounded-md p-2 space-y-3">
                                            {/* Name Control */}
                                            <div className="grid grid-cols-12 gap-2 items-center">
                                                <div className="col-span-5">
                                                    <label className="text-[10px] text-slate-500 block mb-1">Name</label>
                                                    <input
                                                        value={designName}
                                                        onChange={(e) => setDesignName(e.target.value)}
                                                        className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-white/30"
                                                    />
                                                </div>
                                                <div className="col-span-3">
                                                    <label className="text-[10px] text-slate-500 block mb-1">Size ({nameFontSize})</label>
                                                    <input type="range" min="10" max="40" value={nameFontSize} onChange={(e) => setNameFontSize(parseInt(e.target.value))} className="w-full h-1 bg-slate-800 rounded-full appearance-none accent-white" />
                                                </div>
                                                <div className="col-span-1">
                                                    <label className="text-[10px] text-slate-500 block mb-1">Color</label>
                                                    <input type="color" value={nameColor} onChange={(e) => setNameColor(e.target.value)} className="h-5 w-5 p-0 rounded cursor-pointer border-none" />
                                                </div>
                                                <div className="col-span-3 border-l border-white/10 pl-2">
                                                    <label className="text-[10px] text-slate-500 block mb-1">Badge Size</label>
                                                    <input type="range" min="10" max="40" value={badgeSize} onChange={(e) => setBadgeSize(parseInt(e.target.value))} className="w-full h-1 bg-slate-800 rounded-full appearance-none accent-yellow-500" />
                                                </div>
                                            </div>

                                            {/* Handle Control */}
                                            <div className="grid grid-cols-12 gap-2 items-center">
                                                <div className="col-span-5">
                                                    <label className="text-[10px] text-slate-500 block mb-1">Handle</label>
                                                    <div className="relative">
                                                        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-500 text-[10px]">@</span>
                                                        <input
                                                            value={designHandle}
                                                            onChange={(e) => setDesignHandle(e.target.value)}
                                                            className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 pl-4 text-xs text-white focus:outline-none focus:border-white/30"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="col-span-3">
                                                    <label className="text-[10px] text-slate-500 block mb-1">Size ({handleFontSize})</label>
                                                    <input type="range" min="8" max="30" value={handleFontSize} onChange={(e) => setHandleFontSize(parseInt(e.target.value))} className="w-full h-1 bg-slate-800 rounded-full appearance-none accent-white" />
                                                </div>
                                                <div className="col-span-1">
                                                    <label className="text-[10px] text-slate-500 block mb-1">Color</label>
                                                    <input type="color" value={handleColor} onChange={(e) => setHandleColor(e.target.value)} className="h-5 w-5 p-0 rounded cursor-pointer border-none" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Row 3: Headline */}
                                        <div className="bg-black/20 border border-white/10 rounded-md p-2 space-y-2">
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="flex gap-2">
                                                    <button onClick={() => setHeadlineMode('manual')} className={cn("text-[10px] px-2 py-0.5 rounded transition-colors", headlineMode === 'manual' ? "bg-white text-black font-bold" : "text-slate-500 hover:text-white")}>Manual</button>
                                                    <button onClick={() => setHeadlineMode('ai')} className={cn("text-[10px] px-2 py-0.5 rounded transition-colors", headlineMode === 'ai' ? "bg-indigo-500 text-white font-bold" : "text-indigo-400 hover:text-indigo-300")}>AI Auto</button>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <input type="color" value={headlineColor} onChange={(e) => setHeadlineColor(e.target.value)} className="h-4 w-4 p-0 rounded cursor-pointer border-none" />
                                                    <div className="w-16">
                                                        <input type="range" min="16" max="60" value={headlineFontSize} onChange={(e) => setHeadlineFontSize(parseInt(e.target.value))} className="w-full h-1 bg-slate-800 rounded-full appearance-none accent-white" />
                                                    </div>
                                                    <span className="text-[9px] text-slate-500 w-4">{headlineFontSize}</span>
                                                </div>
                                            </div>

                                            {headlineMode === 'manual' ? (
                                                <textarea
                                                    className="w-full h-16 bg-white/5 border border-white/10 rounded p-2 text-xs text-white focus:outline-none focus:border-white/30 resize-none font-light"
                                                    placeholder="Headline text..."
                                                    value={manualHeadline}
                                                    onChange={(e) => setManualHeadline(e.target.value)}
                                                />
                                            ) : (
                                                <div className="h-16 flex items-center justify-center bg-indigo-500/10 border border-indigo-500/20 rounded text-xs text-indigo-300">
                                                    <Wand2 className="w-3 h-3 mr-2" /> AI Generated based on content
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Inputs for file upload (Hidden) */}
                                    <input
                                        type="file"
                                        ref={logoInputRef}
                                        className="hidden"
                                        accept="image/*"
                                        onChange={(e) => handleFileChange(e, true)}
                                    />
                                </div>
                            )}

                            {/* Common Height/Position Slider */}
                            <div className="pt-4 border-t border-white/10">
                                <h3 className="text-sm font-medium text-slate-300 mb-3">
                                    {mode === 'upload' ? "Overlay Height (Crop)" : "Vertical Position"}
                                </h3>
                                <div className="space-y-4">
                                    <div className="flex justify-between text-xs text-slate-500">
                                        <span>{mode === 'upload' ? "Top Coverage" : "Distance from Top"}</span>
                                        <span>{mode === 'upload' ? headerHeight : verticalPosition}%</span>
                                    </div>

                                    {mode === 'upload' ? (
                                        <input
                                            type="range"
                                            min="5"
                                            max="50"
                                            value={headerHeight}
                                            onChange={(e) => setHeaderHeight(parseInt(e.target.value))}
                                            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                        />
                                    ) : (
                                        <input
                                            type="range"
                                            min="0"
                                            max="80"
                                            value={verticalPosition}
                                            onChange={(e) => setVerticalPosition(parseInt(e.target.value))}
                                            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                        />
                                    )}
                                </div>
                            </div>

                            <div className="pt-4 border-t border-white/10">
                                <Button
                                    size="lg"
                                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-semibold"
                                    disabled={loading || isSubmitting || (mode === 'upload' && !headerFile) || (mode === 'design' && !designLogoFile)}
                                    onClick={handleStartProcessing}
                                >
                                    {isSubmitting ? "Starting Job..." : "Start Processing Batch"}
                                    {!isSubmitting && <ChevronRight className="w-4 h-4 ml-2" />}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Live Preview Panel */}
                <div className="lg:w-[380px] shrink-0">
                    <div className="sticky top-24">
                        <h3 className="text-sm font-medium text-slate-400 mb-3 uppercase tracking-wider flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                            Live Preview
                        </h3>

                        <div className="relative aspect-[9/16] bg-black rounded-lg overflow-hidden border border-white/10 shadow-2xl">
                            {/* Video Layer */}
                            {sampleVideoUrl ? (
                                <video
                                    src={sampleVideoUrl}
                                    className="w-full h-full object-cover opacity-80"
                                    autoPlay
                                    loop
                                    muted
                                    playsInline
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-600">
                                    No Video
                                </div>
                            )}

                            {/* Overlay Layer */}
                            {mode === 'upload' && headerImage && (
                                <div
                                    className="absolute top-0 left-0 w-full z-10 bg-no-repeat bg-cover bg-center transition-all duration-75 border-b border-emerald-500/30"
                                    style={{
                                        height: `${headerHeight}%`,
                                        backgroundImage: `url(${headerImage})`,
                                        backgroundColor: 'black'
                                    }}
                                />
                            )}

                            {mode === 'design' && (
                                <div
                                    className="absolute w-full z-10 flex flex-col pointer-events-none transition-all duration-75 box-content"
                                    style={{
                                        top: `${verticalPosition}%`,
                                        backgroundColor: getRgbaColor(designBgColor, designOpacity)
                                    }}
                                >
                                    {/* Header Strip */}
                                    <div className="w-full px-4 py-3 flex items-center gap-3 shrink-0">
                                        <div style={{ width: `${logoSize * 2.5}px`, height: `${logoSize * 2.5}px` }}> {/* rough multiplier for preview scale */}
                                            {designLogo ? (
                                                <img src={designLogo} className="w-full h-full rounded-full border border-white object-cover" />
                                            ) : (
                                                <div className="w-full h-full rounded-full border border-white bg-slate-800" />
                                            )}
                                        </div>

                                        <div className="flex flex-col justify-center min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5">
                                                <span
                                                    className="font-semibold truncate font-inter leading-none"
                                                    style={{ fontSize: `${nameFontSize}px`, color: nameColor }}
                                                >
                                                    {designName}
                                                </span>
                                                {/* Badge */}
                                                <img
                                                    src="/Twitter_Verified_Badge_Gold.svg.png"
                                                    className="object-contain"
                                                    alt="Verified"
                                                    style={{ width: `${badgeSize}px`, height: `${badgeSize}px` }}
                                                />
                                            </div>
                                            <span
                                                className="font-medium truncate mt-0.5"
                                                style={{ fontSize: `${handleFontSize}px`, color: handleColor }}
                                            >
                                                {designHandle.startsWith('@') ? designHandle : (designHandle ? '@' + designHandle : '')}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Headline Block */}
                                    <div className="px-6 pt-2 pb-4">
                                        <p
                                            className="font-light leading-snug drop-shadow-md"
                                            style={{
                                                fontSize: `${headlineFontSize}px`,
                                                color: headlineColor,
                                                lineHeight: '1.2'
                                            }}
                                        >
                                            {headlineMode === 'manual' ? manualHeadline : "AI generated headline will appear here..."}
                                        </p>
                                    </div>
                                </div>
                            )}

                        </div>
                        <p className="text-xs text-center text-slate-500 mt-4">
                            The overlay will be baked into every video.
                        </p>
                    </div>
                </div>

            </main>
        </div>
    )
}
