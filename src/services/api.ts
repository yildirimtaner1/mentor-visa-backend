import type { AnalysisResponse } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function uploadDocument(file: File): Promise<AnalysisResponse> {
  const formData = new FormData();
  formData.append('document', file);
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/analyze`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to get a response from the server. Please check that the API key is valid and the server is running.');
    }
    
    return await response.json();
    
  } catch (error) {
    console.error("API Connection Error:", error);
    throw error;
  }
}
