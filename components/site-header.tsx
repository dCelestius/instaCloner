"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { ChevronLeft, Layers } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface SiteHeaderProps {
    step: 1 | 2 | 3 | 4
    backUrl?: string
    rightContent?: React.ReactNode
}

export function SiteHeader({ step, backUrl, rightContent }: SiteHeaderProps) {
    const router = useRouter()

    const steps = [
        { id: 1, label: "Source" },
        { id: 2, label: "Review" },
        { id: 3, label: "Brand" },
        { id: 4, label: "Export" },
    ]

    return (
        <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-black/80 backdrop-blur border-b border-white/10 flex items-center justify-between px-6">

            {/* Left: Branding or Back */}
            <div className="flex items-center gap-4 w-[200px]">
                {backUrl ? (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(backUrl)}
                        className="text-slate-400 hover:text-white -ml-2"
                    >
                        <ChevronLeft className="w-4 h-4 mr-1" />
                        Back
                    </Button>
                ) : (
                    <div className="flex items-center gap-2 text-white font-bold tracking-tight">
                        <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                            <Layers className="w-5 h-5 text-black" />
                        </div>
                        <span>ContentEngine</span>
                    </div>
                )}
            </div>

            {/* Center: Radix-style Stepper Slider */}
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center bg-zinc-900/50 rounded-full p-1 border border-white/5">
                {steps.map((s) => {
                    const isActive = step === s.id
                    const isCompleted = step > s.id

                    return (
                        <div key={s.id} className="relative px-4 py-1.5">
                            {isActive && (
                                <motion.div
                                    layoutId="activeStep"
                                    className="absolute inset-0 bg-zinc-800 rounded-full shadow-sm"
                                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                />
                            )}
                            <span className={cn(
                                "relative z-10 text-xs font-medium transition-colors duration-300",
                                isActive ? "text-white" : isCompleted ? "text-emerald-500" : "text-slate-600"
                            )}>
                                {s.label}
                            </span>
                        </div>
                    )
                })}
            </div>

            {/* Right: Actions */}
            <div className="flex items-center justify-end gap-4 w-[200px]">
                {rightContent}
            </div>

        </header>
    )
}
