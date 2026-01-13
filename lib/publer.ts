
import fs from 'fs/promises';
import path from 'path';

const BASE_URL = 'https://app.publer.com/api/v1';

export interface PublerCredentials {
    apiKey: string;
    workspaceId: string;
}

export interface PublerAccount {
    id: string;
    name: string;
    type: string;
    thumb: string;
    link?: string;
}

export interface PublerWorkspace {
    id: string;
    name: string;
    logo?: string;
}

export async function getAccounts(creds: PublerCredentials): Promise<PublerAccount[]> {
    const headers: Record<string, string> = {
        'Authorization': `Bearer-API ${creds.apiKey}`,
    };
    if (creds.workspaceId) {
        headers['Publer-Workspace-Id'] = creds.workspaceId;
    }

    console.log(`[Publer] Fetching accounts from ${BASE_URL}/accounts`);
    console.log(`[Publer] Headers:`, JSON.stringify({ ...headers, 'Authorization': 'Bearer-API ***' }, null, 2));

    const res = await fetch(`${BASE_URL}/accounts`, {
        headers
    });

    if (!res.ok) {
        const errText = await res.text();
        console.error(`[Publer] Error ${res.status}:`, errText);
        throw new Error(`Failed to fetch accounts: ${res.status} ${res.statusText} - ${errText}`);
    }

    const data = await res.json();
    // API returns array of accounts
    return data;
}

export async function getWorkspaces(apiKey: string): Promise<PublerWorkspace[]> {
    console.log(`[Publer] Fetching workspaces...`);
    const res = await fetch(`${BASE_URL}/workspaces`, {
        headers: {
            'Authorization': `Bearer-API ${apiKey}`,
        }
    });

    if (!res.ok) {
        const errText = await res.text();
        console.error(`[Publer] Fetch Workspaces Error ${res.status}:`, errText);
        throw new Error(`Failed to fetch workspaces: ${res.status} - ${errText}`);
    }

    return await res.json();
}

export async function uploadMedia(
    localPath: string,
    creds: PublerCredentials
): Promise<string> {
    console.log(`[Publer] Reading file from: ${localPath}`);
    try {
        const stats = await fs.stat(localPath);
        console.log(`[Publer] File size: ${stats.size} bytes`);
    } catch (e) {
        console.error(`[Publer] File not found or not accessible: ${localPath}`);
        throw new Error(`Local file not found: ${localPath}`);
    }

    const fileBuffer = await fs.readFile(localPath);
    const filename = path.basename(localPath);
    const ext = path.extname(filename).toLowerCase();

    let mimeType = 'application/octet-stream';
    if (ext === '.mp4') mimeType = 'video/mp4';
    else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
    else if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.mov') mimeType = 'video/quicktime';

    console.log(`[Publer] Uploading ${filename} as ${mimeType}`);

    const form = new FormData();
    const blob = new Blob([fileBuffer], { type: mimeType });
    form.append('file', blob, filename);

    const headers: Record<string, string> = {
        'Authorization': `Bearer-API ${creds.apiKey}`,
    };
    if (creds.workspaceId) {
        headers['Publer-Workspace-Id'] = creds.workspaceId;
    }

    const res = await fetch(`${BASE_URL}/media`, {
        method: 'POST',
        headers,
        body: form
    });

    if (!res.ok) {
        const err = await res.text();
        console.error(`[Publer] Upload failed: ${res.status} ${err}`);
        throw new Error(`Upload failed: ${err}`);
    }

    const data = await res.json();
    if (!data.id) throw new Error("No media ID returned from Publer");
    console.log(`[Publer] Upload success, Media ID: ${data.id}`);
    return data.id;
}

export async function schedulePost(
    postData: {
        text: string;
        mediaIds: string[];
        accountIds: string[];
        networkKeys: string[]; // e.g. ['instagram', 'linkedin']
        scheduledAt?: string;
    },
    creds: PublerCredentials
) {
    // Construct the networks object (content per platform)
    const networksPayload: Record<string, any> = {};
    for (const netKey of postData.networkKeys) {
        networksPayload[netKey] = {
            type: 'video', // We are scheduling reels/videos
            text: postData.text,
            media: postData.mediaIds.map(id => ({ id, type: 'video' }))
        };
    }

    // Construct accounts array with schedule times
    const accountsPayload = postData.accountIds.map(id => ({
        id,
        scheduled_at: postData.scheduledAt
    }));

    const payload = {
        bulk: {
            state: "scheduled",
            posts: [
                {
                    networks: networksPayload,
                    accounts: accountsPayload
                }
            ]
        }
    };

    console.log('[Publer] Scheduling Payload:', JSON.stringify(payload, null, 2));

    const headers: Record<string, string> = {
        'Authorization': `Bearer-API ${creds.apiKey}`,
        'Content-Type': 'application/json'
    };
    if (creds.workspaceId) {
        headers['Publer-Workspace-Id'] = creds.workspaceId;
    }

    const res = await fetch(`${BASE_URL}/posts/schedule`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        const err = await res.text();
        console.error(`[Publer] Scheduling failed: ${res.status} ${err}`);
        throw new Error(`Scheduling failed: ${err}`);
    }

    const data = await res.json();
    console.log('[Publer] Scheduling Response:', JSON.stringify(data, null, 2));
    return data;
}

export async function getPosts(
    creds: PublerCredentials,
    options: {
        state?: 'scheduled' | 'draft' | 'posted';
        limit?: number;
    } = {}
) {
    const params = new URLSearchParams();
    if (options.state) params.append('state', options.state);
    if (options.limit) params.append('limit', options.limit.toString());

    // Default to scheduled
    // if (!options.state) params.append('state', 'scheduled');

    const headers: Record<string, string> = {
        'Authorization': `Bearer-API ${creds.apiKey}`,
    };
    if (creds.workspaceId) {
        headers['Publer-Workspace-Id'] = creds.workspaceId;
    }

    const res = await fetch(`${BASE_URL}/posts?${params.toString()}`, {
        headers
    });

    if (!res.ok) {
        const errText = await res.text();
        console.error(`[Publer] Get Posts Error ${res.status}:`, errText);
        throw new Error(`Failed to fetch posts: ${res.status} - ${errText}`);
    }

    return await res.json();
}
