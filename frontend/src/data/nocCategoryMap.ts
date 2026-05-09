/**
 * NOC → Category-Based Draw Mapping
 * 
 * Maps NOC 2021 codes to the IRCC category-based draw categories.
 * Used to determine if a user qualifies for targeted Express Entry draws
 * with potentially lower CRS cutoffs.
 * 
 * Source: IRCC's published eligible occupation lists for each category.
 * These lists are updated periodically — check canada.ca for the latest version.
 * 
 * Note: This is a representative subset. The full list has been cross-referenced
 * with IRCC's official category occupation lists.
 */

export type DrawCategory =
  | 'Healthcare'
  | 'STEM'
  | 'Trades'
  | 'Transport'
  | 'Agriculture'
  | 'French';

export interface CategoryInfo {
  name: DrawCategory;
  description: string;
  avgCutoff2025: number; // Approximate average CRS cutoff in 2025
  icon: string;
}

export const CATEGORY_INFO: Record<DrawCategory, CategoryInfo> = {
  Healthcare: {
    name: 'Healthcare',
    description: 'Occupations in healthcare, nursing, medical technology, and pharmacy',
    avgCutoff2025: 422,
    icon: '🏥',
  },
  STEM: {
    name: 'STEM',
    description: 'Science, technology, engineering, and mathematics occupations',
    avgCutoff2025: 481,
    icon: '💻',
  },
  Trades: {
    name: 'Trades',
    description: 'Electricians, plumbers, carpenters, welders, and other skilled trades',
    avgCutoff2025: 388,
    icon: '🔧',
  },
  Transport: {
    name: 'Transport',
    description: 'Truck drivers, transit operators, and transportation-related occupations',
    avgCutoff2025: 435,
    icon: '🚛',
  },
  Agriculture: {
    name: 'Agriculture',
    description: 'Agriculture, food processing, and agri-food occupations',
    avgCutoff2025: 440,
    icon: '🌾',
  },
  French: {
    name: 'French',
    description: 'French-language proficiency draws (CLB 7+ in French, any occupation)',
    avgCutoff2025: 379,
    icon: '🇫🇷',
  },
};


// ── NOC Code → Categories Mapping ──
// Format: NOC code (5-digit) → array of categories the code qualifies for

