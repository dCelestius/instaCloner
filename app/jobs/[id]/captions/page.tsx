
import { getJob, isGeminiConfigured } from "@/app/actions"
import CaptionsClient from "./captions-client"

export default async function CaptionsPage({ params }: { params: { id: string } }) {
    const job = await getJob(params.id)
    const configured = await isGeminiConfigured()

    return <CaptionsClient job={job} jobId={params.id} initialConfigured={configured} />
}
