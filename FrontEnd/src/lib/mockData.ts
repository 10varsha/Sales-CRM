
// When You Get Real API Key
// Simply change ONE line 
// typescript
// Change this line:
// To:
// export const USE_MOCK_DATA = false;


import { addDays, subDays, subWeeks, subMonths, format } from 'date-fns';

// Configuration flag - CHANGE THIS WHEN YOU GET REAL API
export const USE_MOCK_DATA = true; // Set to false when you have real API

// Mock Lead Interface
export interface MockLead {
  id: string;
  createdat: string;
  visatype: string;
  status: string;
  stage: string;
  amount: string;
  signedamount: string;
  team: string;
  assignedto: string;
  ownername: string;
  company: string;
  title: string;
  email: string;
  phone: string;
  source: string;
}

// Visa types distribution
const visaTypes = [
  { type: 'F-1 Visa', weight: 25 },
  { type: 'F-1 OPT', weight: 20 },
  { type: 'STEM OPT', weight: 18 },
  { type: 'H-1B Visa', weight: 22 },
  { type: 'Green Card', weight: 15 },
];

// Statuses
const statuses = [
  { status: 'New', weight: 25 },
  { status: 'Qualified', weight: 20 },
  { status: 'Proposal', weight: 15 },
  { status: 'Negotiation', weight: 12 },
  { status: 'Closing', weight: 10 },
  { status: 'Closed Won', weight: 13 },
  { status: 'Lost', weight: 5 },
];

// Teams
const teams = ['Team A', 'Team B', 'Team C', 'Team D', 'Team E'];

// Agent names
const agents = [
  'Sarah Johnson',
  'Michael Chang',
  'Jessica Lee',
  'Robert Garcia',
  'Emily Davis',
  'David Martinez',
  'Lisa Anderson',
  'James Wilson',
  'Maria Rodriguez',
  'John Smith',
];

// Companies
const companies = [
  'Tech Innovations Inc',
  'Global Solutions Ltd',
  'Digital Dynamics Corp',
  'Future Systems LLC',
  'Smart Technologies',
  'Innovation Hub',
  'NextGen Software',
  'Cloud Solutions Inc',
  'Data Analytics Co',
  'AI Ventures LLC',
];

// Helper: Weighted random selection
function weightedRandom<T extends { weight: number }>(items: T[]): T {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const item of items) {
    random -= item.weight;
    if (random <= 0) return item;
  }
  
  return items[0];
}

// Generate random date within last N days
function randomDate(daysBack: number): string {
  const days = Math.floor(Math.random() * daysBack);
  return subDays(new Date(), days).toISOString();
}

// Generate single mock lead
function generateMockLead(index: number): MockLead {
  const visa = weightedRandom(visaTypes);
  const statusObj = weightedRandom(statuses);
  const team = teams[Math.floor(Math.random() * teams.length)];
  const agent = agents[Math.floor(Math.random() * agents.length)];
  const company = companies[Math.floor(Math.random() * companies.length)];
  
  const isWon = statusObj.status === 'Closed Won';
  const amount = Math.floor(Math.random() * 50000) + 5000;
  
  return {
    id: `lead-${index}`,
    createdat: randomDate(180), // Last 180 days
    visatype: visa.type,
    status: statusObj.status,
    stage: statusObj.status,
    amount: amount.toString(),
    signedamount: isWon ? amount.toString() : '0',
    team,
    assignedto: agent,
    ownername: agent,
    company,
    title: `${visa.type} Application`,
    email: `contact${index}@${company.toLowerCase().replace(/\s+/g, '')}.com`,
    phone: `+1${Math.floor(Math.random() * 9000000000) + 1000000000}`,
    source: ['Website', 'Referral', 'LinkedIn', 'Cold Call', 'Event'][Math.floor(Math.random() * 5)],
  };
}

// Generate mock leads
export function generateMockLeads(count: number = 690): MockLead[] {
  return Array.from({ length: count }, (_, i) => generateMockLead(i + 1));
}

// Mock API response structure
export interface MockApiResponse {
  items: MockLead[];
  nextCursor: number | null;
  total: number;
}

// Simulate API call with pagination
export async function fetchMockLeads(
  take: number = 100,
  cursor: number | null = null
): Promise<MockApiResponse> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 300));
  
  const allLeads = generateMockLeads();
  const startIndex = cursor || 0;
  const endIndex = Math.min(startIndex + take, allLeads.length);
  
  return {
    items: allLeads.slice(startIndex, endIndex),
    nextCursor: endIndex < allLeads.length ? endIndex : null,
    total: allLeads.length,
  };
}

// Export all mock leads at once (for components that need all data)
export const MOCK_LEADS = generateMockLeads();
