const STORAGE_KEY = 'cg_pds_auth_token';

/**
 * Universal authenticated API fetcher that attaches the session Bearer token
 * to all outgoing requests and handles automatic 401 redirect to login.
 */
export async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const token = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY);
  const headers = new Headers(init?.headers || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...init,
    headers
  });

  if (response.status === 401 && !url.includes('/api/auth/login')) {
    const clone = response.clone();
    try {
      const data = await clone.json();
      if (data.authRequired || data.status === 'unauthorized') {
        localStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem(STORAGE_KEY);
        // Force reload or state trigger if needed
        window.dispatchEvent(new Event('auth:unauthorized'));
      }
    } catch {
      // Ignore
    }
  }

  return response;
}
