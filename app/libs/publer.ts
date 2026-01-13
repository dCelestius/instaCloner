
import axios from 'axios';

const BASE_URL = 'https://app.publer.com/api/v1';

interface PublerCredentials {
    apiKey: string;
    workspaceId: string;
}

export interface PublerAccount {
    id: string;
    name: string;
    type: string;
    thumb: string;
}

export async function getAccounts(creds: PublerCredentials): Promise<PublerAccount[]> {
    try {
        const response = await axios.get(`${BASE_URL}/accounts`, {
            headers: {
                'Authorization': `Bearer ${creds.apiKey}`,
                // 'Publer-Workspace-Id': creds.workspaceId // Sometimes needed, sometimes implicitly main
            }
        });
        return response.data;
    } catch (error) {
        console.error("Publer getAccounts error:", error);
        throw new Error("Failed to fetch Publer accounts. Check your API Key.");
    }
}

export async function uploadMedia(
    fileUrl: string,
    creds: PublerCredentials
): Promise<string> {
    // Publer allows uploading via URL which is much easier than streams for this context since our files are locally hosted (publicly maybe? No, likely localhost).
    // If localhost, we might need to actually upload the file buffer.
    // The Docs say: POST /media/from-url OR POST /media (multipart)

    // For now, let's assume we need to upload the file binary because our server acts as the source and it might not be publicly reachable by Publer if dev environment.

    // HOWEVER, `uploadMedia` implementation with axios and FormData (node environment) is tricky without `form-data` package sometimes.
    // Let's rely on the Plan which suggested helpers.

    // WAIT: `fileUrl` in our app is a local path or a relative URL. 
    // We will need the ABSOLUTE LOCAL PATH to read the file and upload it.

    throw new Error("Direct upload implementation requires 'form-data' package or Blob handling. For now, assuming URL-based if public, or we need to implement multipart.");
}

// SIMPLIFIED MOCK implementation for first pass if needed, but let's try real fetch
import fs from 'fs/promises';
import path from 'path';

export async function uploadValueMedia(
    localPath: string,
    creds: PublerCredentials
): Promise<string> {
    const FormData = require('form-data');
    const form = new FormData();

    // Read file
    const fileBuffer = await fs.readFile(localPath);
    const filename = path.basename(localPath);

    form.append('file', fileBuffer, { filename });

    try {
        const response = await axios.post(`${BASE_URL}/media`, form, {
            headers: {
                'Authorization': `Bearer ${creds.apiKey}`,
                ...form.getHeaders()
            }
        });
        // Response should contain { id: "media_id", ... }
        if (response.data && response.data.id) {
            return response.data.id;
        }
        throw new Error("No media ID returned");
    } catch (error: any) {
        // console.error("Publer Upload Error", error.response?.data || error);
        throw new Error(`Upload failed: ${error.response?.data?.error?.message || error.message}`);
    }
}

export async function schedulePost(
    postData: {
        text: string;
        mediaIds: string[];
        accountIds: string[];
        scheduledAt?: string; // ISO string
    },
    creds: PublerCredentials
) {
    const payload = {
        posts: [
            {
                text: postData.text,
                media: postData.mediaIds,
                accounts: postData.accountIds,
                scheduled_at: postData.scheduledAt
            }
        ]
    };

    try {
        const response = await axios.post(`${BASE_URL}/posts`, payload, {
            headers: {
                'Authorization': `Bearer ${creds.apiKey}`,
                'Content-Type': 'application/json'
            }
        });
        return response.data;
    } catch (error: any) {
        throw new Error(`Scheduling failed: ${error.response?.data?.error?.message || error.message}`);
    }
}
