import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

export async function POST(request: NextRequest): Promise<NextResponse> {
    // Only signed-in users may upload (logos, photos)
    if (!getSession(request.cookies)) {
        return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');

    if (!filename) {
        return NextResponse.json({ error: 'Filename is required' }, { status: 400 });
    }

    try {
        const blob = await put(filename, request.body!, {
            access: 'public',
        });

        return NextResponse.json(blob);
    } catch (error) {
        console.error('Error uploading to Vercel Blob:', error);
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }
}
