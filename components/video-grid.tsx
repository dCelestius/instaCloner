import { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface VideoGridProps {
    children: ReactNode
    className?: string
}

export function VideoGrid({ children, className }: VideoGridProps) {
    return (
        <div className={cn(
            "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3 md:gap-4 p-4",
            className
        )}>
            {children}
        </div>
    )
}
