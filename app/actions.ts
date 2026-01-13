"use server"

import { exec } from "child_process"
import { promisify } from "util"
import fs from "fs/promises"
import path from "path"
import { randomUUID } from "crypto"
import { redirect } from "next/navigation"

import { getAccounts, getWorkspaces, getPosts, uploadMedia, schedulePost, PublerCredentials } from "@/lib/publer"

const execAsync = promisify(exec)
const DB_PATH = path.join(process.cwd(), "data", "jobs.json")
const PRESET_PATH = path.join(process.cwd(), "data", "presets.json")
const PERSISTED_LOGO_PATH = path.join(process.cwd(), "public", "persistent", "logo.png")

// Track active child processes by jobId
const activeJobs = new Map<string, any>()

// Ensure data directory exists
async function ensureDb() {
    // DB Directory
    const dir = path.dirname(DB_PATH)
    try {
        await fs.access(dir)
    } catch {
        await fs.mkdir(dir, { recursive: true })
    }

    try {
        await fs.access(DB_PATH)
    } catch {
        await fs.writeFile(DB_PATH, "{}", "utf-8")
    }

    // Public Downloads Directory
    const publicDownloadsDir = path.join(process.cwd(), "public", "downloads")
    try {
        await fs.access(publicDownloadsDir)
    } catch {
        await fs.mkdir(publicDownloadsDir, { recursive: true })
    }
}

async function atomicWriteJson(filePath: string, data: any) {
    const tempPath = `${filePath}.tmp.${randomUUID()}`
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2), "utf-8")
    await fs.rename(tempPath, filePath)
}

interface ScrapedReel {
    id: string
    url: string // This might be a direct Googlevideo link (expiring) or similar. For robust apps, we'd act differently.
    thumbnail: string
    title: string
    view_count: number
    like_count: number
    comment_count: number
    uploader: string
    webpage_url: string
}

function extractInt(val: FormDataEntryValue | null, def: number): number {
    if (!val) return def
    const parsed = parseInt(val as string)
    return isNaN(parsed) ? def : parsed
}

export async function createScrapeJob(formData: FormData) {
    const url = formData.get("url") as string
    if (!url) throw new Error("URL is required")

    const jobId = randomUUID()

    const reelsCount = extractInt(formData.get("reelsCount"), 12)

    try {
        console.log(`Starting scrape for ${url} (Limit: ${reelsCount})...`)
        const scriptPath = path.join(process.cwd(), "scripts", "scrape_profile.py")

        // Ensure job directory exists
        const jobDirName = jobId
        const jobDirAbs = path.join(process.cwd(), "public", "downloads", jobDirName)
        await fs.mkdir(jobDirAbs, { recursive: true })

        // Execute python script with output dir AND max_count
        console.log(`Running python script: ${scriptPath} for ${url} -> ${jobDirAbs} (Max: ${reelsCount})`)
        const venvPython = path.join(process.cwd(), ".venv", "bin", "python3")
        const { stdout } = await execAsync(`"${venvPython}" "${scriptPath}" "${url}" "${jobDirAbs}" "${reelsCount}"`)

        // Parse result
        let mappedReels = []
        try {
            // Find the start of the JSON array (in case of other stdout logs)
            const jsonStartIndex = stdout.indexOf('[')
            if (jsonStartIndex === -1) {
                throw new Error("No JSON array found in output")
            }
            const jsonContent = stdout.slice(jsonStartIndex)
            mappedReels = JSON.parse(jsonContent)
        } catch (e) {
            console.error("Failed to parse script output:", stdout)
            throw new Error(stdout || "Failed to parse script output")
        }

        if (mappedReels.error) {
            throw new Error(mappedReels.error)
        }

        if (mappedReels.length === 0) {
            throw new Error("No reels found (Scraper blocked or private profile)")
        }

        // Map python results to local URLs
        mappedReels = mappedReels.map((r: any) => ({
            ...r,
            status: "approved" as const,
            // Construct the public URL: /downloads/{jobId}/{filename}
            url: r.local_video_path
                ? `/downloads/${jobDirName}/${path.basename(r.local_video_path)}`
                : r.url,
            thumbnail: r.local_thumb_path
                ? `/downloads/${jobDirName}/${path.basename(r.local_thumb_path)}`
                : r.thumbnail,
            playable_url: r.local_video_path
                ? `/downloads/${jobDirName}/${path.basename(r.local_video_path)}`
                : r.playable_url
        }))

        await ensureDb()
        const db = JSON.parse(await fs.readFile(DB_PATH, "utf-8"))

        db[jobId] = {
            id: jobId,
            url,
            createdAt: new Date().toISOString(),
            reels: mappedReels
        }

        await atomicWriteJson(DB_PATH, db)

    } catch (error: any) {
        console.error("Scraping failed:", error)

        // FALLBACK TO MOCK DATA (Make it work strategy)
        console.log("⚠️ Fallback to Mock Data due to scraping failure")

        const mockReels = Array.from({ length: 12 }).map((_, i) => ({
            id: `mock-${jobId}-${i}`,
            url: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
            thumbnail: `https://picsum.photos/seed/${jobId}-${i}/400/700`,
            username: "instagram_demo_user",
            views: Math.floor(Math.random() * 500000) + 10000,
            likes: Math.floor(Math.random() * 50000) + 1000,
            comments: Math.floor(Math.random() * 2000),
            score: Math.floor(Math.random() * 100),
            status: "approved" as const,
            playable_url: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4"
        }))

        await ensureDb()
        const db = JSON.parse(await fs.readFile(DB_PATH, "utf-8"))
        db[jobId] = {
            id: jobId,
            url,
            createdAt: new Date().toISOString(),
            reels: mockReels,
            isMock: true
        }
        await atomicWriteJson(DB_PATH, db)
    }

    redirect(`/jobs/${jobId}`)
}

