import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { normalizeBaseUrl } from '@/app/api/_lib/http';

/**
 * Global Catch-all Proxy for /api/v1/*
 * This route handles all tenant-specific and general API requests that don't have
 * a dedicated route file. It proxies them directly to the backend.
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

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ path?: string[] }> | any }) {
    return proxyRequest(request, params);
}

async function proxyRequest(request: NextRequest, paramsArg: any) {
    try {
        // In Next.js 15, params is a Promise
        const resolvedParams = await paramsArg;
        const pathSegments = resolvedParams.path || [];
        const apiPath = pathSegments.join('/');

        // Normalize backend URL
        const backendUrl = normalizeBaseUrl(process.env.BACKEND_API_URL);

        const fullUrl = `${backendUrl}/${apiPath}${request.nextUrl.search}`;

        console.log(`[Global Proxy v1] ${request.method} -> ${fullUrl}`);

        // Extract headers
        const authHeader = request.headers.get('authorization');
        const tenantHeader = request.headers.get('x-tenant-id');
        const contentType = request.headers.get('content-type');

        // Prepare body if applicable
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
                ...(authHeader && { 'Authorization': authHeader }),
                ...(tenantHeader && { 'X-Tenant-ID': tenantHeader }),
                ...(contentType && { 'Content-Type': contentType }),
            },
            validateStatus: () => true, // Don't throw on error status
            timeout: 60000,
        });

        return NextResponse.json(response.data, { status: response.status });
    } catch (error: any) {
        console.error(`[Global Proxy v1 Error]:`, error.message);
        return NextResponse.json(
            { error: 'Internal Server Error', message: error.message },
            { status: 500 }
        );
    }
}
