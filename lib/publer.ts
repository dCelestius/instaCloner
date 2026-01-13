
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
    const fileBuffer = await fs.readFile(localPath);
    const filename = path.basename(localPath);

    const form = new FormData();
    // Node.js Blob implementation requires Uint8Array or similar
    const blob = new Blob([fileBuffer]);
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
        throw new Error(`Upload failed: ${err}`);
    }

    const data = await res.json();
    if (!data.id) throw new Error("No media ID returned from Publer");
    return data.id;
}

export async function schedulePost(
    postData: {
        text: string;
        mediaIds: string[];
        accountIds: string[];
        scheduledAt?: string;
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

    const headers: Record<string, string> = {
        'Authorization': `Bearer-API ${creds.apiKey}`,
        'Content-Type': 'application/json'
    };
    if (creds.workspaceId) {
        headers['Publer-Workspace-Id'] = creds.workspaceId;
    }

    const res = await fetch(`${BASE_URL}/posts`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Scheduling failed: ${err}`);
    }

    return await res.json();
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
