// Centralized API call utility for Vite + Tauri
const BASE_URL = import.meta.env.VITE_API_URL || '';

export async function fetchApi(path, options = {}) {
  const url = BASE_URL + path;
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || response.statusText);
    }
    // Try to parse JSON, fallback to text
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    } else {
      return await response.text();
    }
  } catch (err) {
    throw new Error(err.message || 'Network error');
  }
} 