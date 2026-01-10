"use client"

import { motion } from "framer-motion"
import { ArrowRight, Instagram } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { createScrapeJob } from "./actions"

import { useState } from "react"

export default function Home() {
  const [url, setUrl] = useState("")
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-slate-950 to-slate-950 -z-10" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl -z-10 animate-pulse" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -z-10" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full max-w-lg"
      >
        <div className="flex flex-col items-center space-y-6 text-center mb-8">
          <div className="p-4 bg-white/5 rounded-full ring-1 ring-white/10 shadow-xl backdrop-blur-xl">
            <Instagram className="w-12 h-12 text-pink-500" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
            Reels Curator
          </h1>
          <p className="text-muted-foreground text-lg max-w-md">
            Enter an Instagram profile URL to identify, scrape, and curate top-performing reels.
          </p>
        </div>

        <Card className="border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl ring-1 ring-white/10">
          <CardContent className="pt-6">
            <form action={createScrapeJob} className="flex flex-col gap-4">
              <div className="relative">
                <Input
                  name="url"
                  type="url"
                  placeholder="https://instagram.com/username"
                  className="bg-black/20 border-white/10 h-12 text-base px-4 focus-visible:ring-pink-500/50 transition-all font-mono"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </div>
              <Button
                type="submit"
                size="lg"
                className="w-full h-12 text-base font-semibold bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 transition-all shadow-lg shadow-pink-500/20"
              >
                Start Curating <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </form>

            <div className="mt-6 space-y-3">
              <p className="text-xs text-center text-muted-foreground uppercase tracking-widest font-medium">Try a Preset</p>
              <div className="flex flex-wrap gap-2 justify-center">
                <button
                  onClick={() => setUrl("https://www.instagram.com/evolving.ai/")}
                  type="button"
                  className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
                >
                  @evolving.ai
                </button>
                <button
                  onClick={() => setUrl("https://www.instagram.com/historyphotographed/reels/")}
                  type="button"
                  className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
                >
                  @historyphotographed
                </button>
                <button
                  onClick={() => setUrl("https://www.instagram.com/wealth/reels/")}
                  type="button"
                  className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
                >
                  @wealth
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </main>
  )
}