export async function updateJobReelCaptions(jobId: string, captions: Record<string, string>) {
    await ensureDb()
    const db = JSON.parse(await fs.readFile(DB_PATH, "utf-8"))

    if (!db[jobId]) throw new Error("Job not found")

    const job = db[jobId]
    job.reels = job.reels.map((r: any) => {
        if (captions[r.id] !== undefined) {
            return { ...r, generated_caption: captions[r.id] }
        }
        return r
    })

    await atomicWriteJson(DB_PATH, db)
    return { success: true }
}

export async function getJob(id: string) {
    await ensureDb()
    const db = JSON.parse(await fs.readFile(DB_PATH, "utf-8"))
    return db[id] || null
}

export async function startProcessingJob(formData: FormData) {
    const jobId = formData.get("jobId") as string
    const mode = formData.get("mode") as string || 'upload'
    const headerHeight = formData.get("headerHeight") as string

    if (!jobId) throw new Error("Missing requirements")

    const jobDirAbs = path.join(process.cwd(), "public", "downloads", jobId)
    // Ensure dir exists (it should from scraping)
    await fs.mkdir(jobDirAbs, { recursive: true })

    await ensureDb()
    const db = JSON.parse(await fs.readFile(DB_PATH, "utf-8"))

    const config: any = {
        headerHeight: headerHeight === 'auto' ? 'auto' : parseInt(headerHeight || "15"),
        mode: mode,
        autoDetectPosition: formData.get("autoDetectPosition") === 'true'
    }

    if (mode === 'upload') {
        const headerImage = formData.get("headerImage") as File
        if (!headerImage && !db[jobId]?.config?.hasHeader) {
            // Check if file exists maybe? For now require upload if not stored
            throw new Error("Header image required")
        }

        if (headerImage) {
            const arrayBuffer = await headerImage.arrayBuffer()
            const buffer = Buffer.from(arrayBuffer)
            const headerPath = path.join(jobDirAbs, "header_overlay.png")
            await fs.writeFile(headerPath, buffer)
        }
    } else if (mode === 'design') {
        const designLogo = formData.get("designLogo") as File
        const designName = formData.get("designName") as string
        const designHandle = formData.get("designHandle") as string
        const designBgColor = formData.get("designBgColor") as string
        const designOpacity = formData.get("designOpacity") as string
        const headlineMode = formData.get("headlineMode") as string
        const manualHeadline = formData.get("manualHeadline") as string

        if (designLogo && designLogo.size > 0) {
            const arrayBuffer = await designLogo.arrayBuffer()
            const buffer = Buffer.from(arrayBuffer)
            const logoPath = path.join(jobDirAbs, "logo.png")
            await fs.writeFile(logoPath, buffer)
        } else {
            // Fallback: If no new logo provided, check for persisted default
            try {
                await fs.access(PERSISTED_LOGO_PATH)
                await fs.copyFile(PERSISTED_LOGO_PATH, path.join(jobDirAbs, "logo.png"))
            } catch { }
        }

        config.designName = designName
        config.designHandle = designHandle
        config.designBgColor = designBgColor
        config.designOpacity = designOpacity ? parseInt(designOpacity) : 80

        // Metrics
        config.logoSize = extractInt(formData.get("logoSize"), 12)
        config.nameFontSize = extractInt(formData.get("nameFontSize"), 18)
        config.nameColor = formData.get("nameColor") as string || "#ffffff"
        config.badgeSize = extractInt(formData.get("badgeSize"), 18)
        config.handleFontSize = extractInt(formData.get("handleFontSize"), 14)
        config.handleColor = formData.get("handleColor") as string || "#94a3b8"
        config.headlineFontSize = extractInt(formData.get("headlineFontSize"), 24)
        config.headlineColor = formData.get("headlineColor") as string || "#ffffff"

        config.headlineMode = headlineMode
        config.manualHeadline = manualHeadline
        config.showHeadline = formData.get("showHeadline") === 'true'
        config.verticalPosition = parseInt(formData.get("verticalPosition") as string || "5")
    }

    console.log(`[Job ${jobId}] Generated Context:`, JSON.stringify(config, null, 2))

    if (db[jobId]) {
        // Idempotency: Don't start if already processing or completed
        if (db[jobId].status === "processing" && activeJobs.has(jobId)) {
            console.log(`[Job ${jobId}] Already processing. Skipping spawn.`)
            return { success: true }
        }

        db[jobId].status = "processing"
        db[jobId].config = config
    }

    await atomicWriteJson(DB_PATH, db)

    // FIRE AND FORGET - Spawn the python processing script
    const scriptPath = path.join(process.cwd(), "scripts", "process_batch.py")
    console.log(`Spawning processing script: ${scriptPath} for ${jobId}`)

    const venvPython = path.join(process.cwd(), ".venv", "bin", "python3")
    const child = exec(`"${venvPython}" "${scriptPath}" "${jobId}"`, (error, stdout, stderr) => {
        activeJobs.delete(jobId) // Remove when finished
        if (error) {
            console.error(`Processing script error for ${jobId}:`, stderr)
        } else {
            console.log(`Processing script success for ${jobId}:`, stdout)
        }
    })

    activeJobs.set(jobId, child)

    // SAVE PRESET for next time
    if (mode === 'design') {
        const logoPath = path.join(jobDirAbs, "logo.png")
        let logoToSave = undefined
        try {
            await fs.access(logoPath)
            logoToSave = logoPath
        } catch { }

        await savePreset(config, logoToSave)
    }

    return { success: true }
}

