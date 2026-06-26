const APPLICATION_SEARCH_PATH = '/api/applications/search';

export interface ApplicationRecord {
  id: number;
  fullname: string;
  customer__code: string;
  code: string;
  phone: string;
}

function normalizeResults(payload: unknown): ApplicationRecord[] {
  if (Array.isArray(payload)) {
    return payload as ApplicationRecord[];
  }

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const candidates = [record.data, record.results, record.items, record.rows];

    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate as ApplicationRecord[];
      }
    }
  }

  return [];
}


export async function searchApplications(query: string): Promise<ApplicationRecord[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery || trimmedQuery.length < 2) {
    return [];
  }

  const params = new URLSearchParams({ q: trimmedQuery });
  const response = await fetch(`${APPLICATION_SEARCH_PATH}?${params.toString()}`);

  if (!response.ok) {
    let message = `Tìm kiếm thất bại (${response.status})`;
    try {
      const errorPayload = await response.json();
      if (errorPayload && typeof errorPayload === 'object' && 'error' in errorPayload) {
        message = String(errorPayload.error);
      }
    } catch {
      // Keep default message when error body is not JSON.
    }
    throw new Error(message);
  }

  const payload = await response.json();
  return normalizeResults(payload);
}

export function mapApplicationToCustomerFields(application: ApplicationRecord) {
  return {
    fullName: application.fullname || '',
    contractId: application.code || '',
    customerId: application.customer__code || '',
  };
}
