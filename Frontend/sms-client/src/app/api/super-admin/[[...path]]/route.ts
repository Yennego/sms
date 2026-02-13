import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import axios from 'axios';
import { normalizeBaseUrl } from '@/app/api/_lib/http';

/**
 * Global Catch-all Proxy for /api/super-admin/*
 * Handles users, tenants, and dashboard requests by proxying to the backend.
 * Standardizes token retrieval from namespaced cookies.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ path?: string[] }> | any }) {
    return proxyRequest(request, params);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ path?: string[] }> | any }) {
    return proxyRequest(request, params);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ path?: string[] }> | any }) {
    return proxyRequest(request, params);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ path?: string[] }> | any }) {
    return proxyRequest(request, params);
}

async function proxyRequest(request: NextRequest, paramsArg: any) {
    try {
        const resolvedParams = await paramsArg;
        const pathSegments = resolvedParams.path || [];
        const apiPath = pathSegments.join('/');

        // Normalize backend URL using shared utility
        const backendUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);

        const fullUrl = `${backendUrl}/super-admin/${apiPath}${request.nextUrl.search}`;

        console.log(`[Super-Admin Proxy] ${request.method} -> ${fullUrl}`);

        // Retrieve token from cookies (Next.js 15 pattern)
        const cookieStore = await cookies();
        const accessToken =
            cookieStore.get('sa_accessToken')?.value ||
            cookieStore.get('tn_accessToken')?.value ||
            cookieStore.get('accessToken')?.value;

        const tenantId = cookieStore.get('tn_tenantId')?.value || cookieStore.get('tenantId')?.value || '6d78d2cc-27ba-4da7-a06f-6186aadbb476';

        // Handle body 
        const contentType = request.headers.get('content-type');
        let body: any = null;
        if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
            if (contentType?.includes('application/json')) {
                body = await request.json().catch(() => null);
            } else if (contentType?.includes('multipart/form-data') || contentType?.includes('application/x-www-form-urlencoded')) {
                body = await request.formData().catch(() => null);
            } else {
                body = await request.text().catch(() => null);
            }
        }

        const response = await axios({
            method: request.method,
            url: fullUrl,
            data: body,
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                ...(tenantId && { 'X-Tenant-ID': tenantId }),
                ...(contentType && { 'Content-Type': contentType }),
            },
            validateStatus: () => true,
            timeout: 60000,
        });

        return NextResponse.json(response.data, { status: response.status });
    } catch (error: any) {
        console.error(`[Super-Admin Proxy Error]:`, error.message);
        return NextResponse.json(
            { error: 'Internal Server Error', message: error.message },
            { status: 500 }
        );
    }
}