export const NOC_CATEGORY_MAP: Record<string, DrawCategory[]> = {
  // ── Healthcare ──
  '31100': ['Healthcare'], // Specialists in clinical and laboratory medicine
  '31101': ['Healthcare'], // Specialists in surgery
  '31102': ['Healthcare'], // General practitioners and family physicians
  '31103': ['Healthcare'], // Veterinarians
  '31110': ['Healthcare'], // Dentists
  '31111': ['Healthcare'], // Optometrists
  '31112': ['Healthcare'], // Audiologists and speech-language pathologists
  '31120': ['Healthcare'], // Pharmacists
  '31121': ['Healthcare'], // Dietitians and nutritionists
  '31200': ['Healthcare'], // Psychologists
  '31201': ['Healthcare'], // Chiropractors
  '31202': ['Healthcare'], // Physiotherapists
  '31203': ['Healthcare'], // Occupational Therapists
  '31209': ['Healthcare'], // Other healthcare diagnosing/treating professionals
  '31300': ['Healthcare'], // Nursing coordinators and supervisors
  '31301': ['Healthcare'], // Registered nurses and registered psychiatric nurses
  '31302': ['Healthcare'], // Nurse practitioners
  '31303': ['Healthcare'], // Physician assistants, midwives
  '32100': ['Healthcare'], // Opticians
  '32101': ['Healthcare'], // Licensed practical nurses
  '32102': ['Healthcare'], // Paramedical occupations
  '32103': ['Healthcare'], // Respiratory therapists, clinical perfusionists
  '32104': ['Healthcare'], // Animal health technologists
  '32109': ['Healthcare'], // Other technical occupations in therapy and assessment
  '32110': ['Healthcare'], // Dental hygienists and dental therapists
  '32111': ['Healthcare'], // Dental technologists, technicians
  '32120': ['Healthcare'], // Medical laboratory technologists
  '32121': ['Healthcare'], // Medical radiation technologists
  '32122': ['Healthcare'], // Medical sonographers
  '32123': ['Healthcare'], // Cardiology technologists
  '32124': ['Healthcare'], // Pharmacy Technicians
  '32129': ['Healthcare'], // Other medical technologists and technicians
  '33100': ['Healthcare'], // Dental assistants and dental lab assistants
  '33101': ['Healthcare'], // Nurse aides, orderlies, patient service associates
  '33102': ['Healthcare'], // Pharmacy technical assistants and pharmacy assistants
  '33103': ['Healthcare'], // Other assisting occupations in support of health services

  // ── STEM ──
  '20010': ['STEM'], // Engineering managers
  '20011': ['STEM'], // Architecture/science managers
  '20012': ['STEM'], // Computer/IS managers
  '21100': ['STEM'], // Physicists and astronomers
  '21101': ['STEM'], // Chemists
  '21102': ['STEM'], // Geoscientists and oceanographers
  '21103': ['STEM'], // Meteorologists and climatologists
  '21110': ['STEM'], // Biologists and related scientists
  '21111': ['STEM'], // Forestry professionals
  '21112': ['STEM'], // Agricultural reps, consultants, specialists
  '21200': ['STEM'], // Architects
  '21201': ['STEM'], // Landscape architects
  '21202': ['STEM'], // Urban and land use planners
  '21203': ['STEM'], // Land surveyors
  '21210': ['STEM'], // Mathematicians, statisticians and actuaries
  '21211': ['STEM'], // Data scientists
  '21220': ['STEM'], // Cybersecurity specialists
  '21221': ['STEM'], // Business systems specialists
  '21222': ['STEM'], // Info systems specialists
  '21223': ['STEM'], // Database analysts and data administrators
  '21230': ['STEM'], // Computer systems developers and programmers
  '21231': ['STEM'], // Software engineers and designers
  '21232': ['STEM'], // Software developers and programmers
  '21233': ['STEM'], // Web developers
  '21234': ['STEM'], // Web designers
  '21300': ['STEM'], // Civil engineers
  '21301': ['STEM'], // Mechanical engineers
  '21310': ['STEM'], // Electrical and electronics engineers
  '21311': ['STEM'], // Computer engineers
  '21320': ['STEM'], // Chemical engineers
  '21321': ['STEM'], // Industrial and manufacturing engineers
  '21322': ['STEM'], // Metallurgical and materials engineers
  '21330': ['STEM'], // Mining engineers
  '21331': ['STEM'], // Geological engineers
  '21332': ['STEM'], // Petroleum engineers
  '21390': ['STEM'], // Aerospace engineers
  '22100': ['STEM'], // Chemical technologists and technicians
  '22101': ['STEM'], // Geological / mineral technologists
  '22110': ['STEM'], // Biological technologists and technicians
  '22111': ['STEM'], // Agriculture and fish products inspectors
  '22112': ['STEM'], // Forestry technologists and technicians
  '22113': ['STEM'], // Conservation and fishery officers
  '22210': ['STEM'], // Architectural technologists and technicians
  '22211': ['STEM'], // Industrial designers
  '22212': ['STEM'], // Drafting technologists and technicians
  '22220': ['STEM'], // Computer network and web technicians
  '22221': ['STEM'], // User support technicians
  '22222': ['STEM'], // Info systems testing technicians
  '22300': ['STEM'], // Civil engineering technologists
  '22301': ['STEM'], // Mechanical engineering technologists
  '22302': ['STEM'], // Industrial engineering and manufacturing technologists
  '22303': ['STEM'], // Construction estimators
  '22310': ['STEM'], // Electrical/electronics engineering technologists
  '22311': ['STEM'], // Electronic service technicians (household and business equipment)
  '22312': ['STEM'], // Industrial instrument technicians and mechanics

  // ── Trades ──
  '72010': ['Trades'], // Contractors and supervisors, machining, metalworking etc.
  '72011': ['Trades'], // Contractors/supervisors, electrical trades
  '72012': ['Trades'], // Contractors/supervisors, pipefitting trades
  '72013': ['Trades'], // Contractors/supervisors, carpentry trades
  '72014': ['Trades'], // Contractors/supervisors, other construction trades
  '72020': ['Trades'], // Contractors/supervisors, heavy equipment
  '72021': ['Trades'], // Contractors/supervisors, printing/related
  '72100': ['Trades'], // Machinists and machining/tooling inspectors
  '72101': ['Trades'], // Tool and die makers
  '72102': ['Trades'], // Sheet metal workers
  '72103': ['Trades'], // Boilermakers
  '72104': ['Trades'], // Structural metal and platework fabricators
  '72105': ['Trades'], // Ironworkers
  '72106': ['Trades'], // Welders and related machine operators
  '72200': ['Trades'], // Electricians (except industrial, power system)
  '72201': ['Trades'], // Industrial electricians
  '72202': ['Trades'], // Power system electricians
  '72203': ['Trades'], // Power line and cable workers
  '72204': ['Trades'], // Telecommunications line and cable installers
  '72205': ['Trades'], // Telecommunications installation and repair workers
  '72210': ['Trades'], // Plumbers
  '72211': ['Trades'], // Steamfitters, pipefitters, sprinkler system installers
  '72212': ['Trades'], // Gas fitters
  '72300': ['Trades'], // Carpenters
  '72301': ['Trades'], // Bricklayers
  '72310': ['Trades'], // Concrete finishers
  '72311': ['Trades'], // Tilesetters
  '72312': ['Trades'], // Plasterers, drywall installers, and finishers
  '72320': ['Trades'], // Roofers and shinglers
  '72321': ['Trades'], // Glaziers
  '72322': ['Trades'], // Painters and decorators
  '72323': ['Trades'], // Floor covering installers
  '72400': ['Trades'], // Construction millwrights and industrial mechanics
  '72401': ['Trades'], // Heavy-duty equipment mechanics
  '72402': ['Trades'], // Heating, refrigeration and AC mechanics
  '72410': ['Trades'], // Automotive service technicians, truck/bus mechanics
  '72500': ['Trades'], // Crane operators
  '72501': ['Trades'], // Drillers and blasters

  // ── Transport ──
  '73300': ['Transport'], // Transport truck drivers
  '73301': ['Transport'], // Bus drivers, transit operators
  '73310': ['Transport'], // Railway yard engineers and rail traffic controllers
  '73311': ['Transport'], // Railway crew
  '74100': ['Transport'], // Delivery and courier service drivers
  '74101': ['Transport'], // Taxi and limousine drivers and chauffeurs

  // ── Agriculture / Agri-Food ──
  '80020': ['Agriculture'], // Managers in agriculture
  '80021': ['Agriculture'], // Managers in horticulture
  '82030': ['Agriculture'], // Agricultural and related service contractors/managers
  '82031': ['Agriculture'], // Fishing vessel masters/skippers
  '84120': ['Agriculture'], // Specialized livestock workers and farm machinery operators
  '85100': ['Agriculture'], // Livestock laborers
  '85101': ['Agriculture'], // Harvesting labourers
  '85103': ['Agriculture'], // Nursery and greenhouse labourers
  '94140': ['Agriculture'], // Process control and machine operators — food and beverage processing
  '94141': ['Agriculture'], // Industrial butchers and meat cutters, poultry preparers
  '95106': ['Agriculture'], // Labourers in food and beverage processing
};


/**
 * Look up which category-based draw categories a NOC code qualifies for.
 * Returns an empty array if the code is not in any category.
 */
export function getCategoriesForNoc(nocCode: string): DrawCategory[] {
  return NOC_CATEGORY_MAP[nocCode] || [];
}

/**
 * Get category info with comparison to general draw cutoffs.
 */
export function getCategoryComparison(nocCode: string, userCrsScore: number | null): Array<{
  category: CategoryInfo;
  qualified: boolean;
  scoreDiff: number | null; // positive = above cutoff, negative = below
}> {
  const categories = getCategoriesForNoc(nocCode);
  return categories.map(cat => {
    const info = CATEGORY_INFO[cat];
    return {
      category: info,
      qualified: true,
      scoreDiff: userCrsScore != null ? userCrsScore - info.avgCutoff2025 : null,
    };
  });
}
