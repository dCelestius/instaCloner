"use client"

import { useState, useMemo } from "react"
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, List, Grid3X3, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface CalendarViewProps {
    posts: any[]
    accounts: any[]
    proposedPosts?: any[]
}

type ViewMode = 'month' | 'week' | 'day'

export function CalendarView({ posts, accounts, proposedPosts = [] }: CalendarViewProps) {
    const [viewMode, setViewMode] = useState<ViewMode>('week')
    const [currentDate, setCurrentDate] = useState(new Date())
    const [selectedAccountId, setSelectedAccountId] = useState<string | 'all'>('all')

    // --- Helpers ---
    const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate()
    const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay() // 0 = Sun

    // Sort posts (merge existing and proposed)
    const allPosts = useMemo(() => {
        // Tag valid posts
        const real = posts.map(p => ({ ...p, _type: 'real' }))

        // Tag proposed
        const proposed = proposedPosts.map(p => ({ ...p, _type: 'proposed' }))

        // Merge
        let combined = [...real, ...proposed]

        // Filter logic 
        if (selectedAccountId !== 'all') {
            combined = combined.filter(p => {
                if (p._type === 'proposed') return true // Always show proposed for preview? Or filter by target?
                // Let's assume proposed are "channel agnostic" until scheduled, or we could pass target accounts.
                // For now, always showing proposed is safer for feedback.

                // Existing filter logic for real posts
                const accs = p.accounts || p.account || []
                const list = Array.isArray(accs) ? accs : [accs]
                return list.some((a: any) => {
                    const id = typeof a === 'object' && a !== null ? (a.id || a.key || a._id || a.id_str) : a
                    return String(id) === String(selectedAccountId)
                })
            })
        }
        return combined.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
    }, [posts, proposedPosts, selectedAccountId])

    // --- Navigation ---
    const next = () => {
        const newDate = new Date(currentDate)
        if (viewMode === 'month') newDate.setMonth(newDate.getMonth() + 1)
        else if (viewMode === 'week') newDate.setDate(newDate.getDate() + 7)
        else newDate.setDate(newDate.getDate() + 1)
        setCurrentDate(newDate)
    }

    const prev = () => {
        const newDate = new Date(currentDate)
        if (viewMode === 'month') newDate.setMonth(newDate.getMonth() - 1)
        else if (viewMode === 'week') newDate.setDate(newDate.getDate() - 7)
        else newDate.setDate(newDate.getDate() - 1)
        setCurrentDate(newDate)
    }

    const today = () => setCurrentDate(new Date())

    // --- Helpers for Render ---
    const getMediaUrl = (post: any) => {
        const mediaItem = post.media?.[0]
        if (!mediaItem) return null
        if (typeof mediaItem === 'string') return mediaItem
        return mediaItem.url || mediaItem.link || mediaItem.media_url
    }

    // --- Renders ---

    const renderHeader = () => (
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            {/* Account Tabs */}
            <div className="flex gap-2 overflow-x-auto max-w-full pb-2 scrollbar-hide">
                <Button
                    variant={selectedAccountId === 'all' ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedAccountId('all')}
                    className={cn(selectedAccountId === 'all' ? "bg-emerald-500 text-black hover:bg-emerald-600" : "text-zinc-400 border-white/10 hover:bg-zinc-800")}
                >
                    All Accounts
                </Button>
                {accounts.map(acc => (
                    <Button
                        key={acc.id}
                        variant={selectedAccountId === acc.id ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedAccountId(acc.id)}
                        className={cn("flex items-center gap-2", selectedAccountId === acc.id ? "bg-emerald-500 text-black hover:bg-emerald-600" : "text-zinc-400 border-white/10 hover:bg-zinc-800")}
                    >
                        <img src={acc.thumb} className="w-4 h-4 rounded-full" alt="" />
                        {acc.name}
                    </Button>
                ))}
            </div>

            {/* View Controls */}
            <div className="flex items-center gap-2 bg-zinc-900 border border-white/10 p-1 rounded-lg">
                <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setViewMode('month')}
                    className={cn("w-8 h-8", viewMode === 'month' && "bg-zinc-800 text-emerald-500")}
                >
                    <CalendarIcon className="w-4 h-4" />
                </Button>
                <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setViewMode('week')}
                    className={cn("w-8 h-8", viewMode === 'week' && "bg-zinc-800 text-emerald-500")}
                >
                    <Grid3X3 className="w-4 h-4" />
                </Button>
                <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setViewMode('day')}
                    className={cn("w-8 h-8", viewMode === 'day' && "bg-zinc-800 text-emerald-500")}
                >
                    <List className="w-4 h-4" />
                </Button>
            </div>

            {/* Date Nav */}
            <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={prev}><ChevronLeft className="w-4 h-4" /></Button>
                <span className="min-w-[140px] text-center font-bold">
                    {currentDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                    {viewMode === 'day' && ` ${currentDate.getDate()}`}
                </span>
                <Button variant="ghost" size="icon" onClick={next}><ChevronRight className="w-4 h-4" /></Button>
                <Button variant="outline" size="sm" onClick={today} className="ml-2 border-white/10">Today</Button>
            </div>
        </div>
    )

    const renderPostCell = (post: any) => {
        const isProposed = post._type === 'proposed'
        const colorClass = isProposed
            ? "bg-violet-500/20 border-violet-500/50 hover:bg-violet-500/30"
            : "bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20"

        const barClass = isProposed ? "bg-violet-500" : "bg-emerald-500"
        const timeClass = isProposed ? "text-violet-300" : "text-emerald-400"

        return (
            <div key={post.id || Math.random()} className={cn("text-[10px] p-1 mb-1 rounded flex items-center gap-1 overflow-hidden group transition-colors cursor-default border", colorClass)}>
                <div className={cn("w-1 h-full rounded-full shrink-0", barClass)} />
                <span className={cn("font-mono shrink-0", timeClass)}>
                    {new Date(post.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="truncate text-zinc-300">{isProposed ? "(Proposed) " : ""}{post.text}</span>
            </div>
        )
    }

    const renderMonthView = () => {
        const year = currentDate.getFullYear()
        const month = currentDate.getMonth()
        const daysInMonth = getDaysInMonth(year, month)
        const firstDay = getFirstDayOfMonth(year, month)

        const days = []
        // Empty cells for padding
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="h-32 bg-zinc-950/30 border border-white/5" />)
        }

        // Day cells
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day)
            const isToday = new Date().toDateString() === date.toDateString()
            const daysPosts = allPosts.filter(p => new Date(p.scheduled_at).toDateString() === date.toDateString())

            days.push(
                <div key={day} className={cn("h-32 p-2 border border-white/5 bg-zinc-900/20 relative flex flex-col hover:bg-zinc-900/40 transition-colors", isToday && "bg-emerald-500/5 ring-1 ring-emerald-500/20")}>
                    <span className={cn("text-xs font-bold mb-2 w-6 h-6 flex items-center justify-center rounded-full", isToday ? "bg-emerald-500 text-black" : "text-zinc-500")}>
                        {day}
                    </span>
                    <div className="flex-1 overflow-y-auto scrollbar-hide">
                        {daysPosts.map(renderPostCell)}
                    </div>
                </div>
            )
        }

        return (
            <div className="grid grid-cols-7 gap-px bg-zinc-800 border border-white/10 rounded-lg overflow-hidden">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                    <div key={d} className="p-2 text-center text-xs font-bold text-zinc-500 bg-zinc-950 uppercase tracking-wider">{d}</div>
                ))}
                {days}
            </div>
        )
    }

    const renderWeekView = () => {
        // Simply show 7 columns starting from the beginning of the week of current date
        const startOfWeek = new Date(currentDate)
        startOfWeek.setDate(currentDate.getDate() - currentDate.getDay())

        const days = []
        for (let i = 0; i < 7; i++) {
            const date = new Date(startOfWeek)
            date.setDate(startOfWeek.getDate() + i)
            const daysPosts = allPosts.filter(p => new Date(p.scheduled_at).toDateString() === date.toDateString())
            const isToday = new Date().toDateString() === date.toDateString()

            days.push(
                <div key={i} className="flex-1 min-h-[400px] border-r border-white/5 last:border-r-0 p-2 bg-zinc-900/20 hover:bg-zinc-900/40 transition-colors flex flex-col gap-2">
                    <div className={cn("text-center p-2 rounded mb-2", isToday ? "bg-emerald-500/10 text-emerald-400 font-bold" : "text-zinc-400")}>
                        <div className="text-xs uppercase">{date.toLocaleDateString(undefined, { weekday: 'short' })}</div>
                        <div className="text-lg">{date.getDate()}</div>
                    </div>
                    <div className="space-y-2">
                        {daysPosts.map(renderPostCell)}
                    </div>
                </div>
            )
        }

        return (
            <div className="flex border border-white/10 rounded-lg overflow-hidden bg-zinc-950">
                {days}
            </div>
        )
    }

    const renderDayView = () => {
        const daysPosts = allPosts.filter(p => new Date(p.scheduled_at).toDateString() === currentDate.toDateString())

        // Simple list roughly ordered by time
        // We could do a full hourly grid but a list is often cleaner for social posts if sparse

        // Let's do hourly slots for a "Clean" feel
        const hours = Array.from({ length: 24 }, (_, i) => i)

        return (
            <div className="border border-white/10 rounded-lg bg-zinc-950 h-[600px] overflow-y-auto relative">
                {hours.map(hour => {
                    const slotPosts = daysPosts.filter(p => new Date(p.scheduled_at).getHours() === hour)
                    return (
                        <div key={hour} className="flex border-b border-white/5 last:border-0 min-h-[60px] group hover:bg-zinc-900/30">
                            <div className="w-16 p-2 text-xs text-zinc-600 border-r border-white/5 text-right font-mono">
                                {hour.toString().padStart(2, '0')}:00
                            </div>
                            <div className="flex-1 p-1 relative">
                                {slotPosts.map(post => {
                                    const mediaUrl = getMediaUrl(post)
                                    const isProposed = post._type === 'proposed'
                                    const colorClass = isProposed
                                        ? "bg-violet-500/10 border-violet-500 border-l-2"
                                        : "bg-emerald-500/10 border-emerald-500 border-l-2"

                                    const timeClass = isProposed ? "text-violet-400" : "text-emerald-400"

                                    return (
                                        <div key={post.id || Math.random()} className={cn("flex items-center gap-3 p-2 rounded mb-1", colorClass)}>
                                            <div className="w-12 h-12 bg-black rounded overflow-hidden shrink-0 border border-white/10">
                                                {mediaUrl ? (
                                                    <img src={mediaUrl} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-zinc-700 text-[10px] break-all p-1">
                                                        {isProposed ? "Pending" : "No Image"}
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <div className={cn("text-xs font-mono mb-1", timeClass)}>
                                                    {new Date(post.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                                <p className="text-sm text-zinc-200 line-clamp-1">{post.text}</p>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )
                })}
            </div>
        )
    }

    return (
        <div className="w-full animate-in fade-in duration-500">
            {renderHeader()}

            {viewMode === 'month' && renderMonthView()}
            {viewMode === 'week' && renderWeekView()}
            {viewMode === 'day' && renderDayView()}
        </div>
    )
}