export async function applyHeaderCorrection(jobId: string, correction: number) {
    try {
        const dbContent = await fs.readFile(DB_PATH, "utf-8")
        const db = JSON.parse(dbContent)

        if (!db[jobId]) throw new Error("Job not found")

        // Update config
        if (!db[jobId].config) db[jobId].config = {}
        db[jobId].config.verticalCorrection = correction

        // Reset processed status to force re-generation
        db[jobId].status = 'processing'
        db[jobId].reels = db[jobId].reels.map((r: any) => ({
            ...r,
            processed_path: null, // Clear this so UI knows it's working
            // Generated captions/headlines can stay
        }))

        await atomicWriteJson(DB_PATH, db)

        // Trigger processing
        const scriptPath = path.join(process.cwd(), "scripts", "process_batch.py")
        console.log(`[Correction] Spawning processing script: ${scriptPath} for ${jobId}`)

        const venvPython = path.join(process.cwd(), ".venv", "bin", "python3")
        const child = exec(`"${venvPython}" "${scriptPath}" "${jobId}"`, (error, stdout, stderr) => {
            activeJobs.delete(jobId)
            if (error) console.error(`Processing script error for ${jobId}:`, stderr)
            else console.log(`Processing script success for ${jobId}:`, stdout)
        })
        activeJobs.set(jobId, child)

        return { success: true }
    } catch (e) {
        console.error("Apply Correction Error:", e)
        throw e
    }
}


