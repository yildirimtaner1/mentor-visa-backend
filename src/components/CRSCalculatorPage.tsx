import { type FC, useState, useMemo } from 'react';
import { SEO } from './common/SEO';

interface CRSCalculatorPageProps {
  onNavigate: (page: string) => void;
}

const crsSchema = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Mentor Visa CRS Calculator",
  "operatingSystem": "Web",
  "applicationCategory": "WebApplication",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "CAD"
  },
  "description": "Calculate your Comprehensive Ranking System (CRS) score for Canadian Express Entry accurately."
});

// ======================================
// 1. Math Logistics
// ======================================
function getAgePoints(age: number, hasSpouse: boolean): number {
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

function getEducationPoints(level: string, hasSpouse: boolean): number {
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

function getLanguageAbilityPoints(clb: number, hasSpouse: boolean): number {
  if (clb < 4) return 0;
  if (clb === 4 || clb === 5) return hasSpouse ? 6 : 6;
  if (clb === 6) return hasSpouse ? 8 : 9;
  if (clb === 7) return hasSpouse ? 16 : 17;
  if (clb === 8) return hasSpouse ? 22 : 23;
  if (clb === 9) return hasSpouse ? 29 : 31;
  return hasSpouse ? 32 : 34; // CLB 10+
}

function getSpouseLanguagePoints(clb: number): number {
  if (clb < 5) return 0;
  if (clb === 5 || clb === 6) return 1;
  if (clb === 7 || clb === 8) return 3;
  return 5; // CLB 9+
}

function getSecondLanguagePoints(clb: number, hasSpouse: boolean): number {
  if (clb < 5) return 0;
  if (clb === 5 || clb === 6) return 1;
  if (clb === 7 || clb === 8) return 3;
  return hasSpouse ? 5 : 6;
}

function getSpouseEducationPoints(level: string): number {
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

function getSpouseCanadianWorkPoints(years: number): number {
  if (years === 0) return 0;
  if (years === 1) return 5;
  if (years === 2) return 7;
  if (years === 3) return 8;
  if (years === 4) return 9;
  return 10; // 5+
}

function getCanadianWorkPoints(years: number, hasSpouse: boolean): number {
  if (years === 0) return 0;
  if (years === 1) return hasSpouse ? 35 : 40;
  if (years === 2) return hasSpouse ? 46 : 53;
  if (years === 3) return hasSpouse ? 56 : 64;
  if (years === 4) return hasSpouse ? 63 : 72;
  return hasSpouse ? 70 : 80; // 5+
}

// Convert user facing exact scores back to our internal 1-10 math
function extractCLB(rawStr: string): number {
  if (!rawStr) return 0;
  if (rawStr.startsWith('<')) return 3;
  if (rawStr === '10-12') return 10;
  // If it's a CLB format or a raw number format, parsing the first digits works.
  const match = rawStr.match(/\d+/);
  if (match) return parseInt(match[0], 10);
  return 0;
}

const getLangOptions = (testName: string, skill: 'Listening' | 'Reading' | 'Writing' | 'Speaking') => {
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


export const CRSCalculatorPage: FC<CRSCalculatorPageProps> = ({ onNavigate: _onNavigate }) => {
  // Step 1: Age
  const [age, setAge] = useState<number | ''>('');
  
  // Step 2: Marital Status
  const [maritalStatus, setMaritalStatus] = useState<string>('');
  
  // Step 3: Spouse Details (progressive disclosure)
  const [spouseIsPR, setSpouseIsPR] = useState<string>('');
  const [spouseAccompanying, setSpouseAccompanying] = useState<string>('');

  const hasSpouseForMath = (maritalStatus === 'Married' || maritalStatus === 'Common-Law') 
                            && spouseIsPR === 'No' 
                            && spouseAccompanying === 'Yes';
  
  // Step 4: Education
  const [education, setEducation] = useState('');
  const [hasCanadianEducation, setHasCanadianEducation] = useState('No');
  const [canadianEducation, setCanadianEducation] = useState('');

  // Step 5: Language Tests
  const [lang1Test, setLang1Test] = useState('');
  const [lang1R, setLang1R] = useState('');
  const [lang1W, setLang1W] = useState('');
  const [lang1L, setLang1L] = useState('');
  const [lang1S, setLang1S] = useState('');

  const [lang2Test, setLang2Test] = useState('None / Not Applicable');
  const [lang2R, setLang2R] = useState('');
  const [lang2W, setLang2W] = useState('');
  const [lang2L, setLang2L] = useState('');
  const [lang2S, setLang2S] = useState('');



  const clbReading = extractCLB(lang1R);
  const clbWriting = extractCLB(lang1W);
  const clbListening = extractCLB(lang1L);
  const clbSpeaking = extractCLB(lang1S);

  // Step 6: Work
  const [canadianWork, setCanadianWork] = useState('');
  const [foreignWork, setForeignWork] = useState('');
  
  // Step 7: Additional Factors
  const [provincialNom, setProvincialNom] = useState('');
  const [siblingInCanada, setSiblingInCanada] = useState('');
  const [certOfQualification, setCertOfQualification] = useState('');
  
  // Step 8: Spouse Factors
  const [spouseEducation, setSpouseEducation] = useState('');
  const [spLangTest, setSpLangTest] = useState('None / Not Applicable');
  const [spR, setSpR] = useState('');
  const [spW, setSpW] = useState('');
  const [spL, setSpL] = useState('');
  const [spS, setSpS] = useState('');
  const [spouseCanadianWork, setSpouseCanadianWork] = useState('');
  
  // Math Derivations
  const score = useMemo(() => {
    const parseYears = (str: string) => {
      if (!str || str === 'None or less than a year') return 0;
      if (str.startsWith('1')) return 1;
      if (str.startsWith('2')) return 2;
      if (str.startsWith('3')) return 3;
      if (str.startsWith('4')) return 4;
      if (str.startsWith('5')) return 5;
      return 0;
    };
    const caWorkNum = parseYears(canadianWork);
    const forWorkNum = parseYears(foreignWork);
    const spWorkNum = parseYears(spouseCanadianWork);
    
    const spClbR = extractCLB(spR);
    const spClbW = extractCLB(spW);
    const spClbL = extractCLB(spL);
    const spClbS = extractCLB(spS);
    
    const clb2R = extractCLB(lang2R);
    const clb2W = extractCLB(lang2W);
    const clb2L = extractCLB(lang2L);
    const clb2S = extractCLB(lang2S);

    const activeAge = age === '' ? 28 : (age as number); 
    const agePoints = getAgePoints(activeAge, hasSpouseForMath);
    const eduPoints = getEducationPoints(education, hasSpouseForMath);
    
    const firstLangPoints = getLanguageAbilityPoints(clbReading, hasSpouseForMath) + getLanguageAbilityPoints(clbWriting, hasSpouseForMath) + getLanguageAbilityPoints(clbListening, hasSpouseForMath) + getLanguageAbilityPoints(clbSpeaking, hasSpouseForMath);
    const secondLangPoints = getSecondLanguagePoints(clb2R, hasSpouseForMath) + getSecondLanguagePoints(clb2W, hasSpouseForMath) + getSecondLanguagePoints(clb2L, hasSpouseForMath) + getSecondLanguagePoints(clb2S, hasSpouseForMath);
    const officialLanguagesPoints = firstLangPoints + secondLangPoints;
    
    const canWorkPoints = getCanadianWorkPoints(caWorkNum, hasSpouseForMath);
    const coreTotal = agePoints + eduPoints + officialLanguagesPoints + canWorkPoints;

    let spouseTotal = 0;
    let spEduPoints = 0;
    let spLangPoints = 0;
    let spWorkPoints = 0;
    if (hasSpouseForMath) {
      spEduPoints = getSpouseEducationPoints(spouseEducation);
      spLangPoints = getSpouseLanguagePoints(spClbR) + getSpouseLanguagePoints(spClbW) + getSpouseLanguagePoints(spClbL) + getSpouseLanguagePoints(spClbS);
      spWorkPoints = getSpouseCanadianWorkPoints(spWorkNum);
      spouseTotal = spEduPoints + spLangPoints + spWorkPoints;
    }

    const minCLB = Math.min(clbReading, clbWriting, clbListening, clbSpeaking);
    const isCLB7 = minCLB >= 7;
    const isCLB9 = minCLB >= 9;
    
    let eduLevel = 0;
    if (['one-year', 'two-year', 'bachelors'].includes(education)) eduLevel = 1;
    if (['two-or-more', 'masters', 'doctoral'].includes(education)) eduLevel = 2;

    let transEduLang = 0;
    if (eduLevel === 1) { if (isCLB9) transEduLang = 25; else if (isCLB7) transEduLang = 13; }
    else if (eduLevel === 2) { if (isCLB9) transEduLang = 50; else if (isCLB7) transEduLang = 25; }

    let transEduCanWork = 0;
    if (eduLevel === 1) { if (caWorkNum >= 2) transEduCanWork = 25; else if (caWorkNum === 1) transEduCanWork = 13; }
    else if (eduLevel === 2) { if (caWorkNum >= 2) transEduCanWork = 50; else if (caWorkNum === 1) transEduCanWork = 25; }
    
    const transferabilityEdu = Math.min(transEduLang + transEduCanWork, 50);

    let transForLang = 0;
    if (forWorkNum === 1 || forWorkNum === 2) { if (isCLB9) transForLang = 25; else if (isCLB7) transForLang = 13; }
    else if (forWorkNum >= 3) { if (isCLB9) transForLang = 50; else if (isCLB7) transForLang = 25; }

    let transForCanWork = 0;
    if (forWorkNum === 1 || forWorkNum === 2) { if (caWorkNum >= 2) transForCanWork = 25; else if (caWorkNum === 1) transForCanWork = 13; }
    else if (forWorkNum >= 3) { if (caWorkNum >= 2) transForCanWork = 50; else if (caWorkNum === 1) transForCanWork = 25; }

    const transferabilityForeign = Math.min(transForLang + transForCanWork, 50);
    
    let transCert = 0;
    if (certOfQualification === 'Yes') {
      if (isCLB7) transCert = 50;
      else if (minCLB >= 5) transCert = 25;
    }

    const transferability = Math.min(transferabilityEdu + transferabilityForeign + transCert, 100);

    let additional = 0;
    if (provincialNom === 'Yes') additional += 600;
    if (canadianEducation === 'one-two') additional += 15;
    if (canadianEducation === 'three-plus') additional += 30;
    
    // French Bonus Logic
    let isFrenchFirst = lang1Test.includes('French');
    let isFrenchSecond = lang2Test.includes('French');
    let isEngFirst = lang1Test.includes('English');
    let isEngSecond = lang2Test.includes('English');
    
    let hasStrongFrench = false;
    let hasEng4 = false;

    if (isFrenchFirst) {
      if (minCLB >= 7) hasStrongFrench = true;
      if (isEngSecond && clb2R >= 4 && clb2W >= 4 && clb2L >= 4 && clb2S >= 4) {
        hasEng4 = true;
      }
    } else if (isFrenchSecond) {
      if (clb2R >= 7 && clb2W >= 7 && clb2L >= 7 && clb2S >= 7) {
        hasStrongFrench = true;
      }
      if (isEngFirst && minCLB >= 5) hasEng4 = true;
    }

    let frenchBonusPoints = 0;
    if (hasStrongFrench) {
      frenchBonusPoints = hasEng4 ? 50 : 25;
      additional += frenchBonusPoints;
    }

    const siblingPoints = siblingInCanada === 'Yes' ? 15 : 0;
    additional += siblingPoints;
    
    const provNomPoints = provincialNom === 'Yes' ? 600 : 0;
    const studyCanPoints = canadianEducation === 'one-two' ? 15 : canadianEducation === 'three-plus' ? 30 : 0;

    const breakdown = {
      core: {
        age: agePoints,
        education: eduPoints,
        officialLanguages: officialLanguagesPoints,
        firstOfficialLanguage: firstLangPoints,
        secondOfficialLanguage: secondLangPoints,
        canadianWorkExperience: canWorkPoints,
        subtotal: coreTotal 
      },
      spouse: {
        education: spEduPoints,
        firstOfficialLanguages: spLangPoints,
        canadianWorkExperience: spWorkPoints,
        subtotal: spouseTotal
      },
      transferability: {
        education: {
          languageAndEducation: transEduLang,
          canadianWorkAndEducation: transEduCanWork,
          subtotal: transferabilityEdu
        },
        foreignWork: {
          languageAndForeignWork: transForLang,
          canadianAndForeignWork: transForCanWork,
          subtotal: transferabilityForeign
        },
        certificateOfQualification: transCert,
        subtotal: transferability
      },
      additional: {
        provincialNomination: provNomPoints,
        studyInCanada: studyCanPoints,
        siblingInCanada: siblingPoints,
        frenchLanguageSkills: frenchBonusPoints,
        subtotal: additional 
      }
    };

    return {
      core: coreTotal, spouse: spouseTotal, transferability, additional,
      total: coreTotal + spouseTotal + transferability + additional,
      breakdown
    };
  }, [age, education, canadianWork, foreignWork, hasSpouseForMath, clbReading, clbWriting, clbListening, clbSpeaking, spouseEducation, spR, spW, spL, spS, spouseCanadianWork, provincialNom, canadianEducation, lang1Test, lang2Test, lang2R, lang2W, lang2L, lang2S, siblingInCanada, certOfQualification]);

  // ======================================
  // 2. Wizard UI State
  // ======================================
  const isMarriedObj = maritalStatus === 'Married' || maritalStatus === 'Common-Law';

  const steps = [
    { id: 'age', title: 'Age', icon: '👤', color: '#10B981' },
    { id: 'marital', title: 'Marital Status', icon: '🫂', color: '#10B981' },
    ...(isMarriedObj ? [{ id: 'spouse', title: 'Spouse Details', icon: '💗', color: '#10B981' }] : []),
    { id: 'education', title: 'Education', icon: '🎓', color: '#10B981' }, 
    { id: 'language', title: 'Language Proficiency', icon: '🌐', color: '#10B981' }, 
    { id: 'work', title: 'Work Experience', icon: '💼', color: '#10B981' },
    { id: 'additional', title: 'Additional Factors', icon: '⭐', color: '#10B981' },
    ...(hasSpouseForMath ? [{ id: 'spouse_factors', title: 'Spouse Factors', icon: '📋', color: '#10B981' }] : []),
    { id: 'results', title: 'Your Result', icon: '📊', color: '#3B82F6' }
  ];

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [highestStepReached, setHighestStepReached] = useState(0);

  const goToStep = (index: number) => {
    if (index <= highestStepReached || index === currentStepIndex + 1) {
      setCurrentStepIndex(index);
      if (index > highestStepReached) {
        setHighestStepReached(index);
      }
      window.scrollTo({ top: 100, behavior: 'smooth' });
    }
  };

  const currentStep = steps[currentStepIndex];
  const isFinalStep = currentStepIndex === steps.length - 1;
  const progressPercent = Math.round((currentStepIndex / (steps.length - 1)) * 100);

  // Validation functions to prevent advancing if field is empty
  const canAdvance = () => {
    if (currentStep.id === 'age') return age !== '';
    if (currentStep.id === 'marital') return maritalStatus !== '';
    if (currentStep.id === 'spouse') {
      if (spouseIsPR === '') return false;
      if (spouseIsPR === 'No' && spouseAccompanying === '') return false;
      return true;
    }
    if (currentStep.id === 'education') {
      if (education === '') return false;
      if (hasCanadianEducation === 'Yes' && canadianEducation === '') return false;
      return true;
    }
    if (currentStep.id === 'language') {
      if (lang1Test === '') return false;
      if (lang1Test !== '' && (lang1R === '' || lang1W === '' || lang1L === '' || lang1S === '')) return false;
      if (lang2Test !== 'None / Not Applicable' && (lang2R === '' || lang2W === '' || lang2L === '' || lang2S === '')) return false;
      return true;
    }
    if (currentStep.id === 'work') {
      if (canadianWork === '' || foreignWork === '') return false;
      return true;
    }
    if (currentStep.id === 'additional') {
      if (siblingInCanada === '' || certOfQualification === '' || provincialNom === '') return false;
      return true;
    }
    if (currentStep.id === 'spouse_factors') {
      if (spouseEducation === '' || spouseCanadianWork === '') return false;
      if (spLangTest !== 'None / Not Applicable' && (spR === '' || spW === '' || spL === '' || spS === '')) return false;
      return true;
    }
    return true; // other steps have defaults
  };

  return (
    <div style={{ backgroundColor: '#F8FAFC', minHeight: '100vh', fontFamily: '"Inter", sans-serif' }}>
      <SEO 
        title="Canada CRS Calculator 2026 | Express Entry Points Estimator" 
        description="Calculate your Comprehensive Ranking System (CRS) score for Canadian Express Entry. Get an accurate points estimate for the Canadian Experience Class."
        keywords="CRS calculator, Express Entry points, Canada PR score, CEC eligibility"
        canonical="/crs-calculator"
        schema={crsSchema}
      />
      {/* Standardized Platform Hero Header */}
      {!isFinalStep && (
        <div className="page-hero">
          <div className="page-hero-content">
            <div className="page-hero-badge">
              <span>📊</span> Accurate Engine
            </div>
            <h1>Canadian <br /><span style={{ color: 'var(--primary-color)' }}>CRS Calculator</span></h1>
            <p>Determine your Comprehensive Ranking System score instantly. Our smart wizard evaluates your profile against the latest IRCC criteria.</p>
          </div>
        </div>
      )}

      <div className="page-container" style={{ paddingTop: '40px' }}>
        <div className="crs-main-layout">
          
          {/* Sidebar */}
          <div className="crs-sidebar" style={{ 
            flex: isFinalStep ? '0 0 0px' : '0 0 280px',
            opacity: isFinalStep ? 0 : 1,
            overflow: 'hidden',
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            position: 'sticky',
            top: '40px'
          }}>
            <h4 style={{ fontSize: '1rem', color: '#0F172A', marginBottom: '16px', fontWeight: 700 }}>
              Assessment Factors
            </h4>
            {steps.map((step, index) => {
              const isActive = index === currentStepIndex;
              const isCompleted = index < currentStepIndex || index <= highestStepReached;
              const isDisabled = index > highestStepReached && index !== currentStepIndex + 1;
              
              return (
                <div 
                  key={step.id}
                  onClick={() => !isDisabled && canAdvance() && goToStep(index)}
                  style={{
                    backgroundColor: isActive ? 'white' : 'var(--surface-color, #F8FAFC)',
                    border: isActive ? '1px solid var(--border-color)' : '1px solid transparent',
                    boxShadow: isActive ? '0 2px 8px rgba(0, 0, 0, 0.06)' : 'none',
                    color: '#334155',
                    opacity: isDisabled ? 0.5 : 1, 
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    borderRadius: '10px',
                    padding: '14px 16px',
                    marginBottom: '8px',
                    fontWeight: isActive ? 600 : 500,
                    fontSize: '0.95rem',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}
                >
                  <span style={{ fontSize: '1.2rem' }}>{step.icon}</span>
                  <span>{step.title}</span>
                  {isCompleted && !isActive && (
                    <span style={{ marginLeft: 'auto', color: '#10B981', background: '#D1FAE5', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800 }}>✓</span>
                  )}
                </div>
              );
            })}

            {!isFinalStep && (
              <div style={{ marginTop: '20px', padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px', marginBottom: '4px', fontWeight: 600 }}>Live Score</div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>{score.total}</div>
              </div>
            )}
          </div>

          {/* Main Content */}
          <div className="info-card" style={{ 
            borderRadius: '14px',
            padding: 0, 
            overflow: 'hidden',
            flex: '1',
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
          }}>
            
            {/* Step Header */}
            <div style={{ 
              padding: '28px 32px', 
              borderBottom: '1px solid var(--border-color, #E2E8F0)', 
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'flex-start',
              gap: '8px'
            }}>
              {currentStep.id !== 'results' && (
                <div className="crs-mobile-step">
                  Step {currentStepIndex + 1} of {steps.length - 1}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <span style={{ fontSize: '1.5rem' }}>{currentStep.icon}</span>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                {currentStep.title}
              </h2>
              </div>
            </div>

            <div style={{ padding: '32px' }}>
              {/* Step 1: Age */}
              {currentStep.id === 'age' && (
                <div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '1rem', color: '#374151', marginBottom: '12px', fontWeight: 500 }}>
                      How old are you? <span style={{ color: '#DC2626' }}>*</span>
                    </label>
                    <select 
                      className="form-select" 
                      value={age} 
                      onChange={e => setAge(e.target.value === '' ? '' : +e.target.value)} 
                      style={{ fontSize: '1rem', padding: '12px', borderColor: '#D1D5DB', borderRadius: '6px' }}
                    >
                      <option value="">Select</option>
                      <option value={17}>17 years or less</option>
                      {Array.from({ length: 27 }, (_, i) => i + 18).map(n => (
                        <option key={n} value={n}>{n} years</option>
                      ))}
                      <option value={45}>45 years or more</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Step 2: Marital Status */}
              {currentStep.id === 'marital' && (
                <div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '1rem', color: '#374151', marginBottom: '12px', fontWeight: 500 }}>
                      What is your marital status? <span style={{ color: '#DC2626' }}>*</span>
                    </label>
                    <select 
                      className="form-select" 
                      value={maritalStatus} 
                      onChange={e => {
                        setMaritalStatus(e.target.value);
                        setSpouseIsPR('');
                        setSpouseAccompanying('');
                      }} 
                      style={{ fontSize: '1rem', padding: '12px', borderColor: '#D1D5DB', borderRadius: '6px' }}
                    >
                      <option value="">Select</option>
                      <option value="Never Married / Single">Never Married / Single</option>
                      <option value="Married">Married</option>
                      <option value="Common-Law">Common-Law</option>
                      <option value="Divorced / Separated">Divorced / Separated</option>
                      <option value="Widowed">Widowed</option>
                      <option value="Annulled Marriage">Annulled Marriage</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Step 3: Spouse Details */}
              {currentStep.id === 'spouse' && (
                <div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '1rem', color: '#374151', marginBottom: '12px', fontWeight: 500 }}>
                      Is your spouse or common-law partner a citizen or permanent resident of Canada?
                    </label>
                    <select 
                      className="form-select" 
                      value={spouseIsPR} 
                      onChange={e => {
                        setSpouseIsPR(e.target.value);
                        if (e.target.value === 'Yes') setSpouseAccompanying('');
                      }}
                      style={{ fontSize: '1rem', padding: '12px', borderColor: '#D1D5DB', borderRadius: '6px' }}
                    >
                      <option value="">Select</option>
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                  </div>

                  {spouseIsPR === 'No' && (
                    <div className="form-group" style={{ marginTop: '24px', animation: 'fadeInUp 0.3s ease-out' }}>
                      <label className="form-label" style={{ fontSize: '1rem', color: '#374151', marginBottom: '12px', fontWeight: 500 }}>
                        Will your spouse or common-law partner come with you to Canada?
                      </label>
                      <select 
                        className="form-select" 
                        value={spouseAccompanying} 
                        onChange={e => setSpouseAccompanying(e.target.value)}
                        style={{ fontSize: '1rem', padding: '12px', borderColor: '#D1D5DB', borderRadius: '6px' }}
                      >
                        <option value="">Select</option>
                        <option value="No">No</option>
                        <option value="Yes">Yes</option>
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Step 4: Education */}
              {currentStep.id === 'education' && (
                <div style={{ animation: 'fadeInUp 0.3s ease-out' }}>
                  <div className="form-group" style={{ marginBottom: '32px' }}>
                    <label className="form-label" style={{ fontSize: '1rem', color: '#374151', marginBottom: '12px', fontWeight: 500 }}>
                      What is your level of education? <span style={{ color: '#DC2626' }}>*</span>
                    </label>
                    <select className="form-select" value={education} onChange={e => setEducation(e.target.value)} style={{ fontSize: '0.95rem', padding: '14px', borderColor: '#D1D5DB', borderRadius: '6px' }}>
                      <option value="">Select</option>
                      <option value="none">None, or less than secondary (high school)</option>
                      <option value="secondary">Secondary diploma (high school graduation)</option>
                      <option value="one-year">One-year program at a university, college, trade or technical school, or other institute</option>
                      <option value="two-year">Two-year program at a university, college, trade or technical school, or other institute</option>
                      <option value="bachelors">Bachelor's degree OR a three or more year program at a university, college, trade or technical school, or other institute</option>
                      <option value="two-or-more">Two or more certificates, diplomas, or degrees. One must be for a program of three or more years</option>
                      <option value="masters">Master's degree, OR professional degree needed to practice in a licensed profession (e.g., MD, DDS, DVM, LLB, JD, OD)</option>
                      <option value="doctoral">Doctoral level university degree (PhD)</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: hasCanadianEducation === 'Yes' ? '24px' : '0' }}>
                    <label className="form-label" style={{ fontSize: '1rem', color: '#374151', marginBottom: '12px', fontWeight: 500 }}>
                      Have you earned a Canadian degree, diploma or certificate?
                    </label>
                    <select className="form-select" value={hasCanadianEducation} onChange={e => {
                      setHasCanadianEducation(e.target.value);
                      if (e.target.value !== 'Yes') setCanadianEducation('none');
                      else setCanadianEducation('');
                    }} style={{ fontSize: '0.95rem', padding: '14px', borderColor: '#D1D5DB', borderRadius: '6px' }}>
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                  </div>

                  {hasCanadianEducation === 'Yes' && (
                    <div style={{ animation: 'fadeInUp 0.3s ease-out' }}>
                      <div style={{ background: '#FFFBEB', borderLeft: '4px solid #F59E0B', borderTop: '1px solid #FEF3C7', borderRight: '1px solid #FEF3C7', borderBottom: '1px solid #FEF3C7', padding: '16px 20px', borderRadius: '4px', marginBottom: '24px' }}>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#92400E', marginBottom: '12px' }}>
                          To confirm eligibility, please ensure the following criteria are met:
                        </h4>
                        <ul style={{ fontSize: '0.85rem', color: '#B45309', margin: 0, paddingLeft: '20px', lineHeight: 1.6, listStyleType: 'disc' }}>
                          <li>Your program of study must qualify for a post-graduation work permit.</li>
                          <li style={{ marginTop: '8px' }}>Courses in English or French as a Second Language should constitute less than half of your curriculum.</li>
                          <li style={{ marginTop: '8px' }}>Your education must not have been funded by a scholarship or grant that obligates you to apply your skills and knowledge in your home country post-graduation.</li>
                          <li style={{ marginTop: '8px' }}>Your institution of study must be located within Canada; studies at international branch campuses do not qualify.</li>
                          <li style={{ marginTop: '8px' }}>You must have been enrolled as a full-time student for a minimum of eight months, with the exception of those who completed their studies or training (either in full or partially) between March 2020 and August 2022.</li>
                          <li style={{ marginTop: '8px' }}>A physical presence in Canada for at least eight months is required, unless your study or training completion (whole or part) falls between March 2020 and August 2022.</li>
                        </ul>
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '1rem', color: '#374151', marginBottom: '12px', fontWeight: 500 }}>
                          Choose the best answer to describe your Canadian education.
                        </label>
                        <select className="form-select" value={canadianEducation} onChange={e => setCanadianEducation(e.target.value)} style={{ fontSize: '0.95rem', padding: '14px', borderColor: '#D1D5DB', borderRadius: '6px' }}>
                          <option value="">Select</option>
                          <option value="one-two">One or two-year diploma or certificate</option>
                          <option value="three-plus">Degree, diploma or certificate of three years or longer, or a Master's, professional or doctoral degree</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 5: Language Proficiency (Advanced UI) */}
              {currentStep.id === 'language' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '24px' }}>
                  
                  {/* Language Test 1 Box */}
                  <div style={{ border: '2px solid #3B82F6', borderRadius: '8px', padding: '24px', backgroundColor: '#EFF6FF' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#1E3A8A', fontWeight: 700 }}>
                      <span style={{ width: '24px', height: '24px', background: '#3B82F6', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem' }}>1</span>
                      Language Test - 1
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.9rem', color: '#1E3A8A', fontWeight: 500 }}>Which language test have you taken, or do you plan to take? <span style={{color: '#DC2626'}}>*</span></label>
                      <select className="form-select" value={lang1Test} onChange={e => {
                        setLang1Test(e.target.value);
                        setLang1L(''); setLang1S(''); setLang1R(''); setLang1W('');
                        // If they select English for lang1, change lang2 defaults to not include same
                        if (e.target.value.includes('English') && lang2Test.includes('English')) setLang2Test('None / Not Applicable');
                        if (e.target.value.includes('French') && lang2Test.includes('French')) setLang2Test('None / Not Applicable');
                      }} style={{ padding: '12px', fontSize: '0.9rem', borderColor: '#93C5FD' }}>
                        <option value="">Select test</option>
                        <option value="CELPIP-General (English)">CELPIP-General (English)</option>
                        <option value="IELTS General Training (English)">IELTS General Training (English)</option>
                        <option value="PTE Core (English)">PTE Core (English)</option>
                        <option value="TEF Canada (French)">TEF Canada (French)</option>
                        <option value="TCF Canada (French)">TCF Canada (French)</option>
                      </select>
                    </div>

                    <p style={{ fontSize: '0.85rem', color: '#2563EB', margin: '16px 0', lineHeight: 1.5 }}>
                      <strong>Test Selection:</strong> Choose the approved language test you have taken or plan to take, and enter your scores. Language Test - 1 should be the test where you expect to receive the higher scores.
                    </p>

                    {lang1Test && (
                      <div style={{ animation: 'fadeInUp 0.3s ease-out' }}>
                        <h5 style={{ fontSize: '0.95rem', color: '#1E3A8A', fontWeight: 700, marginBottom: '12px' }}>Language Scores</h5>
                        <div className="crs-grid">
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{fontSize: '0.85rem'}}>Listening *</label>
                            <select className="form-select" value={lang1L} onChange={e => setLang1L(e.target.value)} style={{padding: '10px'}}>
                              <option value="">Select points</option>
                              {getLangOptions(lang1Test, 'Listening').map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                            </select>
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{fontSize: '0.85rem'}}>Speaking *</label>
                            <select className="form-select" value={lang1S} onChange={e => setLang1S(e.target.value)} style={{padding: '10px'}}>
                              <option value="">Select points</option>
                              {getLangOptions(lang1Test, 'Speaking').map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                            </select>
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{fontSize: '0.85rem'}}>Reading *</label>
                            <select className="form-select" value={lang1R} onChange={e => setLang1R(e.target.value)} style={{padding: '10px'}}>
                              <option value="">Select points</option>
                              {getLangOptions(lang1Test, 'Reading').map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                            </select>
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{fontSize: '0.85rem'}}>Writing *</label>
                            <select className="form-select" value={lang1W} onChange={e => setLang1W(e.target.value)} style={{padding: '10px'}}>
                              <option value="">Select points</option>
                              {getLangOptions(lang1Test, 'Writing').map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Language Test 2 Box (Optional) */}
                  <div style={{ border: '2px solid #22C55E', borderRadius: '8px', padding: '24px', backgroundColor: '#ECFDF5' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#065F46', fontWeight: 700 }}>
                      <span style={{ width: '24px', height: '24px', background: '#22C55E', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem' }}>2</span>
                      Language Test 2 (Optional)
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.9rem', color: '#065F46', fontWeight: 500 }}>Which language test have you taken, or are you considering, for your second foreign language?</label>
                      <p style={{ fontSize: '0.8rem', color: '#047857', marginBottom: '12px' }}>Use this section only if you want to include Language Test 2 (English or French).</p>
                      <select className="form-select" value={lang2Test} onChange={e => {
                        setLang2Test(e.target.value);
                        if (e.target.value === 'None / Not Applicable') {
                          setLang2R(''); setLang2W(''); setLang2L(''); setLang2S('');
                        } else {
                          setLang2R('10-12'); setLang2W('10-12'); setLang2L('10-12'); setLang2S('9');
                        }
                      }} style={{ padding: '12px', fontSize: '0.9rem', borderColor: '#6EE7B7' }}>
                        <option value="None / Not Applicable">None / Not Applicable</option>
                        {lang1Test.includes('English') ? (
                          <>
                            <option value="TEF Canada (French)">TEF Canada (French)</option>
                            <option value="TCF Canada (French)">TCF Canada (French)</option>
                          </>
                        ) : (
                          <>
                            <option value="CELPIP-General (English)">CELPIP-General (English)</option>
                            <option value="IELTS General Training (English)">IELTS General Training (English)</option>
                            <option value="PTE Core (English)">PTE Core (English)</option>
                          </>
                        )}
                      </select>
                    </div>

                    {lang2Test !== 'None / Not Applicable' && (
                      <div style={{ marginTop: '24px', animation: 'fadeInUp 0.3s ease-out' }}>
                        <h5 style={{ fontSize: '0.95rem', color: '#065F46', fontWeight: 700, marginBottom: '12px' }}>Language Scores</h5>
                        <div className="crs-grid">
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{fontSize: '0.85rem', color: '#064E3B'}}>Listening *</label>
                            <select className="form-select" value={lang2L} onChange={e => setLang2L(e.target.value)} style={{padding: '10px'}}>
                              <option value="">Select points</option>
                              {getLangOptions(lang2Test, 'Listening').map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                            </select>
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{fontSize: '0.85rem', color: '#064E3B'}}>Speaking *</label>
                            <select className="form-select" value={lang2S} onChange={e => setLang2S(e.target.value)} style={{padding: '10px'}}>
                              <option value="">Select points</option>
                              {getLangOptions(lang2Test, 'Speaking').map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                            </select>
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{fontSize: '0.85rem', color: '#064E3B'}}>Reading *</label>
                            <select className="form-select" value={lang2R} onChange={e => setLang2R(e.target.value)} style={{padding: '10px'}}>
                              <option value="">Select points</option>
                              {getLangOptions(lang2Test, 'Reading').map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                            </select>
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{fontSize: '0.85rem', color: '#064E3B'}}>Writing *</label>
                            <select className="form-select" value={lang2W} onChange={e => setLang2W(e.target.value)} style={{padding: '10px'}}>
                              <option value="">Select points</option>
                              {getLangOptions(lang2Test, 'Writing').map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              )}

              {/* Step 6: Work */}
              {currentStep.id === 'work' && (
                <div style={{ animation: 'fadeInUp 0.3s ease-out' }}>
                  <div className="form-group" style={{ marginBottom: canadianWork !== '' ? '24px' : '32px' }}>
                    <label className="form-label" style={{ fontSize: '1rem', color: '#374151', marginBottom: '8px', fontWeight: 500 }}>
                      In the last 10 years, how many years of paid skilled work experience do you have in Canada? <span style={{ color: '#DC2626' }}>*</span>
                    </label>
                    <p style={{ fontSize: '0.9rem', color: '#6B7280', marginBottom: '4px' }}>Work experience does not need to be related to your field of study and may fall under different NOC categories.</p>
                    <p style={{ fontSize: '0.9rem', color: '#9CA3AF', fontStyle: 'italic', marginBottom: '16px' }}>(Please do not include self-employment or experience you gained while you were a full-time student in Canada.)</p>
                    
                    <select className="form-select" value={canadianWork} onChange={e => setCanadianWork(e.target.value)} style={{ padding: '12px', fontSize: '0.95rem', borderColor: '#D1D5DB' }}>
                      <option value="">Select</option>
                      <option value="None or less than a year">None or less than a year</option>
                      <option value="1 year">1 year</option>
                      <option value="2 years">2 years</option>
                      <option value="3 years">3 years</option>
                      <option value="4 years">4 years</option>
                      <option value="5 years or more">5 years or more</option>
                    </select>
                  </div>

                  {canadianWork === 'None or less than a year' && (
                    <div style={{ background: '#FAF5FF', border: '1px solid #F3E8FF', padding: '16px', borderRadius: '4px', marginBottom: '24px', animation: 'fadeInUp 0.2s ease-out' }}>
                      <span style={{ fontSize: '0.85rem', color: '#7E22CE' }}>
                        <strong>Eligibility Tip:</strong> If you do not have at least one year of skilled, paid, full-time (or equivalent part-time) Canadian work experience, then at least one year of your foreign work experience must be continuous and in the same NOC code.
                      </span>
                    </div>
                  )}

                  {canadianWork !== '' && canadianWork !== 'None or less than a year' && (
                    <div style={{ background: '#FAF5FF', border: '1px solid #F3E8FF', padding: '16px 20px', borderRadius: '4px', marginBottom: '24px', animation: 'fadeInUp 0.2s ease-out' }}>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#7E22CE', marginBottom: '8px' }}>Hours Calculation:</h4>
                      <ul style={{ fontSize: '0.8rem', color: '#6B7280', margin: 0, paddingLeft: '20px', lineHeight: 1.6, listStyleType: 'disc' }}>
                        <li>Working thirty hours per week for 12 months equates to one year of full-time work, totaling 1,560 hours.</li>
                        <li>If you work fifteen hours per week for twenty-four months, it also corresponds to one year of full-time work, comprising 1,560 hours.</li>
                        <li>You have the flexibility to hold as many part-time jobs as necessary to fulfill this requirement.</li>
                        <li>If you work thirty hours per week for twelve months but across multiple jobs, it still amounts to one year of full-time employment, equaling 1,560 hours.</li>
                        <li>Any hours worked beyond thirty hours per week will not be considered towards meeting this requirement.</li>
                      </ul>
                    </div>
                  )}

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '1rem', color: '#374151', marginBottom: '12px', fontWeight: 500 }}>
                      In the last 10 years, how many years of foreign (outside Canada) skilled work experience do you have?
                    </label>
                    <select className="form-select" value={foreignWork} onChange={e => setForeignWork(e.target.value)} style={{ padding: '12px', fontSize: '0.95rem', borderColor: '#D1D5DB' }}>
                      <option value="">Select</option>
                      <option value="None or less than a year">None or less than a year</option>
                      <option value="1 year">1 year</option>
                      <option value="2 years">2 years</option>
                      <option value="3 years or more">3 years or more</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Step 7: Additional Factors */}
              {currentStep.id === 'additional' && (
                <div style={{ animation: 'fadeInUp 0.3s ease-out' }}>
                  <div className="form-group" style={{ marginBottom: '32px' }}>
                    <label className="form-label" style={{ fontSize: '1rem', color: '#374151', marginBottom: '12px', fontWeight: 500 }}>
                      Do you or your spouse or common-law partner (if they will accompany you to Canada) have at least one brother or sister living in Canada who is a citizen or permanent resident and who is at least 18 years old?
                    </label>
                    <select className="form-select" value={siblingInCanada} onChange={e => setSiblingInCanada(e.target.value)} style={{ padding: '12px', fontSize: '0.95rem', borderColor: '#D1D5DB' }}>
                      <option value="">Select</option>
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: '32px' }}>
                    <label className="form-label" style={{ fontSize: '1rem', color: '#374151', marginBottom: '12px', fontWeight: 500 }}>
                      Do you have a certificate of qualification from a Canadian province or territory?
                    </label>
                    <select className="form-select" value={certOfQualification} onChange={e => setCertOfQualification(e.target.value)} style={{ padding: '12px', fontSize: '0.95rem', borderColor: '#F97316' }}>
                      <option value="">Select</option>
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                    {certOfQualification === 'No' && (
                      <div style={{ background: '#FFF7ED', padding: '12px 16px', borderRadius: '4px', marginTop: '12px', animation: 'fadeInUp 0.2s ease-out' }}>
                        <span style={{ fontSize: '0.85rem', color: '#9A3412' }}>
                          <strong>Definition:</strong> A certificate of qualification shows that a person is qualified to work in a particular skilled trade in Canada. This means they passed a certification test and meet all the requirements to do their job in that province or territory.
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="form-group" style={{ marginBottom: '0' }}>
                    <label className="form-label" style={{ fontSize: '1rem', color: '#374151', marginBottom: '12px', fontWeight: 500 }}>
                      Do you have a nomination certificate from a province or territory?
                    </label>
                    <select className="form-select" value={provincialNom} onChange={e => setProvincialNom(e.target.value)} style={{ padding: '12px', fontSize: '0.95rem', borderColor: '#F97316' }}>
                      <option value="">Select</option>
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                    <div style={{ background: '#FFF7ED', padding: '12px 16px', borderRadius: '4px', marginTop: '12px' }}>
                      <span style={{ fontSize: '0.85rem', color: '#9A3412' }}>
                        <strong>Note:</strong> A provincial nomination certificate is issued by a Canadian province or territory through their Provincial Nominee Program (PNP). This gives you 600 additional points and virtually guarantees an invitation to apply.
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 8: Spouse Factors */}
              {currentStep.id === 'spouse_factors' && (
                <div style={{ animation: 'fadeInUp 0.3s ease-out' }}>
                  
                  <div className="form-group" style={{ marginBottom: '32px' }}>
                    <label className="form-label" style={{ fontSize: '1rem', color: '#374151', marginBottom: '12px', fontWeight: 500 }}>
                      What is the highest level of education for which your spouse or common-law partner has?
                    </label>
                    <select className="form-select" value={spouseEducation} onChange={e => setSpouseEducation(e.target.value)} style={{ padding: '12px', fontSize: '0.95rem', borderColor: '#D1D5DB' }}>
                      <option value="">Select</option>
                      <option value="none">None, or less than secondary (high school)</option>
                      <option value="secondary">Secondary diploma (high school graduation)</option>
                      <option value="one-year">One-year program at a university, college, trade or technical school, or other institute</option>
                      <option value="two-year">Two-year program at a university, college, trade or technical school, or other institute</option>
                      <option value="bachelors">Bachelor's degree OR a three or more year program at a university, college, trade or technical school, or other institute</option>
                      <option value="two-or-more">Two or more certificates, diplomas, or degrees. One must be for a program of three or more years</option>
                      <option value="masters">Master's degree, OR professional degree needed to practice in a licensed profession (e.g., MD, DDS, DVM, LLB, JD, OD)</option>
                      <option value="doctoral">Doctoral level university degree (PhD)</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: spouseCanadianWork !== '' && spouseCanadianWork !== 'None or less than a year' ? '24px' : '32px' }}>
                    <label className="form-label" style={{ fontSize: '1rem', color: '#374151', marginBottom: '8px', fontWeight: 500 }}>
                      In the last 10 years, how many years of paid skilled work experience does your spouse or common-law partner have in Canada?
                    </label>
                    <p style={{ fontSize: '0.9rem', color: '#6B7280', marginBottom: '4px' }}>Work experience does not need to be related to their field of study and may fall under different NOC categories.</p>
                    <p style={{ fontSize: '0.9rem', color: '#9CA3AF', fontStyle: 'italic', marginBottom: '16px' }}>(Please do not include self-employment or experience they gained while a full-time student in Canada.)</p>
                    <select className="form-select" value={spouseCanadianWork} onChange={e => setSpouseCanadianWork(e.target.value)} style={{ padding: '12px', fontSize: '0.95rem', borderColor: '#D1D5DB' }}>
                      <option value="">Select</option>
                      <option value="None or less than a year">None or less than a year</option>
                      <option value="1 year">1 year</option>
                      <option value="2 years">2 years</option>
                      <option value="3 years">3 years</option>
                      <option value="4 years">4 years</option>
                      <option value="5 years or more">5 years or more</option>
                    </select>
                  </div>

                  {spouseCanadianWork !== '' && spouseCanadianWork !== 'None or less than a year' && (
                    <div style={{ background: '#FAF5FF', border: '1px solid #F3E8FF', padding: '16px 20px', borderRadius: '4px', marginBottom: '32px', animation: 'fadeInUp 0.2s ease-out' }}>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#7E22CE', marginBottom: '8px' }}>Hours Calculation:</h4>
                      <ul style={{ fontSize: '0.8rem', color: '#6B7280', margin: 0, paddingLeft: '20px', lineHeight: 1.6, listStyleType: 'disc' }}>
                        <li>Working thirty hours per week for 12 months equates to one year of full-time work, totaling 1,560 hours.</li>
                        <li>If you work fifteen hours per week for twenty-four months, it also corresponds to one year of full-time work, comprising 1,560 hours.</li>
                        <li>You have the flexibility to hold as many part-time jobs as necessary to fulfill this requirement.</li>
                        <li>If you work thirty hours per week for twelve months but across multiple jobs, it still amounts to one year of full-time employment, equaling 1,560 hours.</li>
                        <li>Any hours worked beyond thirty hours per week will not be considered towards meeting this requirement.</li>
                      </ul>
                    </div>
                  )}

                  <div className="form-group" style={{ marginBottom: spLangTest !== 'None / Not Applicable' ? '24px' : '0' }}>
                    <label className="form-label" style={{ fontSize: '1rem', color: '#374151', marginBottom: '12px', fontWeight: 500 }}>
                      Which language test have your spouse or common-law partner taken, or planning to take? <span style={{ color: '#DC2626' }}>*</span>
                    </label>
                    <select className="form-select" value={spLangTest} onChange={e => {
                      setSpLangTest(e.target.value);
                      if (e.target.value === 'None / Not Applicable') {
                        setSpR(''); setSpW(''); setSpL(''); setSpS('');
                      } else {
                        setSpR('10-12'); setSpW('10-12'); setSpL('10-12'); setSpS('9');
                      }
                    }} style={{ padding: '12px', fontSize: '0.95rem', borderColor: '#22C55E' }}>
                      <option value="None / Not Applicable">None / Not Applicable</option>
                      <option value="CELPIP-General (English)">CELPIP-General (English)</option>
                      <option value="IELTS General Training (English)">IELTS General Training (English)</option>
                      <option value="PTE Core (English)">PTE Core (English)</option>
                      <option value="TEF Canada (French)">TEF Canada (French)</option>
                      <option value="TCF Canada (French)">TCF Canada (French)</option>
                    </select>
                  </div>

                  <div style={{ background: '#F0FDF4', border: '1px solid #DCFCE7', padding: '16px 20px', borderRadius: '4px', marginBottom: '24px' }}>
                    <span style={{ fontSize: '0.85rem', color: '#166534', display: 'block', marginBottom: '8px' }}>
                      <strong>Canada's Official Languages:</strong> English and French are Canada's official languages. Applicants must submit language test results that are less than two years old at the time of application.
                    </span>
                    <span style={{ fontSize: '0.85rem', color: '#166534', display: 'block' }}>
                      <strong>Test Selection:</strong> Choose the approved language test you have taken or plan to take, and enter your scores (actual or estimated).
                    </span>
                  </div>

                  {spLangTest !== 'None / Not Applicable' && (
                    <div style={{ animation: 'fadeInUp 0.3s ease-out' }}>
                      <h5 style={{ fontSize: '0.95rem', color: '#166534', fontWeight: 700, marginBottom: '12px' }}>Language Scores</h5>
                      <div className="crs-grid">
                        <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label" style={{fontSize: '0.85rem', color: '#14532D'}}>Listening *</label><select className="form-select" value={spL} onChange={e => setSpL(e.target.value)} style={{padding: '10px', borderColor: '#86EFAC'}}>{['10-12','9','8','7','6','5','4','< 4'].map(n => <option key={n} value={n}>{n}</option>)}</select></div>
                        <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label" style={{fontSize: '0.85rem', color: '#14532D'}}>Speaking *</label><select className="form-select" value={spS} onChange={e => setSpS(e.target.value)} style={{padding: '10px', borderColor: '#86EFAC'}}>{['10-12','9','8','7','6','5','4','< 4'].map(n => <option key={n} value={n}>{n}</option>)}</select></div>
                        <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label" style={{fontSize: '0.85rem', color: '#14532D'}}>Reading *</label><select className="form-select" value={spR} onChange={e => setSpR(e.target.value)} style={{padding: '10px', borderColor: '#86EFAC'}}>{['10-12','9','8','7','6','5','4','< 4'].map(n => <option key={n} value={n}>{n}</option>)}</select></div>
                        <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label" style={{fontSize: '0.85rem', color: '#14532D'}}>Writing *</label><select className="form-select" value={spW} onChange={e => setSpW(e.target.value)} style={{padding: '10px', borderColor: '#86EFAC'}}>{['10-12','9','8','7','6','5','4','< 4'].map(n => <option key={n} value={n}>{n}</option>)}</select></div>
                      </div>
                    </div>
                  )}

                </div>
              )}

              {/* Final Step: Results */}
              {currentStep.id === 'results' && (
                <div style={{ animation: 'fadeIn 0.5s ease-out', margin: '-32px' }}>
                  
                  <div className="page-hero" style={{ margin: '-32px -32px 0 -32px', padding: '64px 24px' }}>
                    <div className="page-hero-content">
                      <div style={{ 
                        width: '140px', height: '140px', 
                        background: 'white', border: '6px solid var(--border-color, #E2E8F0)', borderRadius: '50%', 
                        display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', 
                        margin: '0 auto', boxShadow: '0 8px 24px rgba(0, 0, 0, 0.06)' 
                      }}>
                        <div style={{ fontSize: '3rem', fontWeight: 900, color: '#0F172A', lineHeight: 1, letterSpacing: '-1px' }}>{score.total}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '1px' }}>Points</div>
                      </div>
                      <h1 style={{ marginTop: '24px' }}>Your CRS Score is <span style={{ color: 'var(--primary-color)' }}>{score.total}</span></h1>
                      <p>Comprehensive Ranking System score breakdown based on your profile.</p>
                      <button 
                        onClick={() => {
                          setCurrentStepIndex(0);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }} 
                        className="btn-primary"
                        style={{ marginTop: '16px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                      >
                        <span>✏️</span> Edit Answers
                      </button>
                    </div>
                  </div>

                  {/* Score Breakdown Grid */}
                  <div style={{ padding: '40px 32px' }}>
                    <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#0F172A', marginBottom: '20px' }}>Score Breakdown</h3>
                    
                    <div className="crs-grid">
                      
                      {/* Core */}
                      <div className="info-card" style={{ padding: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>Core/Human capital factors</h4>
                          <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary-color)' }}>{score.breakdown.core.subtotal}</span>
                        </div>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.85rem', color: '#475569', lineHeight: 1.8 }}>
                          <li>Age = {score.breakdown.core.age}</li>
                          <li>Level of education = {score.breakdown.core.education}</li>
                          <li>Official Languages = {score.breakdown.core.officialLanguages}
                            <ul style={{ listStyle: 'none', paddingLeft: '12px', margin: '2px 0', color: 'var(--text-muted)' }}>
                              <li>• First Official Language = {score.breakdown.core.firstOfficialLanguage}</li>
                              <li>• Second Official Language = {score.breakdown.core.secondOfficialLanguage}</li>
                            </ul>
                          </li>
                          <li>Canadian work experience = {score.breakdown.core.canadianWorkExperience}</li>
                          <li style={{ marginTop: '12px', fontWeight: 700, color: '#0F172A', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>Subtotal = {score.breakdown.core.subtotal}</li>
                        </ul>
                      </div>

                      {/* Spouse */}
                      <div className="info-card" style={{ padding: '20px', opacity: hasSpouseForMath ? 1 : 0.5 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>Spouse factors</h4>
                          <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary-color)' }}>{score.breakdown.spouse.subtotal}</span>
                        </div>
                        {hasSpouseForMath ? (
                          <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.85rem', color: '#475569', lineHeight: 1.8 }}>
                            <li>Level of education = {score.breakdown.spouse.education}</li>
                            <li>First Official Languages = {score.breakdown.spouse.firstOfficialLanguages}</li>
                            <li>Canadian work experience = {score.breakdown.spouse.canadianWorkExperience}</li>
                            <li style={{ marginTop: '12px', fontWeight: 700, color: '#0F172A', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>Subtotal = {score.breakdown.spouse.subtotal}</li>
                          </ul>
                        ) : (
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Not applicable (Single applicant)</div>
                        )}
                      </div>

                      {/* Transferability */}
                      <div className="info-card" style={{ padding: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>Skill transferability factors</h4>
                          <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary-color)' }}>{score.breakdown.transferability.subtotal}</span>
                        </div>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.85rem', color: '#475569', lineHeight: 1.6 }}>
                          <li style={{ fontWeight: 600, marginBottom: '4px', color: '#0F172A' }}>Education (max 50 pts)</li>
                          <ul style={{ listStyle: 'none', paddingLeft: '8px', margin: '2px 0 8px 0', color: 'var(--text-muted)' }}>
                            <li>A) Language + education = {score.breakdown.transferability.education.languageAndEducation}</li>
                            <li>B) Canadian work + education = {score.breakdown.transferability.education.canadianWorkAndEducation}</li>
                            <li style={{ fontStyle: 'italic', marginTop: '4px' }}>Subtotal = {score.breakdown.transferability.education.subtotal}</li>
                          </ul>
                          <li style={{ fontWeight: 600, marginBottom: '4px', marginTop: '8px', color: '#0F172A' }}>Foreign work (max 50 pts)</li>
                          <ul style={{ listStyle: 'none', paddingLeft: '8px', margin: '2px 0 8px 0', color: 'var(--text-muted)' }}>
                            <li>A) Language + foreign work = {score.breakdown.transferability.foreignWork.languageAndForeignWork}</li>
                            <li>B) Canadian + foreign work = {score.breakdown.transferability.foreignWork.canadianAndForeignWork}</li>
                            <li style={{ fontStyle: 'italic', marginTop: '4px' }}>Subtotal = {score.breakdown.transferability.foreignWork.subtotal}</li>
                          </ul>
                          <li>Certificate of qualification = {score.breakdown.transferability.certificateOfQualification}</li>
                          <li style={{ marginTop: '12px', fontWeight: 700, color: '#0F172A', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>Subtotal = {score.breakdown.transferability.subtotal}</li>
                        </ul>
                      </div>

                      {/* Additional */}
                      <div className="info-card" style={{ padding: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>Additional points (max 600 pts)</h4>
                          <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary-color)' }}>{score.breakdown.additional.subtotal}</span>
                        </div>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.85rem', color: '#475569', lineHeight: 1.8 }}>
                          <li>Provincial nomination = {score.breakdown.additional.provincialNomination}</li>
                          <li>Study in Canada = {score.breakdown.additional.studyInCanada}</li>
                          <li>Sibling in Canada = {score.breakdown.additional.siblingInCanada}</li>
                          <li>French-language skills = {score.breakdown.additional.frenchLanguageSkills}</li>
                          <li style={{ marginTop: '12px', fontWeight: 700, color: '#0F172A', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>Subtotal = {score.breakdown.additional.subtotal}</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* Navigation Buttons specifically formatted to match screenshot */}
              {!isFinalStep && (
                <div style={{ marginTop: '48px', paddingTop: '24px', borderTop: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between' }}>
                  {currentStepIndex > 0 ? (
                    <button 
                      onClick={() => goToStep(currentStepIndex - 1)}
                      style={{ padding: '10px 20px', background: '#F3F4F6', border: 'none', borderRadius: '6px', color: '#4B5563', fontWeight: 600, cursor: 'pointer', fontSize: '0.95rem' }}
                    >
                      ← Previous
                    </button>
                  ) : <div></div>}
                  
                  <button 
                    onClick={() => canAdvance() && goToStep(currentStepIndex + 1)}
                    disabled={!canAdvance()}
                    style={{ 
                      padding: '10px 24px', 
                      background: 'var(--primary-color, #2563EB)', 
                      border: 'none', 
                      borderRadius: '6px', 
                      color: 'white', 
                      fontWeight: 600, 
                      cursor: canAdvance() ? 'pointer' : 'not-allowed', 
                      fontSize: '0.95rem',
                      opacity: canAdvance() ? 1 : 0.5,
                      transition: 'opacity 0.2s'
                    }}
                  >
                    Next →
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* Bottom Fixed Progress Bar */}
        <div className="crs-bottom-bar">
          <div className="crs-progress-text">Form Progress</div>
          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="crs-progress-text" style={{ textAlign: 'right' }}>{progressPercent}% Complete</div>
        </div>

      </div>
      <style>{`
        .crs-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .crs-main-layout {
          display: flex;
          gap: 32px;
          align-items: flex-start;
        }
        .crs-mobile-step {
          display: none;
          font-size: 0.85rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--primary-color);
          font-weight: 700;
        }
        @media (max-width: 640px) {
          .crs-grid {
            grid-template-columns: 1fr;
          }
          .crs-main-layout {
            flex-direction: column;
          }
          .crs-sidebar {
            display: none !important;
          }
          .crs-mobile-step {
            display: block;
          }
          .info-card {
            padding: 16px !important;
          }
        }
      `}</style>
    </div>
  );
};
