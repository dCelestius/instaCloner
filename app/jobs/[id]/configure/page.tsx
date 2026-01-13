"use client"

import { useState, useEffect, useRef } from "react"
import type { Metadata } from "next";
import { Geist, Geist_Mono, Montserrat } from "next/font/google";
import { useParams, useRouter } from "next/navigation"
import { Wand2, Image as ImageIcon, Check, ChevronRight, Upload, X, RotateCcw, LayoutTemplate, Save, Trash2, Library, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { SiteHeader } from "@/components/site-header"
import { cn } from "@/lib/utils"
// Server action
import { getJob, startProcessingJob, getPresets, savePreset, deletePreset, uploadTempLogo } from "@/app/actions"

export default function ConfigurePage() {
    const params = useParams()
    const router = useRouter()

    // Mode: 'upload' or 'design'
    const [mode, setMode] = useState<'upload' | 'design'>('design')

    // Common
    const [autoDetectPosition, setAutoDetectPosition] = useState(true) // Toggle for Auto-Detect
    const [verticalPosition, setVerticalPosition] = useState(5) // Legacy/Manual fallback
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [sampleVideoUrl, setSampleVideoUrl] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    // Presets Only
    const [presets, setPresets] = useState<any[]>([])
    const [showSaveDialog, setShowSaveDialog] = useState(false)
    const [newPresetName, setNewPresetName] = useState("")
    const [isPreserving, setIsPreserving] = useState(false) // Loading state for save

    // Upload Mode State
    const [headerImage, setHeaderImage] = useState<string | null>(null)
    const [headerFile, setHeaderFile] = useState<File | null>(null)

    // Design Mode State
    const [designLogo, setDesignLogo] = useState<string | null>(null)
    const [designLogoFile, setDesignLogoFile] = useState<File | null>(null)
    const [logoSize, setLogoSize] = useState(15) // Increased default to 15

    const [designName, setDesignName] = useState("Your Name")
    const [nameFontSize, setNameFontSize] = useState(13)
    const [nameColor, setNameColor] = useState("#ffffff")

    const [badgeSize, setBadgeSize] = useState(12)

    const [designHandle, setDesignHandle] = useState("username")
    const [handleFontSize, setHandleFontSize] = useState(12)
    const [handleColor, setHandleColor] = useState("#94a3b8") // slate-400

    const [designBgColor, setDesignBgColor] = useState("#000000")
    const [designOpacity, setDesignOpacity] = useState(100)

    const [showHeadline, setShowHeadline] = useState(false) // Default to no headline
    const [headlineMode, setHeadlineMode] = useState<'manual' | 'ai'>('manual')
    const [manualHeadline, setManualHeadline] = useState("This is an example headline that captures attention.")
    const [headlineFontSize, setHeadlineFontSize] = useState(24) // Reduced default
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

    // Load Presets
    async function loadPresetsList() {
        try {
            const data = await getPresets()
            setPresets(data)
            return data
        } catch (e) {
            console.error("Failed to load presets", e)
            return []
        }
    }

    const applyPreset = (preset: any) => {
        if (!preset) return
        if (preset.designName) setDesignName(preset.designName)
        if (preset.designHandle) setDesignHandle(preset.designHandle)
        if (preset.designBgColor) setDesignBgColor(preset.designBgColor)
        if (preset.designOpacity) setDesignOpacity(preset.designOpacity)
        if (preset.logoSize) setLogoSize(preset.logoSize)
        if (preset.nameFontSize) setNameFontSize(preset.nameFontSize)
        if (preset.nameColor) setNameColor(preset.nameColor)
        if (preset.badgeSize) setBadgeSize(preset.badgeSize)
        if (preset.handleFontSize) setHandleFontSize(preset.handleFontSize)
        if (preset.handleColor) setHandleColor(preset.handleColor)
        if (preset.headlineFontSize) setHeadlineFontSize(preset.headlineFontSize)
        if (preset.headlineColor) setHeadlineColor(preset.headlineColor)
        if (preset.headlineMode) setHeadlineMode(preset.headlineMode)
        if (preset.manualHeadline) setManualHeadline(preset.manualHeadline)
        if (preset.showHeadline !== undefined) setShowHeadline(preset.showHeadline)

        if (preset.designLogo) {
            setDesignLogo(preset.designLogo)
            // Reset file input because we loaded a URL
            setDesignLogoFile(null)
        }
    }

    useEffect(() => {
        loadPresetsList().then(data => {
            // Auto-load Last Used if available
            const lastUsed = data.find((p: any) => p.name === "Last Used")
            if (lastUsed) applyPreset(lastUsed)
        })
    }, [])

    const handleSavePreset = async () => {
        if (!newPresetName.trim()) return
        setIsPreserving(true)
        try {
            // Build Config object
            const config = {
                designName, designHandle, designBgColor, designOpacity,
                logoSize, nameFontSize, nameColor, badgeSize,
                handleFontSize, handleColor, headlineFontSize, headlineColor,
                showHeadline, headlineMode, manualHeadline
            }

            let logoPathToSave: string | undefined = undefined

            // 1. If we have a NEW file, upload it to temp first
            if (designLogoFile) {
                const formData = new FormData()
                formData.append("file", designLogoFile)
                const res = await uploadTempLogo(formData)
                logoPathToSave = res.path
            }
            // 2. If no new file, but we have an existing URL (not blob), use it
            else if (designLogo && !designLogo.startsWith("blob:")) {
                // It's a server path, e.g. /persistent/... or /downloads/...
                // Convert to filesystem path relative to CWD
                logoPathToSave = "public" + designLogo
            }

            await savePreset(newPresetName, config, logoPathToSave)

            setNewPresetName("")
            setShowSaveDialog(false)
            await loadPresetsList()
        } catch (e) {
            console.error(e)
            alert("Failed to save preset")
        } finally {
            setIsPreserving(false)
        }
    }

    const handleDeletePreset = async (name: string, e: React.MouseEvent) => {
        e.stopPropagation()
        if (!confirm(`Delete preset "${name}"?`)) return
        try {
            await deletePreset(name)
            await loadPresetsList()
        } catch (e) {
            alert("Failed to delete")
        }
    }

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
        // if (mode === 'design' && !designLogoFile) return // Logo optional now

        setIsSubmitting(true)
        try {
            const formData = new FormData()
            formData.append("jobId", params.id as string)
            formData.append("mode", mode)
            formData.append("autoDetectPosition", autoDetectPosition.toString())
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
                formData.append("showHeadline", showHeadline.toString())

                formData.append("headlineMode", headlineMode)
                if (headlineMode === 'manual') {
                    formData.append("manualHeadline", manualHeadline)
                }
            }

            await startProcessingJob(formData)
            router.push(`/jobs/${params.id}/processing`)
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

    if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-slate-400 animate-pulse tracking-widest uppercase text-xs font-bold">Loading Configuration...</div>

    return (

        <div className="min-h-screen bg-black text-slate-50 flex flex-col pt-24 pb-8">
            <SiteHeader
                step={3}
                backUrl={`/jobs/${params.id}`}
            />

            {/* Main Layout - Centered Container */}
            <main className="container max-w-7xl mx-auto px-6 h-full flex flex-col lg:flex-row gap-8">

                {/* Configuration Panel */}
                <div className="flex-1 space-y-6">
                    <div className="flex bg-zinc-900 p-1 rounded-lg border border-white/10 w-fit">
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
                    </div>

                    <Card className="bg-zinc-900/50 border-white/10">
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

                                    {/* Presets Bar */}
                                    <div className="bg-zinc-950/50 border border-white/5 rounded-xl p-3 mb-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                                                <Library className="w-3 h-3 text-emerald-500" />
                                                Brand Presets
                                            </h3>
                                            <button
                                                onClick={() => setShowSaveDialog(!showSaveDialog)}
                                                className="text-[9px] text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 uppercase tracking-wider"
                                            >
                                                <Plus className="w-3 h-3" /> Save Current
                                            </button>
                                        </div>

                                        {/* Save Dialog (Inline) */}
                                        {showSaveDialog && (
                                            <div className="flex items-center gap-2 mb-3 bg-black/40 p-1.5 rounded border border-emerald-500/30 animate-in fade-in slide-in-from-top-1">
                                                <Input
                                                    value={newPresetName}
                                                    onChange={e => setNewPresetName(e.target.value)}
                                                    placeholder="Preset Name (e.g. My Brand)"
                                                    className="h-6 text-[10px] bg-transparent border-none focus-visible:ring-0 px-2"
                                                    autoFocus
                                                />
                                                <Button
                                                    size="sm"
                                                    className="h-6 px-2 text-[10px] bg-emerald-500 text-black hover:bg-emerald-400"
                                                    disabled={!newPresetName || isPreserving}
                                                    onClick={handleSavePreset}
                                                >
                                                    Save
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-6 w-6 p-0 text-zinc-500 hover:text-white"
                                                    onClick={() => setShowSaveDialog(false)}
                                                >
                                                    <X className="w-3 h-3" />
                                                </Button>
                                            </div>
                                        )}

                                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                                            {presets.length === 0 && (
                                                <div className="text-[10px] text-zinc-600 italic px-1">
                                                    No presets saved yet.
                                                </div>
                                            )}
                                            {presets.map(p => (
                                                <div
                                                    key={p.name}
                                                    onClick={() => applyPreset(p)}
                                                    className="flex items-center gap-2 bg-zinc-900 border border-white/10 rounded-lg px-2 py-1.5 cursor-pointer hover:bg-zinc-800 hover:border-white/20 transition-all shrink-0 group"
                                                >
                                                    {p.designLogo ? (
                                                        <img src={p.designLogo} className="w-4 h-4 rounded-full object-cover" />
                                                    ) : (
                                                        <div className="w-4 h-4 rounded-full bg-zinc-800 border border-white/10" />
                                                    )}
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-medium text-zinc-300">{p.name}</span>
                                                    </div>
                                                    {p.name !== "Last Used" && (
                                                        <button
                                                            onClick={(e) => handleDeletePreset(p.name, e)}
                                                            className="ml-1 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Design Mode Inputs - Compact & Precise */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between mb-1">
                                            <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Design</h3>
                                            <span className="text-[9px] text-slate-500">Auto-Detect Enabled</span>
                                        </div>

                                        {/* Compact Grid: Logo (left) + Settings (right) */}
                                        <div className="grid grid-cols-12 gap-2">
                                            {/* Logo Column */}
                                            <div className="col-span-3 bg-zinc-900/50 border border-white/10 rounded p-1.5 flex flex-col justify-between">
                                                <div
                                                    className="aspect-square rounded-full border border-dashed border-white/10 flex items-center justify-center cursor-pointer hover:bg-white/5 bg-black/40 relative overflow-hidden"
                                                    onClick={() => logoInputRef.current?.click()}
                                                >
                                                    {designLogo ? (
                                                        <img src={designLogo} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="text-center">
                                                            <Upload className="w-3 h-3 mx-auto text-slate-500" />
                                                            <span className="text-[7px] text-slate-500 block mt-0.5">LOGO</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="mt-1">
                                                    <input type="range" min="5" max="30" value={logoSize} onChange={(e) => setLogoSize(parseInt(e.target.value))} className="w-full h-1 bg-zinc-800 rounded-full appearance-none accent-white" />
                                                </div>
                                            </div>

                                            {/* Right Column: Background, Name, Handle */}
                                            <div className="col-span-9 space-y-2">

                                                {/* Background & Opacity */}
                                                {/* Background & Opacity */}
                                                <div className="bg-zinc-900/60 border border-white/10 rounded-xl p-3 flex flex-col gap-3 min-h-[70px]">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Background</span>
                                                        <div className="flex items-center gap-2">
                                                            <input type="color" value={designBgColor} onChange={(e) => setDesignBgColor(e.target.value)} className="h-6 w-6 rounded-full cursor-pointer border-none bg-transparent" />
                                                            <span className="text-xs text-white font-mono">{designBgColor}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <input type="range" min="0" max="100" value={designOpacity} onChange={(e) => setDesignOpacity(parseInt(e.target.value))} className="flex-1 h-1.5 bg-zinc-800 rounded-full appearance-none accent-emerald-500" />
                                                        <span className="text-xs text-slate-400 w-8 text-right font-bold">{designOpacity}%</span>
                                                    </div>
                                                </div>

                                                {/* Name Row */}
                                                {/* Name Row */}
                                                <div className="bg-zinc-900/60 border border-white/10 rounded-xl p-3 flex flex-col gap-3">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div className="flex-1 relative">
                                                            <input
                                                                value={designName}
                                                                onChange={(e) => setDesignName(e.target.value)}
                                                                className="w-full bg-transparent border-b border-white/10 text-sm text-white py-1.5 focus:outline-none focus:border-emerald-500/50 placeholder:text-slate-600 font-medium"
                                                                placeholder="Display Name"
                                                            />
                                                        </div>
                                                        <input type="color" value={nameColor} onChange={(e) => setNameColor(e.target.value)} className="h-6 w-6 rounded-lg cursor-pointer border-none bg-transparent" />
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Size</span>
                                                        <input type="range" min="10" max="40" value={nameFontSize} onChange={(e) => setNameFontSize(parseInt(e.target.value))} className="flex-1 h-1 bg-zinc-800 rounded-full appearance-none accent-white" />
                                                        <span className="text-xs text-slate-400 w-6 text-right">{nameFontSize}</span>
                                                    </div>
                                                </div>

                                                {/* Handle Row */}
                                                <div className="bg-zinc-900/60 border border-white/10 rounded-xl p-3 flex flex-col gap-3">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div className="flex-1 relative">
                                                            <span className="absolute left-0 top-1/2 -translate-y-1/2 text-slate-500 text-sm">@</span>
                                                            <input
                                                                value={designHandle}
                                                                onChange={(e) => setDesignHandle(e.target.value)}
                                                                className="w-full bg-transparent border-b border-white/10 text-sm text-white pl-4 py-1.5 focus:outline-none focus:border-emerald-500/50 placeholder:text-slate-600 font-medium"
                                                                placeholder="handle"
                                                            />
                                                        </div>
                                                        <input type="color" value={handleColor} onChange={(e) => setHandleColor(e.target.value)} className="h-6 w-6 rounded-lg cursor-pointer border-none bg-transparent" />
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Size</span>
                                                        <input type="range" min="8" max="30" value={handleFontSize} onChange={(e) => setHandleFontSize(parseInt(e.target.value))} className="flex-1 h-1 bg-zinc-800 rounded-full appearance-none accent-white" />
                                                        <span className="text-xs text-slate-400 w-6 text-right">{handleFontSize}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Headline Section */}
                                        <div className="bg-zinc-900/60 border border-white/10 rounded-xl p-4 space-y-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider transition-opacity duration-300">Headline Overlay</span>
                                                    <p className="text-[10px] text-slate-500">Add a custom headline banner</p>
                                                </div>
                                                <div
                                                    className={cn("w-10 h-5 rounded-full relative cursor-pointer transition-colors", showHeadline ? "bg-emerald-500" : "bg-zinc-700")}
                                                    onClick={() => setShowHeadline(!showHeadline)}
                                                >
                                                    <div className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow-md", showHeadline ? "left-5.5" : "left-0.5")} style={{ left: showHeadline ? '22px' : '2px' }} />
                                                </div>

                                            </div>

                                            {showHeadline && (
                                                <div className="space-y-4">
                                                    <div className="flex items-center justify-between p-2 bg-black/20 rounded-lg">
                                                        <div className="flex gap-2">
                                                            <button onClick={() => setHeadlineMode('manual')} className={cn("text-[10px] px-3 py-1 rounded-md transition-all font-bold", headlineMode === 'manual' ? "bg-white text-black shadow-lg" : "text-slate-500 hover:text-white hover:bg-white/5")}>MANUAL</button>
                                                            <button onClick={() => setHeadlineMode('ai')} className={cn("text-[10px] px-3 py-1 rounded-md transition-all font-bold", headlineMode === 'ai' ? "bg-emerald-500 text-black shadow-lg" : "text-slate-500 hover:text-white hover:bg-emerald-500/10")}>AI AUTO</button>
                                                        </div>
                                                        <div className="flex items-center gap-3 pr-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] text-slate-500 font-bold">FS</span>
                                                                <input type="range" min="12" max="60" value={headlineFontSize} onChange={(e) => setHeadlineFontSize(parseInt(e.target.value))} className="w-12 h-1 bg-zinc-800 rounded-full appearance-none accent-white" />
                                                            </div>
                                                            <input type="color" value={headlineColor} onChange={(e) => setHeadlineColor(e.target.value)} className="h-5 w-5 rounded-full cursor-pointer border-none bg-transparent" />
                                                        </div>
                                                    </div>

                                                    {headlineMode === 'manual' ? (
                                                        <textarea
                                                            className="w-full h-20 bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 resize-none font-medium leading-relaxed transition-all"
                                                            placeholder="Enter headline text..."
                                                            value={manualHeadline}
                                                            onChange={(e) => setManualHeadline(e.target.value)}
                                                        />
                                                    ) : (
                                                        <div className="h-20 flex flex-col items-center justify-center bg-emerald-500/5 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 font-semibold gap-2">
                                                            <Wand2 className="w-5 h-5 animate-pulse" />
                                                            AI AUTO GENERATION
                                                        </div>
                                                    )}
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
                            <div className="pt-2 border-t border-white/10 mt-2">
                                <h3 className="text-xs font-semibold text-white uppercase tracking-wider mb-2">Layout</h3>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between bg-zinc-900/50 p-2 rounded border border-white/5">
                                        <div className="flex flex-col">
                                            <label className="text-[10px] text-slate-300 font-medium flex items-center gap-1.5">
                                                <Wand2 className="w-3 h-3 text-emerald-500" />
                                                Auto-Detect Header
                                            </label>
                                            <p className="text-[9px] text-slate-500 leading-tight">Smart positioning & sizing.</p>
                                        </div>

                                        <div
                                            className={cn("w-8 h-4 rounded-full relative cursor-pointer transition-colors", autoDetectPosition ? "bg-emerald-500" : "bg-zinc-700")}
                                            onClick={() => setAutoDetectPosition(!autoDetectPosition)}
                                        >
                                            <div className={cn("absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all shadow-sm", autoDetectPosition ? "left-4.5" : "left-0.5")} style={{ left: autoDetectPosition ? '18px' : '2px' }} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-white/10">
                                <Button
                                    size="lg"
                                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-semibold"
                                    disabled={loading || isSubmitting || (mode === 'upload' && !headerFile)}
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
                                        height: `15%`,
                                        backgroundImage: `url(${headerImage})`,
                                        backgroundColor: 'black'
                                    }}
                                />
                            )}

                            {mode === 'design' && (
                                <div
                                    className="absolute w-full z-10 flex flex-col pointer-events-none transition-all duration-75 box-content left-0"
                                    style={{
                                        top: 0,
                                        height: 'auto',
                                        backgroundColor: getRgbaColor(designBgColor, designOpacity)
                                    }}
                                >
                                    {/* Header Strip */}
                                    <div className="w-full pl-[22px] pr-4 py-3 flex items-center gap-2 shrink-0">
                                        <div style={{ width: `${logoSize}%`, aspectRatio: '1/1' }}>
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
                                            <div className="flex items-center" style={{ color: handleColor }}>
                                                <span className="font-light font-montserrat" style={{ fontSize: `${handleFontSize + 2}px` }}>@</span>
                                                <span
                                                    className="font-light truncate font-montserrat"
                                                    style={{ fontSize: `${handleFontSize}px` }}
                                                >
                                                    {designHandle.startsWith('@') ? designHandle.substring(1) : designHandle}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Headline Block */}
                                    {showHeadline && (
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
                                    )}
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