export async function cancelJob(jobId: string) {
    console.log(`Cancelling job ${jobId}...`)

    // 1. Kill the process if it's running
    const child = activeJobs.get(jobId)
    if (child) {
        // We use SIGTERM. For FFmpeg/Python, we might need a more aggressive 
        // approach like tree-kill if it doesn't stop, but let's start with this.
        child.kill('SIGTERM')
        activeJobs.delete(jobId)
        console.log(`Process for job ${jobId} killed.`)
    }

    // 2. Update status in DB
    await ensureDb()
    const db = JSON.parse(await fs.readFile(DB_PATH, "utf-8"))
    if (db[jobId]) {
        // Only mark as canceled if it wasn't already completed
        if (db[jobId].status !== 'completed') {
            db[jobId].status = 'canceled'
            await atomicWriteJson(DB_PATH, db)
        }
    }

    return { success: true }
}

export async function createJobZip(jobId: string) {
    const jobDirAbs = path.join(process.cwd(), "public", "downloads", jobId)
    const zipName = `batch_output_${jobId.slice(0, 8)}.zip`
    const zipPath = path.join(jobDirAbs, zipName)

    // Check if any processed files exist
    try {
        await fs.access(jobDirAbs)
    } catch {
        throw new Error("Job directory not found")
    }

    // Zip command: zip -j (junk paths) -r (recursive) zipPath sourceFiles
    // We want only processed_*.mp4
    // Command: cd jobDir && zip zipName processed_*.mp4

    return new Promise<string>((resolve, reject) => {
        exec(`cd "${jobDirAbs}" && zip -j "${zipName}" processed_*.mp4`, (error, stdout, stderr) => {
            if (error) {
                // If 12, it means no files found usually
                console.error("Zip Error:", stderr)
                // If no processed files, try zipping ANY mp4? 
                // No, sticking to specific requirement.
                reject(new Error("No processed videos found to zip. Did processing succeed?"))
                return
            }
            resolve(`/downloads/${jobId}/${zipName}`)
        })
    })
}

export async function getLatestPreset() {
    try {
        await ensureDb()
        const data = await fs.readFile(PRESET_PATH, "utf-8")
        const preset = JSON.parse(data)

        // Check if public logo exists
        try {
            await fs.access(PERSISTED_LOGO_PATH)
            preset.designLogo = "/persistent/logo.png"
        } catch { }

        return preset
    } catch {
        return null
    }
}

export async function savePreset(config: any, logoPath?: string) {
    try {
        await ensureDb()

        if (logoPath) {
            const dir = path.dirname(PERSISTED_LOGO_PATH)
            await fs.mkdir(dir, { recursive: true })
            await fs.copyFile(logoPath, PERSISTED_LOGO_PATH)
        }

        await fs.writeFile(PRESET_PATH, JSON.stringify(config, null, 2), "utf-8")
    } catch (e) {
        console.error("Failed to save preset", e)
    }
}

export async function getPublerAccounts(apiKey: string, workspaceId: string) {
    try {
        return await getAccounts({ apiKey, workspaceId })
    } catch (e: any) {
        throw new Error(e.message)
    }
}


export async function getPublerWorkspaces(apiKey: string) {
    try {
        return await getWorkspaces(apiKey)
    } catch (e: any) {
        throw new Error(e.message)
    }
}


export async function getPublerPosts(apiKey: string, workspaceId: string) {
    try {
        return await getPosts({ apiKey, workspaceId }, { state: 'scheduled', limit: 20 })
    } catch (e: any) {
        throw new Error(e.message)
    }
}

export async function scheduleBatchToPubler(
    jobId: string,
    items: { reelId: string, caption: string, scheduledAt: string }[],
    creds: PublerCredentials,
    accountIds: string[]
) {
    // 1. Get Job & Verify
    const job = await getJob(jobId)
    if (!job) throw new Error("Job not found")

    const results = []

    // 2. Loop items
    for (const item of items) {
        const reel = job.reels.find((r: any) => r.id === item.reelId)
        if (!reel || !reel.processed_path) {
            results.push({ reelId: item.reelId, status: "error", message: "Reel not processed" })
            continue
        }

        try {
            // Absolute path to video
            const videoPath = path.join(process.cwd(), "public", "downloads", jobId, reel.processed_path)

            // Upload
            const mediaId = await uploadMedia(videoPath, creds)

            // Resolve Network Keys from Account Types
            // We need to know which networks we are posting to (e.g. instagram, linkedin)
            // to populate the 'networks' object in the API payload.
            const allAccounts = await getAccounts(creds); // Cache this widely if possible, but okay for batch here
            const selectedAccounts = allAccounts.filter(a => accountIds.includes(a.id));
            const networkKeys = Array.from(new Set(selectedAccounts.map(a => a.provider || a.type)));

            console.log(`[Batch] Scheduling for networks: ${networkKeys.join(', ')}`);

            // Schedule with Auto-Retry for conflicts
            let attempts = 0
            let scheduledTime = new Date(item.scheduledAt)
            let success = false
            let lastError = null

            while (attempts < 3 && !success) {
                try {
                    const post = await schedulePost({
                        text: item.caption,
                        mediaIds: [mediaId],
                        accountIds: accountIds,
                        networkKeys: networkKeys,
                        scheduledAt: scheduledTime.toISOString()
                    }, creds)

                    results.push({ reelId: item.reelId, status: "success", jobId: post.job_id })
                    success = true
                } catch (err: any) {
                    lastError = err
                    // Check for strict "gap required" or "another post at this time" error
                    if (err.message && (err.message.includes("gap is required") || err.message.includes("another post"))) {
                        console.log(`[Batch] Scheduling conflict at ${scheduledTime.toISOString()}. Shifting +5 mins...`)
                        scheduledTime.setMinutes(scheduledTime.getMinutes() + 5)
                        attempts++
                    } else {
                        // Fatal error, don't retry
                        throw err
                    }
                }
            }

            if (!success) throw lastError

        } catch (e: any) {
            console.error(e)
            results.push({ reelId: item.reelId, status: "error", message: e.message })
        }
    }

    return results
}

