import { getBackendUrl } from '../config/api';
import supabase from '../config/supabase';

/**
 * Get authentication headers for API requests
 * Returns a Record<string, string> for easier type checking
 */
export const getAuthHeaders = async (): Promise<Record<string, string>> => {
  // First, try to get Supabase session token (most reliable)
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      return {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      };
    }
  } catch (error) {
    console.warn('Failed to get Supabase session:', error);
  }

  // Fallback: Check for JWT token stored during super admin bypass
  const jwtToken = localStorage.getItem('auth_token');
  if (jwtToken) {
    return {
      'Authorization': `Bearer ${jwtToken}`,
      'Content-Type': 'application/json',
    };
  }

  // Fallback: Get the access token from localStorage (Supabase storage)
  const allKeys = Object.keys(localStorage);
  const supabaseKeys = allKeys.filter(key => key.includes('supabase') || key.includes('sb-'));
  
  for (const key of supabaseKeys) {
    try {
      const data = localStorage.getItem(key);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.access_token) {
          return {
            'Authorization': `Bearer ${parsed.access_token}`,
            'Content-Type': 'application/json',
          };
        }
      }
    } catch (parseError) {
      console.warn(`Failed to parse ${key}:`, parseError);
    }
  }
  
  // Return empty headers if no token found
  return {
    'Content-Type': 'application/json',
  };
};

/**
 * Make an authenticated API request
 */
export const authenticatedFetch = async (
  endpoint: string, 
  options: RequestInit = {}
): Promise<Response> => {
  const url = `${getBackendUrl()}${endpoint}`;
  const headers = await getAuthHeaders();
  
  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  });
  
  return response;
};

/**
 * Make an authenticated POST request with FormData
 */
export const authenticatedFormDataFetch = async (
  endpoint: string,
  formData: FormData,
  options: RequestInit = {}
): Promise<Response> => {
  const url = `${getBackendUrl()}${endpoint}`;
  
  // Get auth headers but exclude Content-Type for FormData
  const authHeaders = await getAuthHeaders();
  const headersWithoutContentType: Record<string, string> = {};
  
  // Copy all headers except Content-Type
  Object.entries(authHeaders).forEach(([key, value]) => {
    if (key !== 'Content-Type') {
      headersWithoutContentType[key] = value;
    }
  });
  
  const response = await fetch(url, {
    method: 'POST',
    body: formData,
    headers: {
      ...headersWithoutContentType,
      ...options.headers,
    },
    ...options,
  });
  
  return response;
};
