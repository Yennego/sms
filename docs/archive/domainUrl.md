# Accessing Tenants by URL in Next.js

This guide explains how to configure your Next.js application to access specific tenants via dynamic URLs, using the tenant information (like `domain` or `subdomain`) to identify and load the correct tenant-specific content.

## 1. Understanding Next.js Dynamic Routing for Tenant Access

Next.js provides a powerful feature called Dynamic Routing, which allows you to create pages that can handle dynamic segments in the URL. This is essential for building multi-tenant applications where each tenant might have a unique identifier in the URL (e.g., `http://localhost:3000/ejhunter.com` or `http://ejhunter.yourdomain.com`).

In a multi-tenant application, you typically want to serve different content or apply different configurations based on the tenant being accessed. Dynamic routing enables you to capture the tenant identifier from the URL and use it to fetch the relevant tenant data from your backend.

For example, if you want to access a tenant using their domain (e.g., `ejhunter.com`), your Next.js application needs a way to recognize `ejhunter.com` as a dynamic parameter. Next.js handles this by allowing you to define routes with bracketed parameters. When a request comes in, Next.js will parse the URL and provide the value of this dynamic segment to your page component.

This approach is flexible and scalable, as you don't need to create a separate page for each tenant. Instead, a single dynamic route can serve all tenants, with the specific tenant's data being loaded dynamically based on the URL parameter.





## 2. Example Next.js Route Configuration

Next.js uses a file-system based router, where files and folders inside the `pages` directory are mapped to URL paths. To implement dynamic routing for tenants, you would typically create a dynamic route segment in your `pages` directory.

### Option 1: Using a single dynamic segment for the tenant identifier

If you want to use the tenant's domain or subdomain directly as a path segment (e.g., `http://localhost:3000/ejhunter.com` or `http://localhost:3000/ejhunter`), you can create a file like `pages/[tenantIdentifier].js` (or `pages/[tenantIdentifier]/index.js`).

Let's assume you want to use the tenant's `domain` (e.g., `ejhunter.com`) as the dynamic segment. You would create a file structure like this:

```
pages/
  [tenantDomain].js
  _app.js
  index.js
```

Inside `pages/[tenantDomain].js`, you can access the `tenantDomain` value from the URL using the `useRouter` hook (for client-side rendering) or `getServerSideProps`/`getStaticProps` (for server-side rendering or static site generation).

**Example: `pages/[tenantDomain].js`**

```javascript
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

function TenantPage() {
  const router = useRouter();
  const { tenantDomain } = router.query; // This will be 'ejhunter.com'
  const [tenantData, setTenantData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (tenantDomain) {
      // Here you would fetch tenant data from your API
      // For demonstration, we'll simulate an API call
      const fetchTenantData = async () => {
        try {
          setLoading(true);
          // Replace with your actual API call to fetch tenant details
          const response = await fetch(`/api/tenants?domain=${tenantDomain}`);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const data = await response.json();
          setTenantData(data);
        } catch (e) {
          setError(e);
        } finally {
          setLoading(false);
        }
      };
      fetchTenantData();
    }
  }, [tenantDomain]);

  if (loading) {
    return <div>Loading tenant data...</div>;
  }

  if (error) {
    return <div>Error loading tenant data: {error.message}</div>;
  }

  if (!tenantData) {
    return <div>Tenant not found.</div>;
  }

  return (
    <div>
      <h1>Welcome to {tenantData.name}</h1>
      <p>Domain: {tenantData.domain}</p>
      <p>Subdomain: {tenantData.subdomain}</p>
      {/* Render other tenant-specific content */}
    </div>
  );
}

export default TenantPage;
```

### Option 2: Using a nested dynamic segment for more complex routing

If you have a more complex routing structure, for instance, if you want to access tenant-specific pages like `http://localhost:3000/ejhunter/dashboard`, you would create a nested dynamic route:

```
pages/
  [tenantSubdomain]/
    index.js
    dashboard.js
    settings.js
  _app.js
  index.js
```

In this case, `pages/[tenantSubdomain]/dashboard.js` would capture `ejhunter` as `tenantSubdomain`.

**Example: `pages/[tenantSubdomain]/dashboard.js`**

```javascript
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

function TenantDashboard() {
  const router = useRouter();
  const { tenantSubdomain } = router.query; // This will be 'ejhunter'
  const [tenantData, setTenantData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (tenantSubdomain) {
      const fetchTenantData = async () => {
        try {
          setLoading(true);
          // Fetch tenant data using the subdomain
          const response = await fetch(`/api/tenants?subdomain=${tenantSubdomain}`);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const data = await response.json();
          setTenantData(data);
        } catch (e) {
          setError(e);
        } finally {
          setLoading(false);
        }
      };
      fetchTenantData();
    }
  }, [tenantSubdomain]);

  if (loading) {
    return <div>Loading tenant dashboard...</div>;
  }

  if (error) {
    return <div>Error loading tenant dashboard: {error.message}</div>;
  }

  if (!tenantData) {
    return <div>Tenant not found.</div>;
  }

  return (
    <div>
      <h1>{tenantData.name} Dashboard</h1>
      <p>Subdomain: {tenantData.subdomain}</p>
      {/* Render tenant-specific dashboard content */}
    </div>
  );
}

export default TenantDashboard;
```

Choose the option that best fits your URL structure and how you intend to identify tenants. The `router.query` object will contain the dynamic segment values.





## 3. Explaining Tenant Data Fetching in Next.js

Once you have successfully captured the tenant identifier from the URL using Next.js dynamic routing, the next crucial step is to fetch the corresponding tenant data from your backend API. This data will then be used to render tenant-specific content, apply branding, or configure features.

### How to Fetch Tenant Data

