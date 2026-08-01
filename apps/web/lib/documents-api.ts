import { apiFetch, ApiError } from './api-client';
import { API_URL } from './config';
import { tokenStorage } from './token-storage';

export interface EmployeeDocument {
  id: string;
  employeeId: string;
  type: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  uploadedById: string | null;
  uploadedAt: string;
}

export function listEmployeeDocuments(
  employeeId: string,
): Promise<EmployeeDocument[]> {
  return apiFetch<EmployeeDocument[]>(`/employees/${employeeId}/documents`);
}

export function uploadEmployeeDocument(
  employeeId: string,
  file: File,
  type: string,
): Promise<EmployeeDocument> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', type);
  return apiFetch<EmployeeDocument>(`/employees/${employeeId}/documents`, {
    method: 'POST',
    body: formData,
  });
}

export function removeEmployeeDocument(documentId: string): Promise<void> {
  return apiFetch<void>(`/documents/${documentId}`, { method: 'DELETE' });
}

async function fetchDocumentBlob(documentId: string): Promise<Blob> {
  const accessToken = tokenStorage.getAccessToken();
  const response = await fetch(`${API_URL}/documents/${documentId}`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  if (!response.ok) {
    throw new ApiError(response.status, 'Failed to load document');
  }
  return response.blob();
}

/** Opens the document in a new tab rather than triggering a download. */
export async function viewEmployeeDocument(documentId: string): Promise<void> {
  const blob = await fetchDocumentBlob(documentId);
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function downloadEmployeeDocument(
  documentId: string,
  fileName: string,
): Promise<void> {
  const blob = await fetchDocumentBlob(documentId);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
