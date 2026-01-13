"use client"

import { useState, useEffect, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { Calendar, CheckCircle, Clock, Send, Upload, User, Loader2, Play, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Slider } from "@/components/ui/slider" // Verified Import
import { SiteHeader } from "@/components/site-header"
import { Skeleton } from "@/components/ui/skeleton"
import { getJob, getPublerAccounts, getPublerWorkspaces, getPublerPosts, scheduleBatchToPubler, generateCaptionWithGemini } from "@/app/actions"
import { cn } from "@/lib/utils"
import { CalendarView } from "@/components/calendar-view"

export default function SchedulePage() {
    const params = useParams()
    const router = useRouter()
    const jobId = params.id as string

    const [job, setJob] = useState<any>(null)
    const [reels, setReels] = useState<any[]>([])
    const [selectedReels, setSelectedReels] = useState<Set<string>>(new Set())

    // Publer Config
    const [apiKey, setApiKey] = useState("")
    const [workspaceId, setWorkspaceId] = useState("")
    const [workspaces, setWorkspaces] = useState<any[]>([])
    const [accounts, setAccounts] = useState<any[]>([])
    const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set())
    const [isLoading, setIsLoading] = useState(false)
    const [hasCredentials, setHasCredentials] = useState(false)
    const [authStep, setAuthStep] = useState<'input' | 'select_workspace' | 'connected'>('input') // input -> select_workspace -> connected
    const [upcomingPosts, setUpcomingPosts] = useState<any[]>([])
    const [isLoadingPosts, setIsLoadingPosts] = useState(false)

    // Schedule Config
    const [scheduleMode, setScheduleMode] = useState<'smart' | 'manual'>('smart')
    const [startDayOption, setStartDayOption] = useState<'today' | 'tomorrow'>('today')
    const [scheduleStrategy, setScheduleStrategy] = useState<'fill' | 'append'>('fill')
    const [minGapHours, setMinGapHours] = useState<number>(2) // Default 2h
    const [startHour, setStartHour] = useState<number>(9) // Default 9 AM
    const [showSuccess, setShowSuccess] = useState(false)
    const [scheduleTime, setScheduleTime] = useState<string>("")
    const [scheduleDays, setScheduleDays] = useState<number>(3) // Spread over X days

    const [isScheduling, setIsScheduling] = useState(false)
    const [scheduleResults, setScheduleResults] = useState<any>(null)

    useEffect(() => {
        async function loadJob() {
            const data = await getJob(jobId)
            if (data) {
                setJob(data)
                // Filter only processed reels with valid paths
                const validReels = (data.reels || []).filter((r: any) =>
                    r.status === 'approved' && r.processed_path
                )
                setReels(validReels)
                // Select all by default
                setSelectedReels(new Set(validReels.map((r: any) => r.id)))
            }
        }
        loadJob()
    }, [jobId])

    const handleConnect = async () => {
        if (!apiKey) return
        setIsLoading(true)
        try {
            // Priority 1: If Workspace ID is manual, try fetching accounts directly
            // ... (keeping existing logic)
            if (workspaceId) {
                const data = await getPublerAccounts(apiKey, workspaceId)
                setAccounts(data)
                setAuthStep('connected')
                return
            }

            // Priority 2: Try to discover Workspaces
            const ws = await getPublerWorkspaces(apiKey)
            if (ws && ws.length > 0) {
                setWorkspaces(ws)
                if (ws.length === 1) {
                    setWorkspaceId(ws[0].id)
                    const data = await getPublerAccounts(apiKey, ws[0].id)
                    setAccounts(data)
                    setAuthStep('connected')
                } else {
                    setAuthStep('select_workspace')
                }
            } else {
                alert("No workspaces found. Please enter Workspace ID manually.")
            }

        } catch (e) {
            alert("Connection failed: " + e)
        } finally {
            setIsLoading(false)
        }
    }

    const selectWorkspace = async (wsId: string) => {
        setWorkspaceId(wsId)
        setIsLoading(true)
        try {
            const data = await getPublerAccounts(apiKey, wsId)
            setAccounts(data)
            setAuthStep('connected')
        } catch (e) {
            alert("Failed to fetch accounts for this workspace: " + e)
        } finally {
            setIsLoading(false)
        }
    }

    const loadUpcomingPosts = async () => {
        setIsLoadingPosts(true)
        try {
            const posts = await getPublerPosts(apiKey, workspaceId || workspaces[0]?.id)
            setUpcomingPosts(posts.posts || [])
        } catch (e) {
            console.error(e)
        } finally {
            setIsLoadingPosts(false)
        }
    }

    useEffect(() => {
        if (authStep === 'connected') {
            loadUpcomingPosts()
        }
    }, [authStep])

    // --- Smart Schedule Logic ---
    const calculatedSchedule = useMemo(() => {
        if (scheduleMode === 'manual' || selectedReels.size === 0) return null

        const slots: Record<string, Date> = {}
        const reelsList = reels.filter(r => selectedReels.has(r.id))

        let reelIndex = 0
        let currentDayOffset = startDayOption === 'tomorrow' ? 1 : 0
        const maxLookAheadDays = 30 // Safety cap

        // Settings (Dynamic)
        // startHour is now state-driven
        const endHour = 23
        const minGapMs = minGapHours * 60 * 60 * 1000

        // Filter valid existing posts: Must be for one of the SELECTED accounts
        // We only care about collisions on the accounts we are scheduling to.
        const relevantUpcomingPosts = upcomingPosts.filter(p => {
            const accountId = typeof p.account === 'object' ? p.account.id : p.account
            return selectedAccounts.has(accountId)
        })

        // Gather busy times (Using only relevant posts)
        const allBusyTimes = relevantUpcomingPosts.map(p => new Date(p.scheduled_at).getTime()).sort((a, b) => a - b)

        let globalSearchStart: number | null = null
        if (scheduleStrategy === 'append' && allBusyTimes.length > 0) {
            const lastPostTime = allBusyTimes[allBusyTimes.length - 1]
            // Append starts after the absolute last post + gap
            globalSearchStart = lastPostTime + minGapMs
        }

        while (reelIndex < reelsList.length && currentDayOffset < maxLookAheadDays) {
            // Target posts for this day (Adaptive: spread remaining reels over remaining days)
            const remainingReels = reelsList.length - reelIndex
            const remainingDays = Math.max(1, scheduleDays - currentDayOffset) // Fix: Prevent divide by zero/negative if offset > scheduleDays
            const targetForToday = remainingDays > 0 ? Math.ceil(remainingReels / remainingDays) : remainingReels

            let postsScheduledToday = 0

            // Setup Day Time Boundaries
            const date = new Date()
            date.setDate(date.getDate() + currentDayOffset)
            const isToday = new Date().toDateString() === date.toDateString()

            // Start searching from...
            let searchTime = new Date(date)

            // Add deterministic organic variance (+/- 10 mins) based on date
            // This ensures the same day always gets the same "random" start time
            // to prevent jumping around during re-renders.
            const dateSeed = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate()
            // Simple deterministic PRNG: sin(seed) -> fractional part -> map to [-10, 10]
            const pseudoRandom = Math.sin(dateSeed) * 10000
            const varianceMinutes = Math.floor((pseudoRandom - Math.floor(pseudoRandom)) * 21) - 10

            searchTime.setHours(startHour, varianceMinutes, 0, 0)

            // Override search start if "Append" strategy pushes us forward
            if (globalSearchStart && searchTime.getTime() < globalSearchStart) {
                searchTime = new Date(globalSearchStart)
                // If global start pushes us past this day's end hour, we'll naturally fall through to next day loop
            }

            // If today, clamp to Now (+buffer)
            if (isToday) {
                const now = new Date()
                if (now.getHours() >= endHour) {
                    currentDayOffset++
                    continue // Day is over
                }

                // If "Append" hasn't already pushed us past Now, ensure we don't schedule in past
                if (now > searchTime) {
                    searchTime = now
                    // Round up to next 30 min
                    const minutes = searchTime.getMinutes()
                    const remainder = 30 - (minutes % 30)
                    searchTime.setMinutes(minutes + remainder, 0, 0)
                }
            }

            const dayEndTime = new Date(date)
            dayEndTime.setHours(endHour, 0, 0, 0)

            // Gather busy times for this day (Existing + Newly Scheduled)
            const existingOnDate = relevantUpcomingPosts.filter(p => {
                const pDate = new Date(p.scheduled_at)
                return pDate.toDateString() === date.toDateString()
            }).map(p => new Date(p.scheduled_at).getTime())

            // Add times we just assigned in this loop (for previous reels)
            const newOnDate = Object.values(slots)
                .filter(d => d.toDateString() === date.toDateString())
                .map(d => d.getTime())

            let busyTimes = [...existingOnDate, ...newOnDate].sort((a, b) => a - b)

            // Try to find slots for 'targetForToday'
            while (postsScheduledToday < targetForToday && searchTime < dayEndTime && reelIndex < reelsList.length) {
                const candidateTime = searchTime.getTime()

                // Check conflicts
                const hasConflict = busyTimes.some(busyTime => Math.abs(busyTime - candidateTime) < minGapMs)

                if (!hasConflict) {
                    // Success: Assign Slot
                    const reel = reelsList[reelIndex]
                    slots[reel.id] = new Date(searchTime)

                    // Update State
                    busyTimes.push(candidateTime)
                    busyTimes.sort((a, b) => a - b)
                    postsScheduledToday++
                    reelIndex++

                    // Advance search by gap
                    searchTime = new Date(searchTime.getTime() + minGapMs)
                } else {
                    // Conflict: Nudge forward by 30 mins to find a gap
                    searchTime = new Date(searchTime.getTime() + 30 * 60 * 1000)
                }
            }

            // Move to next day
            currentDayOffset++
        }

        return slots
    }, [reels, selectedReels, scheduleMode, scheduleDays, upcomingPosts, startDayOption, scheduleStrategy, minGapHours, startHour])

    const proposedPostsForCalendar = useMemo(() => {
        if (!calculatedSchedule) return []
        return Object.entries(calculatedSchedule).map(([id, date]) => {
            const reel = reels.find(r => r.id === id)
            return {
                id: `proposed-${id}`,
                scheduled_at: date.toISOString(),
                text: reel?.generated_caption || reel?.title || "Proposed Post",
                media: [{ url: `/downloads/${jobId}/${reel?.processed_path}` }], // Use simplified media object
                accounts: [] // Proposed doesn't have accounts yet strictly speaking for display
            }
        })
    }, [calculatedSchedule, reels, jobId])


    const handleSchedule = async () => {
        if (selectedAccounts.size === 0) {
            alert("Please select at least one social account")
            return
        }
        if (selectedReels.size === 0) {
            alert("Please select at least one video")
            return
        }

        setIsScheduling(true)
        try {
            const reelsToSchedule = reels.filter(r => selectedReels.has(r.id))

            const payload = reelsToSchedule.map(r => {
                let scheduledAt = ""
                if (scheduleMode === 'manual') {
                    scheduledAt = scheduleTime
                } else {
                    // Smart Mode
                    const date = calculatedSchedule ? calculatedSchedule[r.id] : null
                    if (date) scheduledAt = date.toISOString()
                }

                return {
                    reelId: r.id,
                    // Fix Prompt: Use title if generated_caption is missing
                    caption: r.generated_caption || r.title || "Check this out! #viral",
                    scheduledAt: scheduledAt
                }
            })

            const results = await scheduleBatchToPubler(
                jobId,
                payload,
                { apiKey, workspaceId },
                Array.from(selectedAccounts)
            )

            setScheduleResults(results)
            // Refresh upcoming posts to show new items on calendar
            loadUpcomingPosts()
            setShowSuccess(true)
            setTimeout(() => setShowSuccess(false), 3000)
        } catch (e) {
            alert("Scheduling failed: " + e)
        } finally {
            setIsScheduling(false)
        }
    }

    // Toggle Reel Selection
    const toggleReel = (id: string) => {
        const next = new Set(selectedReels)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        setSelectedReels(next)
    }

    // Toggle Account Selection
    const toggleAccount = (id: string) => {
        const next = new Set(selectedAccounts)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        setSelectedAccounts(next)
    }

    if (!job) return <div className="min-h-screen bg-black text-slate-50 pt-24"><Loader2 className="mx-auto animate-spin" /></div>

    return (
        <div className="min-h-screen bg-black text-slate-50 flex flex-col pt-24 pb-32 relative">
            {/* Success Overlay */}
            {showSuccess && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-zinc-900 border border-emerald-500/30 p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-4 animate-in zoom-in-50 duration-300 slide-in-from-bottom-5">
                        <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-2">
                            <CheckCircle className="w-8 h-8 text-emerald-500 animate-bounce" />
                        </div>
                        <h3 className="text-xl font-bold text-white">All Scheduled!</h3>
                        <p className="text-zinc-400 text-sm text-center">
                            Your posts have been successfully queued<br />on Publer.
                        </p>
                        <Button onClick={() => setShowSuccess(false)} variant="outline" className="mt-2 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10">
                            Awesome
                        </Button>
                    </div>
                </div>
            )}

            <SiteHeader
                step={6}
                backUrl={`/jobs/${jobId}/processing`}
            />

            {/* Removed max-w, using full width padding */}
            <div className="w-full px-6 space-y-6">

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

                    {/* Left Column: Config & Content (Narrower: 4 cols) */}
                    <div className="lg:col-span-4 space-y-6">

                        {/* 1. Configuration Section */}
                        <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5">
                            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <User className="w-5 h-5 text-emerald-500" />
                                Configuration
                            </h2>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-xs text-zinc-400">API Key</Label>
                                    <Input
                                        type="password"
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                        placeholder="Publer API Key"
                                        className="bg-zinc-950 border-white/10 text-xs"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs text-zinc-400">Workspace ID</Label>
                                    <Input
                                        value={workspaceId}
                                        onChange={(e) => setWorkspaceId(e.target.value)}
                                        placeholder="Optional Workspace ID"
                                        className="bg-zinc-950 border-white/10 text-xs"
                                    />
                                </div>


                                {!hasCredentials && authStep !== 'connected' && (
                                    <div className="pt-2">
                                        {/* Connect Flow */}
                                        {authStep === 'input' && (
                                            <Button onClick={handleConnect} disabled={isLoading || !apiKey} className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-bold h-9">
                                                {isLoading ? <Loader2 className="animate-spin w-4 h-4" /> : "Connect Account"}
                                            </Button>
                                        )}

                                        {authStep === 'select_workspace' && (
                                            <div className="space-y-2 animate-in fade-in">
                                                <Label className="text-xs">Select Workspace:</Label>
                                                <div className="flex flex-col gap-2">
                                                    {workspaces.map(ws => (
                                                        <Button
                                                            key={ws.id}
                                                            variant="outline"
                                                            onClick={() => selectWorkspace(ws.id)}
                                                            className="justify-start border-emerald-500/50 hover:bg-emerald-500/10 text-xs h-8"
                                                        >
                                                            {ws.name}
                                                        </Button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {authStep === 'connected' && (
                                    <div className="space-y-4 pt-4 animate-in fade-in border-t border-white/5">
                                        <div className="space-y-2">
                                            <Label className="text-xs text-zinc-400">Select Accounts</Label>
                                            <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin">
                                                {accounts.map(acc => (
                                                    <button
                                                        key={acc.id}
                                                        onClick={() => toggleAccount(acc.id)}
                                                        className={cn(
                                                            "flex items-center gap-3 px-3 py-2 rounded-lg border transition-all w-full text-left group hover:scale-[1.02]",
                                                            selectedAccounts.has(acc.id)
                                                                ? "border-emerald-500/50 bg-emerald-500/10"
                                                                : "border-white/5 bg-zinc-950/50 hover:bg-zinc-900"
                                                        )}
                                                    >
                                                        <div className="w-6 h-6 rounded-full bg-zinc-800 overflow-hidden flex-shrink-0">
                                                            {acc.thumb && <img src={acc.thumb} alt="" className="w-full h-full object-cover" />}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="text-xs font-medium truncate">{acc.name}</div>
                                                            <div className="text-[10px] text-zinc-500 capitalize">{acc.type}</div>
                                                        </div>
                                                        {selectedAccounts.has(acc.id) && (
                                                            <CheckCircle className="w-3 h-3 text-emerald-500 ml-auto flex-shrink-0" />
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between text-[10px] text-emerald-500 bg-emerald-500/5 px-2 py-1 rounded border border-emerald-500/20">
                                            <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Connected</span>
                                            <Button variant="ghost" size="icon" className="h-4 w-4 hover:bg-emerald-500/20" onClick={loadUpcomingPosts} disabled={isLoadingPosts}>
                                                <Loader2 className={cn("w-3 h-3", isLoadingPosts && "animate-spin")} />
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 2. Content Selection (Still in Left Column) */}
                        {authStep === 'connected' && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
                                <div className="flex items-center justify-between bg-black/80 backdrop-blur py-2 border-b border-white/5">
                                    <h2 className="text-lg font-bold flex items-center gap-2">
                                        <Upload className="w-5 h-5 text-emerald-500" />
                                        Select Content <span className="text-zinc-500 text-xs font-normal">({selectedReels.size})</span>
                                    </h2>
                                    <div className="flex gap-1">

                                        <Button size="sm" variant="ghost" className="text-[10px] h-7 px-2" onClick={() => {
                                            if (selectedReels.size === reels.length) setSelectedReels(new Set())
                                            else setSelectedReels(new Set(reels.map(r => r.id)))
                                        }}>
                                            {selectedReels.size === reels.length ? "None" : "All"}
                                        </Button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 pb-32">
                                    {reels.map(reel => {
                                        const smartDate = scheduleMode === 'smart' && calculatedSchedule ? calculatedSchedule[reel.id] : null
                                        const isSelected = selectedReels.has(reel.id)

                                        return (
                                            <div
                                                key={reel.id}
                                                className={cn(
                                                    "relative group border rounded-xl overflow-hidden transition-all duration-200 cursor-pointer hover:shadow-xl",
                                                    isSelected
                                                        ? "border-emerald-500 ring-1 ring-emerald-500 bg-zinc-900"
                                                        : "border-white/10 bg-zinc-900/40 opacity-70 hover:opacity-100 hover:scale-[1.02]"
                                                )}
                                                onClick={() => toggleReel(reel.id)}
                                            >
                                                <div className="aspect-[9/16] relative bg-black">
                                                    <video
                                                        src={`/downloads/${jobId}/${reel.processed_path}`}
                                                        className="w-full h-full object-cover"
                                                        muted
                                                        loop
                                                        onMouseOver={e => e.currentTarget.play()}
                                                        onMouseOut={e => {
                                                            e.currentTarget.pause()
                                                            e.currentTarget.currentTime = 0
                                                        }}
                                                    />

                                                    <div className="absolute top-2 right-2 z-10 transition-transform duration-200 group-hover:scale-110">
                                                        <div className={cn(
                                                            "w-5 h-5 rounded-full border flex items-center justify-center shadow-lg",
                                                            isSelected
                                                                ? "bg-emerald-500 border-emerald-500"
                                                                : "bg-black/40 border-white/50"
                                                        )}>
                                                            {isSelected && <CheckCircle className="w-3 h-3 text-black" />}
                                                        </div>
                                                    </div>

                                                    {/* Smart Schedule Tag */}
                                                    {smartDate && isSelected && (
                                                        <div className="absolute bottom-2 left-2 right-2 bg-zinc-950/90 backdrop-blur border border-emerald-500/30 text-emerald-400 text-[9px] font-bold p-1 rounded-md text-center shadow-lg">
                                                            <div>
                                                                {smartDate.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}
                                                            </div>
                                                            <div>
                                                                {smartDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="p-2 space-y-1.5 border-t border-white/5">
                                                    <div className="text-[9px] bg-zinc-950 p-1.5 rounded border border-white/5 text-slate-400 line-clamp-2 leading-tight">
                                                        {reel.generated_caption || reel.title || "No caption"}
                                                    </div>
                                                    <p className="text-[8px] font-mono text-zinc-600 truncate">{reel.processed_path}</p>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </div>


                    {/* Right Column: Scheduler & Calendar (Wider: 8 cols, Sticky) */}
                    {authStep === 'connected' && (
                        <div className="lg:col-span-8 space-y-4 animate-in fade-in slide-in-from-right-8 duration-500 delay-200 lg:sticky lg:top-24 h-fit max-h-[calc(100vh-8rem)] overflow-y-auto pr-1 no-scrollbar">

                            {/* Scheduler Controls (Compact) */}
                            <div className="bg-zinc-900/90 backdrop-blur border border-white/10 rounded-xl p-3 shadow-xl">
                                <div className="flex items-center justify-between mb-2">
                                    <h2 className="text-xs font-bold flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5 text-emerald-500" />
                                        Smart Scheduling
                                    </h2>
                                    <div className="flex bg-black/40 rounded-lg border border-white/5 p-0.5">
                                        {[
                                            { id: 'smart', label: 'Auto', icon: Sparkles },
                                            { id: 'manual', label: 'Manual', icon: Clock }
                                        ].map(mode => (
                                            <button
                                                key={mode.id}
                                                onClick={() => setScheduleMode(mode.id as 'smart' | 'manual')}
                                                className={cn(
                                                    "px-2 py-0.5 text-[10px] font-bold rounded-md transition-all flex items-center gap-1",
                                                    scheduleMode === mode.id
                                                        ? "bg-emerald-500 text-black shadow-sm"
                                                        : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                                                )}
                                            >
                                                <mode.icon className="w-3 h-3" />
                                                {mode.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {scheduleMode === 'manual' ? (
                                    <div className="animate-in fade-in slide-in-from-top-1">
                                        <div className="flex items-center gap-2">
                                            <Input
                                                type="datetime-local"
                                                value={scheduleTime}
                                                onChange={(e) => setScheduleTime(e.target.value)}
                                                className="bg-zinc-950 border-white/10 invert-calendar-icon text-[10px] h-7 w-fit px-2" // Ultra Compact Input
                                            />
                                            <p className="text-[10px] text-zinc-500">
                                                *Fixed time
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-2 animate-in fade-in slide-in-from-top-1">

                                        {/* Control Grid - Tighter */}
                                        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                                            {/* Days Slider */}
                                            <div className="space-y-0.5">
                                                <div className="flex justify-between items-center">
                                                    <Label className="text-[9px] text-zinc-400 font-medium">Spread Over</Label>
                                                    <span className="font-mono text-[9px] text-emerald-400">{scheduleDays} Days</span>
                                                </div>
                                                <Slider
                                                    value={[scheduleDays]}
                                                    min={1}
                                                    max={14}
                                                    step={1}
                                                    onValueChange={(val) => setScheduleDays(val[0])}
                                                    className="py-1"
                                                />
                                            </div>

                                            {/* Min Gap Slider */}
                                            <div className="space-y-0.5">
                                                <div className="flex justify-between items-center">
                                                    <Label className="text-[9px] text-zinc-400 font-medium">Min Gap</Label>
                                                    <span className="font-mono text-[9px] text-emerald-400">{minGapHours}h</span>
                                                </div>
                                                <Slider
                                                    value={[minGapHours]}
                                                    min={0.5}
                                                    max={8}
                                                    step={0.5}
                                                    onValueChange={(val) => setMinGapHours(val[0])}
                                                    className="py-1"
                                                />
                                            </div>

                                            {/* Start Hour Slider */}
                                            <div className="space-y-0.5 col-span-2">
                                                <div className="flex justify-between items-center">
                                                    <Label className="text-[9px] text-zinc-400 font-medium">Start Hour</Label>
                                                    <span className="font-mono text-[9px] text-emerald-400">{startHour}:00</span>
                                                </div>
                                                <Slider
                                                    value={[startHour]}
                                                    min={0}
                                                    max={23}
                                                    step={1}
                                                    onValueChange={(val) => setStartHour(val[0])}
                                                    className="py-1"
                                                />
                                            </div>

                                            {/* Toggles - Compact horizontal layout */}
                                            <div className="flex gap-2 col-span-2">
                                                <div className="flex-1 flex items-center justify-between bg-zinc-950/50 p-1 rounded border border-white/5">
                                                    <Label className="text-[9px] text-zinc-400 cursor-pointer" onClick={() => setStartDayOption(prev => prev === 'today' ? 'tomorrow' : 'today')}>Start</Label>
                                                    <div className="flex text-[8px] font-bold bg-black rounded p-0.5 ml-1">
                                                        <button
                                                            onClick={() => setStartDayOption('today')}
                                                            className={cn("px-1.5 py-0.5 rounded transition-colors", startDayOption === 'today' ? "bg-zinc-800 text-white" : "text-zinc-600 hover:text-zinc-500")}
                                                        >Today</button>
                                                        <button
                                                            onClick={() => setStartDayOption('tomorrow')}
                                                            className={cn("px-1.5 py-0.5 rounded transition-colors", startDayOption === 'tomorrow' ? "bg-zinc-800 text-white" : "text-zinc-600 hover:text-zinc-500")}
                                                        >Tmrw</button>
                                                    </div>
                                                </div>

                                                <div className="flex-[1.5] flex items-center justify-between bg-zinc-950/50 p-1 rounded border border-white/5">
                                                    <Label className="text-[9px] text-zinc-400 cursor-pointer" onClick={() => setScheduleStrategy(prev => prev === 'fill' ? 'append' : 'fill')}>Strategy</Label>
                                                    <div className="flex text-[8px] font-bold bg-black rounded p-0.5 ml-1">
                                                        <button
                                                            onClick={() => setScheduleStrategy('fill')}
                                                            className={cn("px-1.5 py-0.5 rounded transition-colors", scheduleStrategy === 'fill' ? "bg-zinc-800 text-white" : "text-zinc-600 hover:text-zinc-500")}
                                                            title="Fill available gaps"
                                                        >Fill</button>
                                                        <button
                                                            onClick={() => setScheduleStrategy('append')}
                                                            className={cn("px-1.5 py-0.5 rounded transition-colors", scheduleStrategy === 'append' ? "bg-zinc-800 text-white" : "text-zinc-600 hover:text-zinc-500")}
                                                            title="Add to end of schedule"
                                                        >Append</button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="text-[9px] text-zinc-600 bg-black/20 border-t border-white/5 pt-1.5 pb-0.5 flex justify-between">
                                            <span>
                                                {selectedReels.size}/{scheduleDays}d ≈ {Math.max(1, Math.round(selectedReels.size / scheduleDays))}/d
                                            </span>
                                            <span className="text-emerald-500/80">
                                                {scheduleStrategy === 'fill' ? `Gaps > ${minGapHours}h` : "Appends"}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Calendar Preview */}
                            <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-4 overflow-hidden">
                                <h3 className="text-xs font-bold mb-3 flex items-center justify-between text-zinc-400">
                                    POST PREVIEW
                                    <span className="text-[9px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-1.5 py-0.5 rounded font-mono">LIVE</span>
                                </h3>
                                <CalendarView
                                    posts={upcomingPosts}
                                    accounts={accounts}
                                    proposedPosts={proposedPostsForCalendar}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Bar */}
            <div className="fixed bottom-0 left-0 w-full p-4 bg-black/90 backdrop-blur border-t border-white/10 flex justify-end gap-4 z-40">
                <Button variant="ghost" onClick={() => router.back()}>Cancel</Button>
                <Button
                    size="lg"
                    className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold px-8 shadow-glow-lg"
                    disabled={authStep !== 'connected' || selectedReels.size === 0 || selectedAccounts.size === 0 || isScheduling}
                    onClick={handleSchedule}
                >
                    {isScheduling ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Scheduling...
                        </>
                    ) : (
                        <>
                            <Send className="w-4 h-4 mr-2" /> Schedule {selectedReels.size} Posts
                        </>
                    )}
                </Button>
            </div>

            <style jsx global>{`
                .shadow-glow-lg {
                    box-shadow: 0 0 20px rgba(16, 185, 129, 0.4);
                }
                .invert-calendar-icon::-webkit-calendar-picker-indicator {
                    filter: invert(1);
                }
                /* Hide Scrollbars */
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .no-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
                body::-webkit-scrollbar {
                    display: none;
                }
                body {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
                /* Ensure nested scroll containers also generally look clean or hidden if desired,
                   but keeping them accessible via touch/wheel is key. */
                *::-webkit-scrollbar {
                    width: 0px;
                    background: transparent;
                }
            `}</style>
        </div>
    )
}