The examples provided in Section 2 (`pages/[tenantDomain].js` and `pages/[tenantSubdomain]/dashboard.js`) already demonstrate a basic approach to fetching tenant data using the `useEffect` hook and the `fetch` API. Let's break down the key aspects of this process:

1.  **Identifying the Tenant:** The `tenantDomain` or `tenantSubdomain` obtained from `router.query` is your primary key for identifying the tenant. You will pass this identifier to your backend API.

2.  **API Endpoint Design:** Your FastAPI backend should have an endpoint capable of retrieving tenant information based on either the domain or subdomain. A common pattern is to have an endpoint like `/api/v1/tenants` that accepts query parameters (e.g., `/api/v1/tenants?domain=ejhunter.com` or `/api/v1/tenants?subdomain=ejhunter`).

    **Example FastAPI Endpoint (Conceptual):**
    ```python
    # In your FastAPI backend (e.g., src/api/v1/endpoints/tenant/tenant.py)
    from fastapi import APIRouter, Depends, HTTPException
    from sqlalchemy.orm import Session
    from typing import Optional
    from uuid import UUID

    from src.db.session import get_db
    from src.services.tenant_service import tenant_service
    from src.schemas.tenant import TenantPublic

    router = APIRouter()

    @router.get("/", response_model=list[TenantPublic])
    async def get_tenants(
        db: Session = Depends(get_db),
        domain: Optional[str] = None,
        subdomain: Optional[str] = None,
    ):
        if domain:
            tenant = tenant_service.get_by_domain(db, domain=domain)
            if not tenant:
                raise HTTPException(status_code=404, detail="Tenant not found")
            return [tenant]
        elif subdomain:
            tenant = tenant_service.get_by_subdomain(db, subdomain=subdomain)
            if not tenant:
                raise HTTPException(status_code=404, detail="Tenant not found")
            return [tenant]
        # If no domain or subdomain is provided, return all tenants (or handle as appropriate)
        return tenant_service.get_all(db)
    ```

3.  **Client-Side Fetching (Next.js `useEffect`):**
    As shown in the examples, the `useEffect` hook is suitable for fetching data on the client-side after the component mounts or when the `tenantDomain`/`tenantSubdomain` changes. The `fetch` API is used to make the HTTP request to your backend.

    ```javascript
    useEffect(() => {
      if (tenantIdentifier) { // tenantIdentifier could be tenantDomain or tenantSubdomain
        const fetchTenantData = async () => {
          try {
            setLoading(true);
            const response = await fetch(`/api/v1/tenants?domain=${tenantIdentifier}`); // Or ?subdomain=
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            setTenantData(data[0]); // Assuming your API returns a list, and you want the first item
          } catch (e) {
            setError(e);
          } finally {
            setLoading(false);
          }
        };
        fetchTenantData();
      }
    }, [tenantIdentifier]);
    ```

4.  **Server-Side Rendering (Next.js `getServerSideProps`):**
    For better SEO, performance, and to avoid client-side loading states, you might prefer to fetch tenant data on the server before the page is rendered. `getServerSideProps` is ideal for this.

    **Example: `pages/[tenantDomain].js` with `getServerSideProps`**

    ```javascript
    import { useRouter } from 'next/router';

    function TenantPage({ tenantData }) {
      const router = useRouter();

      if (router.isFallback) {
        return <div>Loading...</div>; // For static generation with fallback
      }

      if (!tenantData) {
        return <div>Tenant not found.</div>;
      }

      return (
        <div>
          <h1>Welcome to {tenantData.name}</h1>
          <p>Domain: {tenantData.domain}</p>
          <p>Subdomain: {tenantData.subdomain}</p>
          {/* Render other tenant-specific content */}
        </div>
      );
    }

    export async function getServerSideProps(context) {
      const { tenantDomain } = context.params;

      try {
        // Make a server-side request to your FastAPI backend
        // Use the full internal URL for server-side requests
        const response = await fetch(`http://localhost:8000/api/v1/tenants?domain=${tenantDomain}`);
        
        if (!response.ok) {
          // Handle errors, e.g., redirect to a 404 page
          return {
            notFound: true, // This will render a 404 page
          };
        }

        const data = await response.json();
        const tenantData = data[0]; // Assuming your API returns a list

        return {
          props: {
            tenantData,
          },
        };
      } catch (error) {
        console.error("Error fetching tenant data on server:", error);
        return {
          notFound: true, // Or return an error prop to display an error message
        };
      }
    }

    export default TenantPage;
    ```

    **Key considerations for `getServerSideProps`:**
    *   **Full URL:** When fetching data on the server, you must use the full, absolute URL to your backend API (e.g., `http://localhost:8000/api/v1/tenants`). Relative URLs will not work in this context.
    *   **Error Handling:** Implement robust error handling, including checking `response.ok` and catching network errors. You can return `notFound: true` to render Next.js's built-in 404 page or pass an `error` prop to your component.
    *   **Authentication:** If your tenant data API requires authentication, you'll need to handle passing authentication tokens in your server-side fetch requests. This might involve reading cookies or environment variables.

### Handling Loading and Error States

It's crucial to provide a good user experience by handling loading and error states. As shown in the examples:

*   **Loading State:** Use a state variable (e.g., `loading`) to indicate when data is being fetched. Display a loading spinner or message to the user.
*   **Error State:** Use a state variable (e.g., `error`) to capture any errors during the fetch process. Display an informative error message to the user.
*   **Not Found State:** If the tenant data is not found (e.g., API returns a 404), display a 


message or redirect to a 404 page.

By combining Next.js dynamic routing with robust data fetching strategies, you can effectively build a multi-tenant application that serves unique content based on the URL.



