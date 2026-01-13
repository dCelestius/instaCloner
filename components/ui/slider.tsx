"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value'> {
    value: number[]
    onValueChange: (value: number[]) => void
    max?: number
    step?: number
}

// Simple custom slider using input range for now to avoid dealing with Radix deps if they aren't installed
export function Slider({ className, value, onValueChange, max = 100, step = 1, ...props }: SliderProps) {
    const val = value[0] ?? 0

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onValueChange([parseFloat(e.target.value)])
    }

    return (
        <div className={cn("relative flex w-full touch-none select-none items-center", className)}>
            <input
                type="range"
                min={props.min}
                max={max}
                step={step}
                value={val}
                onChange={handleChange}
                className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
        </div>
    )
}
