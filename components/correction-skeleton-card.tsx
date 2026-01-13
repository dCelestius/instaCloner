import { Skeleton } from "@/components/ui/skeleton"
import { Loader2 } from "lucide-react"

export function CorrectionSkeletonCard() {
    return (
        <div className="flex flex-col gap-3">
            <div className="relative aspect-[9/16] rounded-xl overflow-hidden border border-white/5 bg-zinc-900/50 flex flex-col group">
                {/* Background Video Placeholder */}
                <div className="absolute inset-0 bg-zinc-900" />

                {/* Header Operation Visual */}
                <div className="absolute top-0 inset-x-0 h-[15%] bg-emerald-500/10 border-b border-emerald-500/30 flex items-center justify-center animate-pulse">
                    <div className="flex items-center gap-2 text-emerald-500/50">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Adjusting...</span>
                    </div>
                </div>

                {/* Shimmer overlay */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-500/5 to-transparent -translate-x-full animate-shimmer" />
            </div>

            {/* Caption Placeholder */}
            <div className="p-3 bg-zinc-900/20 border border-white/5 rounded-lg flex flex-col gap-2 opacity-50">
                <Skeleton className="h-2 w-full bg-zinc-900" />
                <Skeleton className="h-2 w-3/4 bg-zinc-900" />
            </div>

            <div className="px-1 flex justify-between items-center opacity-30">
                <Skeleton className="h-2 w-16 bg-zinc-900" />
                <Skeleton className="h-2 w-20 bg-zinc-900" />
            </div>
        </div>
    )
}
