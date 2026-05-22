// Centralized Environment Variable Validation and Configuration
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL

if (!apiBaseUrl) {
  throw new Error("CRITICAL CONFIGURATION ERROR: VITE_API_BASE_URL is not defined in your environment (.env) file!")
}

export const config = {
  apiBaseUrl,
}
