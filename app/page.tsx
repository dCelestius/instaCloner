"use client"

import { motion } from "framer-motion"
import { ArrowRight, Instagram, Layers, Zap, Shield, Sparkles, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { createScrapeJob } from "./actions"
import { useState, useTransition } from "react"
import { cn } from "@/lib/utils"

export default function Home() {
  const [url, setUrl] = useState("")
  const [reelsCount, setReelsCount] = useState(12)
  const [isPending, startTransition] = useTransition()

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center justify-center p-6 relative overflow-hidden">

      {/* Premium Background Elements */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.05),transparent_50%)]" />
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-xl z-10"
      >
        <div className="flex flex-col items-center space-y-8 text-center mb-12">
          <div className="relative">
            <div className="absolute inset-0 bg-emerald-500 blur-2xl opacity-20 animate-pulse" />
            <div className="relative p-5 bg-black rounded-3xl ring-1 ring-white/20 shadow-2xl">
              <Instagram className="w-10 h-10 text-emerald-400" />
            </div>
          </div>

          <div className="space-y-4">
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-none">
              REELS<span className="text-emerald-500">.</span>CURATOR
            </h1>
            <p className="text-slate-400 text-lg md:text-xl font-medium max-w-md mx-auto leading-relaxed">
              Automated high-performance curation. Identify, scrape, and bake brand designs into top-performing reels.
            </p>
          </div>
        </div>

        <Card className="border-white/10 bg-black/40 backdrop-blur-2xl shadow-[0_30px_100px_rgba(0,0,0,0.5)] rounded-[2.5rem] overflow-hidden">
          <CardContent className="p-8 md:p-10 space-y-8">
            <form
              action={(formData) => {
                startTransition(async () => {
                  try {
                    await createScrapeJob(formData)
                  } catch (error) {
                    console.error("Scrape job failed:", error)
                  }
                })
              }}
              className="space-y-8"
            >
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 ml-1">Target Profile</label>
                <Input
                  name="url"
                  type="url"
                  placeholder="https://instagram.com/username"
                  className="bg-white/5 border-white/10 h-14 text-lg px-6 rounded-2xl focus-visible:ring-emerald-500/50 transition-all font-mono placeholder:text-slate-600 disabled:opacity-50"
                  required
                  disabled={isPending}
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </div>

              <div className="space-y-4 pt-2">
                <div className="flex justify-between items-end pb-1">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 ml-1">Batch Size</label>
                    <p className="text-[11px] text-slate-500 ml-1 font-medium italic">Max 50 reels per job</p>
                  </div>
                  <span className="text-3xl font-black text-white leading-none">
                    {reelsCount}<span className="text-sm text-slate-500 ml-1 uppercase tracking-widest font-bold">Files</span>
                  </span>
                </div>
                <div className="relative group py-4">
                  <input
                    name="reelsCount"
                    type="range"
                    min="1"
                    max="50"
                    value={reelsCount}
                    onChange={(e) => setReelsCount(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-emerald-500 transition-all hover:bg-white/20"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isPending}
                className={cn(
                  "w-full h-20 text-xl font-black rounded-2xl transition-all relative overflow-hidden group",
                  isPending
                    ? "bg-emerald-950 text-emerald-500 border border-emerald-500/20 cursor-wait"
                    : "bg-emerald-500 hover:bg-emerald-400 text-black hover:scale-[1.02] active:scale-[0.98] shadow-[0_20px_40px_rgba(16,185,129,0.2)]"
                )}
              >
                {/* Loading Glow & Scan Effect */}
                {isPending && (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="absolute inset-0 bg-emerald-500/5 animate-pulse"
                    />
                    <motion.div
                      className="absolute inset-0 overflow-hidden"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent w-[100%] -skew-x-12 pointer-events-none"
                        animate={{
                          x: ['-200%', '200%'],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      />
                    </motion.div>
                  </>
                )}

                <div className="flex items-center justify-center gap-4 relative z-10 w-full">
                  {isPending ? (
                    <>
                      <div className="relative">
                        <Loader2 className="w-8 h-8 animate-spin" />
                        <div className="absolute inset-0 bg-emerald-500 blur-lg opacity-40 animate-pulse" />
                      </div>
                      <div className="flex flex-col items-start leading-none text-left">
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] mb-1 opacity-70">Initialize Curation</span>
                        <span className="text-lg font-black tracking-tight uppercase">Scanning Profile...</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="tracking-tight">INITIALIZE CURATION</span>
                      <ArrowRight className="h-6 w-6 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </div>
              </Button>
            </form>

            <div className="flex flex-col items-center gap-4 pt-4">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600">Quick Select Presets</p>
              <div className="flex flex-wrap gap-3 justify-center">
                {[
                  { label: "@evolving.ai", url: "https://www.instagram.com/evolving.ai/" },
                  { label: "@wealth", url: "https://www.instagram.com/wealth/reels/" },
                  { label: "@history", url: "https://www.instagram.com/historyphotographed/reels/" }
                ].map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => setUrl(preset.url)}
                    type="button"
                    className="px-5 py-2.5 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-slate-400 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/20 transition-all shadow-xl"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Feature Pills */}
        <div className="mt-12 flex flex-wrap justify-center gap-4 text-[10px] uppercase tracking-[0.2em] font-black text-slate-500">
          <div className="flex items-center gap-2 px-4 py-2 border border-white/5 bg-white/5 rounded-full backdrop-blur-sm">
            <Shield className="w-3 h-3 text-emerald-500" /> Secure Scraping
          </div>
          <div className="flex items-center gap-2 px-4 py-2 border border-white/5 bg-white/5 rounded-full backdrop-blur-sm">
            <Layers className="w-3 h-3 text-emerald-500" /> Batch Processing
          </div>
          <div className="flex items-center gap-2 px-4 py-2 border border-white/5 bg-white/5 rounded-full backdrop-blur-sm">
            <Sparkles className="w-3 h-3 text-emerald-500" /> AI Detection
          </div>
        </div>
      </motion.div>
    </main>
  )
}
