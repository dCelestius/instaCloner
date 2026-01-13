
import { getJob, isGeminiConfigured } from "@/app/actions"
import CaptionsClient from "./captions-client"

export default async function CaptionsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const job = await getJob(id)
    const configured = await isGeminiConfigured()

    return <CaptionsClient job={job} jobId={id} initialConfigured={configured} />
}
