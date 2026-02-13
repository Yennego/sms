import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    
    // Forward the request to the backend API with tenant header
    const tenantId = request.headers.get('X-Tenant-ID');
    const headers: HeadersInit = {};
    
    if (tenantId) {
      headers['X-Tenant-ID'] = tenantId;
    }
    
    const authHeader = request.headers.get('Authorization');
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }
    
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/people/students/${id}`, {
      headers,
    });
    
    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching student:', error);
    return NextResponse.json(
      { message: 'Failed to fetch student' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await request.json();
    
    // Forward the request to the backend API with tenant header
    const tenantId = request.headers.get('X-Tenant-ID');
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (tenantId) {
      headers['X-Tenant-ID'] = tenantId;
    }
    
    const authHeader = request.headers.get('Authorization');
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }
    
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/people/students/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating student:', error);
    return NextResponse.json(
      { message: 'Failed to update student' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    
    // Forward the request to the backend API with tenant header
    const tenantId = request.headers.get('X-Tenant-ID');
    const headers: HeadersInit = {};
    
    if (tenantId) {
      headers['X-Tenant-ID'] = tenantId;
    }
    
    const authHeader = request.headers.get('Authorization');
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }
    
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/people/students/${id}`, {
      method: 'DELETE',
      headers,
    });
    
    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error deleting student:', error);
    return NextResponse.json(
      { message: 'Failed to delete student' },
      { status: 500 }
    );
  }
}