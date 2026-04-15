// ======================================
// 1. Math Logistics for CRS Calculator
// ======================================
export function getAgePoints(age: number, hasSpouse: boolean): number {
  const max = hasSpouse ? 100 : 110;
  if (age <= 17) return 0;
  if (age === 18) return hasSpouse ? 90 : 99;
  if (age === 19) return hasSpouse ? 95 : 105;
  if (age >= 20 && age <= 29) return max;
  if (age === 30) return hasSpouse ? 95 : 105;
  if (age === 31) return hasSpouse ? 90 : 99;
  if (age === 32) return hasSpouse ? 85 : 94;
  if (age === 33) return hasSpouse ? 80 : 88;
  if (age === 34) return hasSpouse ? 75 : 83;
  if (age === 35) return hasSpouse ? 70 : 77;
  if (age === 36) return hasSpouse ? 65 : 72;
  if (age === 37) return hasSpouse ? 60 : 66;
  if (age === 38) return hasSpouse ? 55 : 61;
  if (age === 39) return hasSpouse ? 50 : 55;
  if (age === 40) return hasSpouse ? 45 : 50;
  if (age === 41) return hasSpouse ? 35 : 39;
  if (age === 42) return hasSpouse ? 25 : 28;
  if (age === 43) return hasSpouse ? 15 : 17;
  if (age === 44) return hasSpouse ? 5 : 6;
  return 0; // 45+
}

export function getEducationPoints(level: string, hasSpouse: boolean): number {
  const table: Record<string, [number, number]> = {
    'none':           [0, 0],
    'secondary':      [28, 30],
    'one-year':       [84, 90],
    'two-year':       [91, 98],
    'bachelors':      [112, 120],
    'two-or-more':    [119, 128],
    'masters':        [126, 135],
    'doctoral':       [140, 150],
  };
  const pts = table[level] || [0, 0];
  return hasSpouse ? pts[0] : pts[1];
}

export function getLanguageAbilityPoints(clb: number, hasSpouse: boolean): number {
  if (clb < 4) return 0;
  if (clb === 4 || clb === 5) return hasSpouse ? 6 : 6;
  if (clb === 6) return hasSpouse ? 8 : 9;
  if (clb === 7) return hasSpouse ? 16 : 17;
  if (clb === 8) return hasSpouse ? 22 : 23;
  if (clb === 9) return hasSpouse ? 29 : 31;
  return hasSpouse ? 32 : 34; // CLB 10+
}

export function getSpouseLanguagePoints(clb: number): number {
  if (clb < 5) return 0;
  if (clb === 5 || clb === 6) return 1;
  if (clb === 7 || clb === 8) return 3;
  return 5; // CLB 9+
}

export function getSecondLanguagePoints(clb: number): number {
  if (clb < 5) return 0;
  if (clb === 5 || clb === 6) return 1;
  if (clb === 7 || clb === 8) return 3;
  return 6;
}

export function getSpouseEducationPoints(level: string): number {
  const table: Record<string, number> = {
    'none':           0,
    'secondary':      2,
    'one-year':       6,
    'two-year':       7,
    'bachelors':      8,
    'two-or-more':    9,
    'masters':        10,
    'doctoral':       10,
  };
  return table[level] || 0;
}

export function getSpouseCanadianWorkPoints(years: number): number {
  if (years === 0) return 0;
  if (years === 1) return 5;
  if (years === 2) return 7;
  if (years === 3) return 8;
  if (years === 4) return 9;
  return 10; // 5+
}

export function getCanadianWorkPoints(years: number, hasSpouse: boolean): number {
  if (years === 0) return 0;
  if (years === 1) return hasSpouse ? 35 : 40;
  if (years === 2) return hasSpouse ? 46 : 53;
  if (years === 3) return hasSpouse ? 56 : 64;
  if (years === 4) return hasSpouse ? 63 : 72;
  return hasSpouse ? 70 : 80; // 5+
}

// Convert user facing exact scores back to our internal 1-10 math
export function extractCLB(rawStr: string): number {
  if (!rawStr) return 0;
  if (rawStr.startsWith('<')) return 3;
  if (rawStr === '10-12') return 10;
  // If it's a CLB format or a raw number format, parsing the first digits works.
  const match = rawStr.match(/\d+/);
  if (match) return parseInt(match[0], 10);
  return 0;
}

