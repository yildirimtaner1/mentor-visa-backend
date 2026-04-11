import type { AnalysisResponse } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function uploadDocument(file: File, targetNoc?: string): Promise<AnalysisResponse> {
  const formData = new FormData();
  formData.append('document', file);
  if (targetNoc) formData.append('target_noc', targetNoc);
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/analyze`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to get a response from the server.');
    }
    
    return await response.json();
    
  } catch (error) {
    console.error("API Connection Error:", error);
    throw error;
  }
}

export async function reevaluateDocument(fileId: string, targetNoc: string, token: string, mode: string = 'audit'): Promise<AnalysisResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/reevaluate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ file_id: fileId, target_noc: targetNoc, mode })
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to re-evaluate document.');
  }
  return response.json();
}

export async function saveEvaluation(payload: AnalysisResponse, token: string) {
  const response = await fetch(`${API_BASE_URL}/api/v1/evaluations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error("Failed to save evaluation");
  return response.json();
}

export async function getEvaluations(token: string) {
  const response = await fetch(`${API_BASE_URL}/api/v1/evaluations`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to load evaluations (${response.status})`);
  }
  return response.json();
}

export async function findNOCCode(jobTitle?: string, dutiesDescription?: string, document?: File, targetNoc?: string) {
  const formData = new FormData();
  if (document) {
    formData.append('document', document);
  } else if (jobTitle && dutiesDescription) {
    formData.append('job_title', jobTitle);
    formData.append('duties_description', dutiesDescription);
  } else {
    throw new Error('Must provide either a document or job title + duties.');
  }

  if (targetNoc) formData.append('target_noc', targetNoc);

  const response = await fetch(`${API_BASE_URL}/api/v1/noc-finder`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to find NOC code.');
  }
  return response.json();
}

export async function fetchUserCredits(token: string) {
  const response = await fetch(`${API_BASE_URL}/api/v1/user/credits`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!response.ok) return { find_noc_credits: 0, audit_letter_credits: 0 };
  return response.json();
}

export async function createCheckoutSession(passType: 'finder' | 'auditor', token: string, returnPath: string = '/dashboard') {
  const response = await fetch(`${API_BASE_URL}/api/v1/create-checkout-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ pass_type: passType, return_path: returnPath })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to create checkout session");
  }
  const data = await response.json();
  return data.session_url;
}

export async function consumeCreditToUnlock(fileId: string, passType: 'finder' | 'auditor', token: string) {
  const response = await fetch(`${API_BASE_URL}/api/v1/unlock-evaluation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ file_id: fileId, pass_type: passType })
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to unlock document");
  }
  return response.json();
}

/** LOCAL DEV ONLY — hits the dev endpoint to instantly grant test credits. */
export async function devGrantCredits(token: string) {
  const response = await fetch(`${API_BASE_URL}/api/v1/dev/grant-credits`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!response.ok) throw new Error('Failed to grant credits');
  return response.json();
}