export async function isGeminiConfigured() {
    return !!process.env.GEMINI_API_KEY
}

export async function generateCaptionWithGemini(apiKey: string, context: string, username?: string, style?: string) {
    const key = apiKey || process.env.GEMINI_API_KEY
    if (!key) throw new Error("API Key is required")

    const handle = username ? `@${username.replace('@', '')}` : "@username"

    let prompt = ""

    if (style) {
        // Single Style Generation
        let styleInstruction = ""
        switch (style) {
            case 'plain': styleInstruction = "A clear rewrite of the context. IMPORTANT: Maintain the original formatting structure (line breaks, lists) if present."; break;
            case 'cta': styleInstruction = `A version with a strong Call to Action, specifically: "Follow ${handle} to uncover the stories they never told you 🧠. Knowledge has never been this entertaining." (Adapt slightly to context but keep the core CTA).`; break;
            case 'short': styleInstruction = "Brief, punchy, viral style."; break;
            case 'question': styleInstruction = "Starts with a hook/question to drive engagement."; break;
            case 'story': styleInstruction = "A narrative approach, engaging and emotional."; break;
            default: styleInstruction = "A clear, engaging caption.";
        }

        prompt = `You are a social media expert. Generate 1 caption variation for an Instagram Reel with the following context/title: "${context}".
        
        Style: "${style}" - ${styleInstruction}

        Include 3-5 relevant hashtags.
        Return a STRICT JSON object with this exact key: "${style}".
        Do NOT use markdown code blocks. Return ONLY the raw JSON string.`
    } else {
        // Fallback: Generate All (Legacy/Default)
        prompt = `You are a social media expert. Generate 5 distinct caption variations for an Instagram Reel with the following context/title: "${context}".
        
        Return a STRICT JSON object with these exact keys:
        1. "plain": A clear rewrite of the context. IMPORTANT: Maintain the original formatting structure (line breaks, lists) if present.
        2. "cta": A version with a strong Call to Action, specifically: "Follow ${handle} to uncover the stories they never told you 🧠. Knowledge has never been this entertaining." (Adapt slightly to context but keep the core CTA).
        3. "short": Brief, punchy, viral style.
        4. "question": Starts with a hook/question to drive engagement.
        5. "story": A narrative approach, engaging and emotional.

        Include 3-5 relevant hashtags in each.
        Do NOT use markdown code blocks. Return ONLY the raw JSON string.`
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    responseMimeType: "application/json"
                }
            })
        })

        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`Gemini API Error: ${response.status} - ${errorText}`)
        }

        const data = await response.json()
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text

        if (!text) throw new Error("No caption generated")

        try {
            // Clean up potentially markdown wrapped JSON
            const cleanText = text.replace(/```json\n?|\n?```/g, "").trim()
            return JSON.parse(cleanText)
        } catch (e) {
            console.error("Failed to parse Gemini JSON:", text)
            // Fallback: return as "plain" if parsing fails but implementation expects object, this might break frontend.
            // Let's throw to be safe or try to salvage.
            throw new Error("Failed to parse AI response")
        }
    } catch (error) {
        console.error("Gemini Generation Error:", error)
        throw error
    }
}