export const getLangOptions = (testName: string, skill: 'Listening' | 'Reading' | 'Writing' | 'Speaking') => {
  if (testName.includes('IELTS')) {
    if (skill === 'Listening') return [ {v: '10-12', l: '8.5-9.0'}, {v: '9', l: '8.0'}, {v: '8', l: '7.5'}, {v: '7', l: '6.0-7.0'}, {v: '6', l: '5.5'}, {v: '5', l: '5.0'}, {v: '4', l: '4.5'}, {v: '< 4', l: '0-4.0'} ];
    if (skill === 'Reading') return [ {v: '10-12', l: '8.0-9.0'}, {v: '9', l: '7.0-7.5'}, {v: '8', l: '6.5'}, {v: '7', l: '6.0'}, {v: '6', l: '5.0-5.5'}, {v: '5', l: '4.0-4.5'}, {v: '4', l: '3.5'}, {v: '< 4', l: '0-3.0'} ];
    if (skill === 'Writing' || skill === 'Speaking') return [ {v: '10-12', l: '7.5-9.0'}, {v: '9', l: '7.0'}, {v: '8', l: '6.5'}, {v: '7', l: '6.0'}, {v: '6', l: '5.5'}, {v: '5', l: '5.0'}, {v: '4', l: '4.0-4.5'}, {v: '< 4', l: '0-3.5'} ];
  }
  if (testName.includes('CELPIP')) {
    return [ {v: '10-12', l: '10-12'}, {v: '9', l: '9'}, {v: '8', l: '8'}, {v: '7', l: '7'}, {v: '6', l: '6'}, {v: '5', l: '5'}, {v: '4', l: '4'}, {v: '< 4', l: 'M, 0-3'} ];
  }
  if (testName.includes('PTE')) {
    if (skill === 'Listening') return [ {v: '10-12', l: '89+'}, {v: '9', l: '82-88'}, {v: '8', l: '71-81'}, {v: '7', l: '60-70'}, {v: '6', l: '50-59'}, {v: '5', l: '39-49'}, {v: '4', l: '28-38'}, {v: '< 4', l: '0-27'} ];
    if (skill === 'Reading') return [ {v: '10-12', l: '88+'}, {v: '9', l: '78-87'}, {v: '8', l: '69-77'}, {v: '7', l: '60-68'}, {v: '6', l: '51-59'}, {v: '5', l: '42-50'}, {v: '4', l: '33-41'}, {v: '< 4', l: '0-32'} ];
    if (skill === 'Writing') return [ {v: '10-12', l: '90+'}, {v: '9', l: '88-89'}, {v: '8', l: '79-87'}, {v: '7', l: '69-78'}, {v: '6', l: '60-68'}, {v: '5', l: '51-59'}, {v: '4', l: '41-50'}, {v: '< 4', l: '0-40'} ];
    if (skill === 'Speaking') return [ {v: '10-12', l: '89+'}, {v: '9', l: '84-88'}, {v: '8', l: '76-83'}, {v: '7', l: '68-75'}, {v: '6', l: '59-67'}, {v: '5', l: '51-58'}, {v: '4', l: '42-50'}, {v: '< 4', l: '0-41'} ];
  }
  if (testName.includes('TEF')) {
    if (skill === 'Listening') return [ {v: '10-12', l: '316-360'}, {v: '9', l: '298-315'}, {v: '8', l: '280-297'}, {v: '7', l: '249-279'}, {v: '6', l: '217-248'}, {v: '5', l: '181-216'}, {v: '4', l: '145-180'}, {v: '< 4', l: '0-144'} ];
    if (skill === 'Reading') return [ {v: '10-12', l: '263-300'}, {v: '9', l: '248-262'}, {v: '8', l: '233-247'}, {v: '7', l: '207-232'}, {v: '6', l: '181-206'}, {v: '5', l: '151-180'}, {v: '4', l: '121-150'}, {v: '< 4', l: '0-120'} ];
    if (skill === 'Writing' || skill === 'Speaking') return [ {v: '10-12', l: '393-450'}, {v: '9', l: '371-392'}, {v: '8', l: '349-370'}, {v: '7', l: '310-348'}, {v: '6', l: '271-309'}, {v: '5', l: '226-270'}, {v: '4', l: '181-225'}, {v: '< 4', l: '0-180'} ];
  }
  if (testName.includes('TCF')) {
    if (skill === 'Listening') return [ {v: '10-12', l: '549-699'}, {v: '9', l: '523-548'}, {v: '8', l: '503-522'}, {v: '7', l: '458-502'}, {v: '6', l: '398-457'}, {v: '5', l: '369-397'}, {v: '4', l: '331-368'}, {v: '< 4', l: '0-330'} ];
    if (skill === 'Reading') return [ {v: '10-12', l: '549-699'}, {v: '9', l: '524-548'}, {v: '8', l: '499-523'}, {v: '7', l: '453-498'}, {v: '6', l: '406-452'}, {v: '5', l: '375-405'}, {v: '4', l: '342-374'}, {v: '< 4', l: '0-341'} ];
    if (skill === 'Writing' || skill === 'Speaking') return [ {v: '10-12', l: '16-20'}, {v: '9', l: '14-15'}, {v: '8', l: '12-13'}, {v: '7', l: '10-11'}, {v: '6', l: '7-9'}, {v: '5', l: '6'}, {v: '4', l: '4-5'}, {v: '< 4', l: '0-3'} ];
  }
  // Default to CLB level
  return [ {v: '10-12', l: 'CLB 10-12'}, {v: '9', l: 'CLB 9'}, {v: '8', l: 'CLB 8'}, {v: '7', l: 'CLB 7'}, {v: '6', l: 'CLB 6'}, {v: '5', l: 'CLB 5'}, {v: '4', l: 'CLB 4'}, {v: '< 4', l: 'CLB < 4'} ];
};
