import { useAuth } from './useAuth';
import { USE_MOCK_DATA, fetchMockLeads, MockLead } from '@/lib/mockData';

interface FetchLeadsOptions {
  take?: number;
  cursor?: number | null;
}

interface LeadsResponse {
  items: any[];
  nextCursor: number | null;
}

export function useDataService() {
  const { fetchWithAuth } = useAuth();

  const fetchLeads = async (options: FetchLeadsOptions = {}): Promise<LeadsResponse> => {
    const { take = 100, cursor = null } = options;

    // Use mock data if flag is enabled
    if (USE_MOCK_DATA) {
      return await fetchMockLeads(take, cursor);
    }

    // Real API call
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
    const url = cursor 
      ? `${API_BASE_URL}/crm-leads?take=${take}&cursor=${cursor}`
      : `${API_BASE_URL}/crm-leads?take=${take}`;
    
    const res = await fetchWithAuth(url);
    if (!res.ok) throw new Error('Failed to load leads');
    
    const data = await res.json();
    
    // Normalize response structure
    if (Array.isArray(data)) {
      return { items: data, nextCursor: null };
    }
    
    return {
      items: data.items || [],
      nextCursor: data.nextCursor || null,
    };
  };

  const fetchAllLeads = async (maxPages: number = 200): Promise<any[]> => {
    const allLeads: any[] = [];
    let cursor: number | null = null;
    let pages = 0;

    do {
      const response = await fetchLeads({ take: 100, cursor });
      allLeads.push(...response.items);
      cursor = response.nextCursor;
      pages++;
    } while (cursor !== null && pages < maxPages);

    return allLeads;
  };

  return {
    fetchLeads,
    fetchAllLeads,
  };
}
