import { type FC, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SEO } from './common/SEO';
import { cn } from '../lib/utils';
import {
  getAgePoints, getEducationPoints, getLanguageAbilityPoints,
  getSpouseLanguagePoints, getSecondLanguagePoints, getSpouseEducationPoints,
  getSpouseCanadianWorkPoints, getCanadianWorkPoints, extractCLB, getLangOptions
} from '../lib/crs-math';

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

const OptionCard = ({ selected, onClick, title, description, icon }: { selected: boolean, onClick: () => void, title: string, description?: string, icon?: string }) => (
  <div
    onClick={onClick}
    className={cn(
      "cursor-pointer p-4 rounded-xl border transition-all duration-200 flex flex-col gap-2 backdrop-blur-sm",
      selected ? "border-primary bg-primary/5 shadow-[0_0_15px_rgba(37,99,235,0.15)] transform scale-[1.02]" : "border-gray-200 bg-white/60 hover:border-primary/30 hover:bg-white/90"
    )}
  >
    <div className="flex items-center gap-3">
      {icon && <span className="text-2xl">{icon}</span>}
      <span className={cn("font-semibold text-[0.95rem]", selected ? "text-primary-dark" : "text-gray-700")}>{title}</span>
    </div>
    {description && <p className="text-sm text-gray-500">{description}</p>}
  </div>
);

export const CRSCalculatorPage: FC<CRSCalculatorPageProps> = () => {
  // Phase 1: Personal
  const [age, setAge] = useState<number | ''>('');
  const [maritalStatus, setMaritalStatus] = useState<string>('');
  const [spouseIsPR, setSpouseIsPR] = useState<string>('');
  const [spouseAccompanying, setSpouseAccompanying] = useState<string>('');

  const isMarriedObj = maritalStatus === 'Married' || maritalStatus === 'Common-Law';
  const hasSpouseForMath = isMarriedObj && spouseIsPR === 'No' && spouseAccompanying === 'Yes';
  
  // Phase 2: Education & Language
  const [education, setEducation] = useState('');
  const [hasCanadianEducation, setHasCanadianEducation] = useState('');
  const [canadianEducation, setCanadianEducation] = useState('');

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

  // Phase 3: Work & Additional
  const [canadianWork, setCanadianWork] = useState('');
  const [foreignWork, setForeignWork] = useState('');
  const [provincialNom, setProvincialNom] = useState('');
  const [siblingInCanada, setSiblingInCanada] = useState('');
  const [certOfQualification, setCertOfQualification] = useState('');
  
  // Phase 4: Spouse
  const [spouseEducation, setSpouseEducation] = useState('');
  const [spLangTest, setSpLangTest] = useState('None / Not Applicable');
  const [spR, setSpR] = useState('');
  const [spW, setSpW] = useState('');
  const [spL, setSpL] = useState('');
  const [spS, setSpS] = useState('');
  const [spouseCanadianWork, setSpouseCanadianWork] = useState('');
  
  // Score Derivation
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
    if (hasCanadianEducation === 'Yes' && canadianEducation === 'one-two') additional += 15;
    if (hasCanadianEducation === 'Yes' && canadianEducation === 'three-plus') additional += 30;
    
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
    const studyCanPoints = (hasCanadianEducation === 'Yes' && canadianEducation === 'one-two') ? 15 : (hasCanadianEducation === 'Yes' && canadianEducation === 'three-plus') ? 30 : 0;

    const breakdown = {
      core: { age: agePoints, education: eduPoints, officialLanguages: officialLanguagesPoints, firstOfficialLanguage: firstLangPoints, secondOfficialLanguage: secondLangPoints, canadianWorkExperience: canWorkPoints, subtotal: coreTotal },
      spouse: { education: spEduPoints, firstOfficialLanguages: spLangPoints, canadianWorkExperience: spWorkPoints, subtotal: spouseTotal },
      transferability: { education: { languageAndEducation: transEduLang, canadianWorkAndEducation: transEduCanWork, subtotal: transferabilityEdu }, foreignWork: { languageAndForeignWork: transForLang, canadianAndForeignWork: transForCanWork, subtotal: transferabilityForeign }, certificateOfQualification: transCert, subtotal: transferability },
      additional: { provincialNomination: provNomPoints, studyInCanada: studyCanPoints, siblingInCanada: siblingPoints, frenchLanguageSkills: frenchBonusPoints, subtotal: additional }
    };

    return {
      core: coreTotal, spouse: spouseTotal, transferability, additional,
      total: coreTotal + spouseTotal + transferability + additional,
      breakdown
    };
  }, [age, education, canadianWork, foreignWork, hasSpouseForMath, clbReading, clbWriting, clbListening, clbSpeaking, spouseEducation, spR, spW, spL, spS, spouseCanadianWork, provincialNom, canadianEducation, hasCanadianEducation, lang1Test, lang2Test, lang2R, lang2W, lang2L, lang2S, siblingInCanada, certOfQualification]);

  // Phase Definitions
  const phases = [
    { id: 'personal', title: 'Personal', icon: '👤' },
    { id: 'education_lang', title: 'Education & Language', icon: '🎓' },
    { id: 'work_extra', title: 'Work & Additional', icon: '💼' },
    ...(hasSpouseForMath ? [{ id: 'spouse', title: 'Spouse Factors', icon: '💗' }] : []),
    { id: 'results', title: 'Summary', icon: '📊' }
  ];

  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  
  // Validation Logic grouped by Phase
  const canAdvance = () => {
    const p = phases[currentPhaseIndex];
    if (p.id === 'personal') {
      if (age === '' || maritalStatus === '') return false;
      if (isMarriedObj && spouseIsPR === '') return false;
      if (isMarriedObj && spouseIsPR === 'No' && spouseAccompanying === '') return false;
      return true;
    }
    if (p.id === 'education_lang') {
      if (education === '' || hasCanadianEducation === '') return false;
      if (hasCanadianEducation === 'Yes' && canadianEducation === '') return false;
      if (lang1Test === '' || lang1R === '' || lang1W === '' || lang1L === '' || lang1S === '') return false;
      if (lang2Test !== 'None / Not Applicable' && (lang2R === '' || lang2W === '' || lang2L === '' || lang2S === '')) return false;
      return true;
    }
    if (p.id === 'work_extra') {
      if (canadianWork === '' || foreignWork === '') return false;
      if (provincialNom === '' || siblingInCanada === '' || certOfQualification === '') return false;
      return true;
    }
    if (p.id === 'spouse') {
      if (spouseEducation === '' || spouseCanadianWork === '') return false;
      if (spLangTest !== 'None / Not Applicable' && (spR === '' || spW === '' || spL === '' || spS === '')) return false;
      return true;
    }
    return true;
  };

  const handleNext = () => {
    if (canAdvance() && currentPhaseIndex < phases.length - 1) {
      setCurrentPhaseIndex(i => i + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    if (currentPhaseIndex > 0) {
      setCurrentPhaseIndex(i => i - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const p = phases[currentPhaseIndex];
  const isResults = p.id === 'results';

  return (
    <div className="min-h-screen font-sans pb-24 text-gray-800">
      <SEO 
        title="Canada CRS Calculator 2026 | Express Entry Points Estimator" 
        description="Calculate your Comprehensive Ranking System (CRS) score for Canadian Express Entry. Get an accurate points estimate for the Canadian Experience Class."
        keywords="CRS calculator, Express Entry points, Canada PR score, CEC eligibility"
        canonical="/crs-calculator"
        schema={crsSchema}
      />
      
      {/* Top Progress & Score Bar - Floating and Modern */}
      <div className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex gap-2 items-center text-sm font-semibold text-gray-500 hidden sm:flex">
             {phases.map((sec, idx) => (
                <div key={sec.id} className="flex items-center gap-2">
                  <span className={cn("flex items-center justify-center w-6 h-6 rounded-full text-xs text-white", idx <= currentPhaseIndex ? "bg-primary" : "bg-gray-300")}>{idx + 1}</span>
                  <span className={cn(idx <= currentPhaseIndex ? "text-gray-900" : "")}>{sec.title}</span>
                  {idx < phases.length - 1 && <span className="text-gray-300 mx-1">/</span>}
                </div>
             ))}
          </div>
          {/* Live Score Always Visible */}
          <div className="flex items-center gap-3 ml-auto">
            <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Live CRS Score</span>
            <div className="bg-primary/10 text-primary-dark rounded-full px-4 py-1 font-bold text-2xl border border-primary/20 shadow-sm transition-all">
              <motion.span key={score.total} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="inline-block">
                {score.total}
              </motion.span>
            </div>
          </div>
        </div>
        {/* Progress Line */}
        <div className="h-1 bg-gray-100 w-full">
          <motion.div 
            className="h-full bg-primary" 
            initial={{ width: 0 }}
            animate={{ width: `${((currentPhaseIndex + 1) / phases.length) * 100}%` }}
            transition={{ ease: "easeInOut", duration: 0.3 }}
          />
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-3xl mx-auto px-6 pt-10 pb-16">
        <AnimatePresence mode="wait">
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="bg-white/80 backdrop-blur-2xl p-8 sm:p-10 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/40"
          >
            
            {!isResults && (
              <div className="mb-8 border-b border-gray-100 pb-4">
                <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
                  <span>{p.icon}</span> {p.title}
                </h1>
                <p className="text-gray-500 mt-2">Answer the questions below to update your score estimation.</p>
              </div>
            )}

            {/* PHASE 1: PERSONAL */}
            {p.id === 'personal' && (
              <div className="space-y-8">
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-3">How old are you? <span className="text-red-500">*</span></label>
                  <select 
                    className="w-full p-4 bg-white/60 backdrop-blur-sm border border-white/60 shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all appearance-none text-gray-800 rounded-xl"
                    value={age} onChange={e => setAge(e.target.value === '' ? '' : +e.target.value)}
                  >
                    <option value="">Select your age</option>
                    <option value={17}>17 years or less</option>
                    {Array.from({ length: 27 }, (_, i) => i + 18).map(n => <option key={n} value={n}>{n} years</option>)}
                    <option value={45}>45 years or more</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-3">What is your marital status? <span className="text-red-500">*</span></label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {['Never Married / Single', 'Married', 'Common-Law', 'Divorced / Separated', 'Widowed'].map(status => (
                      <OptionCard 
                        key={status} title={status} 
                        selected={maritalStatus === status} 
                        onClick={() => { setMaritalStatus(status); setSpouseIsPR(''); setSpouseAccompanying(''); }} 
                      />
                    ))}
                  </div>
                </div>

                {isMarriedObj && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-8 pt-4 border-t border-gray-100">
                    <div>
                      <label className="block text-sm font-semibold text-gray-800 mb-3">Is your spouse/partner a PR or Citizen of Canada?</label>
                      <div className="flex gap-4">
                        <OptionCard title="Yes" selected={spouseIsPR === 'Yes'} onClick={() => { setSpouseIsPR('Yes'); setSpouseAccompanying(''); }} />
                        <OptionCard title="No" selected={spouseIsPR === 'No'} onClick={() => setSpouseIsPR('No')} />
                      </div>
                    </div>

                    {spouseIsPR === 'No' && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <label className="block text-sm font-semibold text-gray-800 mb-3">Will your spouse/partner come with you to Canada?</label>
                        <div className="flex gap-4">
                          <OptionCard title="Yes" selected={spouseAccompanying === 'Yes'} onClick={() => setSpouseAccompanying('Yes')} />
                          <OptionCard title="No" selected={spouseAccompanying === 'No'} onClick={() => setSpouseAccompanying('No')} />
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </div>
            )}

            {/* PHASE 2: EDUCATION & LANGUAGE */}
            {p.id === 'education_lang' && (
              <div className="space-y-10">
                <div className="space-y-6">
                  <h3 className="text-xl font-bold text-gray-900">Education Background</h3>
                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-3">Highest level of education? <span className="text-red-500">*</span></label>
                    <select className="w-full p-4 bg-white/60 backdrop-blur-md border border-white/60 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary/50 text-slate-800" value={education} onChange={e => setEducation(e.target.value)}>
                      <option value="">Select level...</option>
                      <option value="none">None, or less than secondary</option>
                      <option value="secondary">Secondary diploma (high school)</option>
                      <option value="one-year">One-year program</option>
                      <option value="two-year">Two-year program</option>
                      <option value="bachelors">Bachelor's degree (3 or more years)</option>
                      <option value="two-or-more">Two or more certificates/degrees</option>
                      <option value="masters">Master's degree or professional degree</option>
                      <option value="doctoral">Doctoral level (PhD)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-3">Do you have a Canadian degree/diploma? <span className="text-red-500">*</span></label>
                    <div className="flex gap-4">
                      <OptionCard title="Yes" selected={hasCanadianEducation === 'Yes'} onClick={() => setHasCanadianEducation('Yes')} />
                      <OptionCard title="No" selected={hasCanadianEducation === 'No'} onClick={() => { setHasCanadianEducation('No'); setCanadianEducation(''); }} />
                    </div>
                  </div>

                  {hasCanadianEducation === 'Yes' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-orange-50 border-l-4 border-orange-500 p-6 rounded-r-xl shadow-sm text-orange-900 text-sm space-y-3">
                      <h4 className="font-bold text-orange-800 text-base">To confirm eligibility, please ensure the following criteria are met:</h4>
                      <ul className="list-disc pl-5 space-y-2 text-orange-900/90 text-[0.9rem] leading-relaxed">
                        <li>Your program of study must qualify for a post-graduation work permit.</li>
                        <li>Courses in English or French as a Second Language should constitute less than half of your curriculum.</li>
                        <li>Your education must not have been funded by a scholarship or grant that obligates you to apply your skills and knowledge in your home country post-graduation.</li>
                        <li>Your institution of study must be located within Canada; studies at international branch campuses do not qualify.</li>
                        <li>You must have been enrolled as a full-time student for a minimum of eight months, with the exception of those who completed their studies or training (either in full or partially) between March 2020 and August 2022.</li>
                        <li>A physical presence in Canada for at least eight months is required, unless your study or training completion (whole or part) falls between March 2020 and August 2022.</li>
                      </ul>
                      <div className="pt-4 mt-4 border-t border-orange-200/50">
                        <label className="block font-semibold text-orange-900 mb-2">Describe your Canadian education:</label>
                        <select className="w-full p-3 bg-white border border-orange-200 rounded-lg text-sm text-orange-900 focus:ring-2 focus:ring-orange-400" value={canadianEducation} onChange={e => setCanadianEducation(e.target.value)}>
                          <option value="">Select type...</option>
                          <option value="one-two">1 or 2-year diploma or certificate</option>
                          <option value="three-plus">Degree/diploma of 3+ years, Master's, or PhD</option>
                        </select>
                      </div>
                    </motion.div>
                  )}
                </div>

                <div className="space-y-6 pt-6 border-t border-gray-100">
                  <h3 className="text-xl font-bold text-gray-900">Language Tests</h3>

                  <div className="bg-[#f0fdf4] border-t-2 border-[#22c55e] p-5 rounded-b-xl text-[#14532d] text-[0.95rem] space-y-3 shadow-sm mb-6">
                    <p><strong className="text-[#15803d]">Canada's Official Languages:</strong> English and French are Canada's official languages. Applicants must submit language test results that are less than two years old at the time of application.</p>
                    <p><strong className="text-[#15803d]">Test Selection:</strong> Choose the approved language test you have taken or plan to take, and enter your scores (actual or estimated).</p>
                  </div>
                  
                  <div className="p-6 rounded-2xl border-2 border-blue-100 bg-blue-50/30">
                    <h4 className="font-bold text-blue-900 flex items-center gap-2 mb-4"><span className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center">1</span> Primary Language Test</h4>
                    
                    <select className="w-full p-4 mb-6 bg-white border border-blue-200 rounded-xl" value={lang1Test} onChange={e => {
                        setLang1Test(e.target.value);
                        setLang1L(''); setLang1S(''); setLang1R(''); setLang1W('');
                        if (e.target.value.includes('English') && lang2Test.includes('English')) setLang2Test('None / Not Applicable');
                        if (e.target.value.includes('French') && lang2Test.includes('French')) setLang2Test('None / Not Applicable');
                      }}>
                      <option value="">Select primary test...</option>
                      <option value="CELPIP-General (English)">CELPIP-General (English)</option>
                      <option value="IELTS General Training (English)">IELTS General Training (English)</option>
                      <option value="PTE Core (English)">PTE Core (English)</option>
                      <option value="TEF Canada (French)">TEF Canada (French)</option>
                      <option value="TCF Canada (French)">TCF Canada (French)</option>
                    </select>

                    {lang1Test && (
                      <div className="grid grid-cols-2 gap-4">
                        {['Listening', 'Speaking', 'Reading', 'Writing'].map(skill => (
                          <div key={skill}>
                            <label className="block text-xs font-semibold text-blue-800 mb-1">{skill}</label>
                            <select className="w-full p-2 bg-white border border-blue-200 rounded-lg text-sm" value={skill==='Listening'?lang1L:skill==='Speaking'?lang1S:skill==='Reading'?lang1R:lang1W} onChange={e => {
                              if (skill==='Listening') setLang1L(e.target.value);
                              if (skill==='Speaking') setLang1S(e.target.value);
                              if (skill==='Reading') setLang1R(e.target.value);
                              if (skill==='Writing') setLang1W(e.target.value);
                            }}>
                              <option value="">Score</option>
                              {getLangOptions(lang1Test, skill as any).map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                            </select>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {lang1Test && (
                    <div className="p-6 rounded-2xl border border-gray-200">
                      <h4 className="font-bold text-gray-700 flex items-center gap-2 mb-4"><span className="w-6 h-6 rounded-full bg-gray-200 text-gray-600 text-xs flex items-center justify-center">2</span> Secondary Test (Optional)</h4>
                      <select className="w-full p-4 mb-4 bg-white/60 backdrop-blur-md border border-white/60 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary/50 text-slate-800" value={lang2Test} onChange={e => {
                        setLang2Test(e.target.value);
                        setLang2L(''); setLang2S(''); setLang2R(''); setLang2W('');
                      }}>
                        <option value="None / Not Applicable">None / Not Applicable</option>
                        {!lang1Test.includes('English') && <option value="CELPIP-General (English)">CELPIP-General (English)</option>}
                        {!lang1Test.includes('English') && <option value="IELTS General Training (English)">IELTS General Training (English)</option>}
                        {!lang1Test.includes('English') && <option value="PTE Core (English)">PTE Core (English)</option>}
                        {!lang1Test.includes('French') && <option value="TEF Canada (French)">TEF Canada (French)</option>}
                        {!lang1Test.includes('French') && <option value="TCF Canada (French)">TCF Canada (French)</option>}
                      </select>

                      {lang2Test !== 'None / Not Applicable' && (
                         <div className="grid grid-cols-2 gap-4">
                          {['Listening', 'Speaking', 'Reading', 'Writing'].map(skill => (
                            <div key={skill}>
                              <label className="block text-xs font-semibold text-gray-600 mb-1">{skill}</label>
                              <select className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm" value={skill==='Listening'?lang2L:skill==='Speaking'?lang2S:skill==='Reading'?lang2R:lang2W} onChange={e => {
                                if (skill==='Listening') setLang2L(e.target.value);
                                if (skill==='Speaking') setLang2S(e.target.value);
                                if (skill==='Reading') setLang2R(e.target.value);
                                if (skill==='Writing') setLang2W(e.target.value);
                              }}>
                                <option value="">Score</option>
                                {getLangOptions(lang2Test, skill as any).map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                              </select>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* PHASE 3: WORK & ADDITIONAL */}
            {p.id === 'work_extra' && (
               <div className="space-y-8">
                 <h3 className="text-xl font-bold text-gray-900 border-b border-gray-100 pb-2">Work Experience</h3>
                 
                 <div className="bg-[#faf5ff] border border-[#e9d5ff] p-5 rounded-xl text-[#4c1d95] text-[0.9rem] shadow-sm mb-6">
                    <strong className="text-[#7e22ce] text-base mb-2 block">Hours Calculation:</strong>
                    <ul className="list-disc pl-5 space-y-1.5 text-[#581c87]/80">
                      <li>Working thirty hours per week for 12 months equates to one year of full-time work, totaling 1,560 hours.</li>
                      <li>If you work fifteen hours per week for twenty-four months, it also corresponds to one year of full-time work, comprising 1,560 hours.</li>
                      <li>You have the flexibility to hold as many part-time jobs as necessary to fulfill this requirement.</li>
                      <li>If you work thirty hours per week for twelve months but across multiple jobs, it still amounts to one year of full-time employment, equaling 1,560 hours.</li>
                      <li>Any hours worked beyond thirty hours per week will not be considered towards meeting this requirement.</li>
                    </ul>
                 </div>
                 
                 <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-3">Years of skilled work experience in Canada (NOC TEER 0, 1, 2, or 3)?</label>
                    <select className="w-full p-4 bg-white/60 backdrop-blur-md border border-white/60 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary/50 text-slate-800" value={canadianWork} onChange={e => setCanadianWork(e.target.value)}>
                      <option value="">Select years...</option>
                      <option value="None or less than a year">None or less than a year</option>
                      <option value="1 year">1 year</option>
                      <option value="2 years">2 years</option>
                      <option value="3 years">3 years</option>
                      <option value="4 years">4 years</option>
                      <option value="5 years or more">5 years or more</option>
                    </select>
                 </div>

                 <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-3">Years of foreign skilled work experience (outside Canada)?</label>
                    <select className="w-full p-4 bg-white/60 backdrop-blur-md border border-white/60 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary/50 text-slate-800" value={foreignWork} onChange={e => setForeignWork(e.target.value)}>
                      <option value="">Select years...</option>
                      <option value="None or less than a year">None or less than a year</option>
                      <option value="1 year">1 year</option>
                      <option value="2 years">2 years</option>
                      <option value="3 years or more">3 years or more</option>
                    </select>
                 </div>

                 <h3 className="text-xl font-bold text-gray-900 border-b border-gray-100 pb-2 pt-6">Additional Factors</h3>
                 
                 <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-3">Do you have a certificate of qualification from a Canadian province?</label>
                    <div className="bg-[#fffbeb] border border-[#fde68a] p-4 rounded-xl text-[#92400e] text-[0.9rem] mb-4 shadow-sm">
                      <strong className="text-[#b45309]">Definition:</strong> A certificate of qualification shows that a person is qualified to work in a particular skilled trade in Canada. This means they passed a certification test and meet all the requirements to do their job in that province or territory.
                    </div>
                    <div className="flex gap-4">
                      <OptionCard title="Yes" selected={certOfQualification === 'Yes'} onClick={() => setCertOfQualification('Yes')} />
                      <OptionCard title="No" selected={certOfQualification === 'No'} onClick={() => setCertOfQualification('No')} />
                    </div>
                 </div>

                 <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-3">Do you have a sibling living in Canada who is a citizen or PR?</label>
                    <div className="flex gap-4">
                      <OptionCard title="Yes" selected={siblingInCanada === 'Yes'} onClick={() => setSiblingInCanada('Yes')} />
                      <OptionCard title="No" selected={siblingInCanada === 'No'} onClick={() => setSiblingInCanada('No')} />
                    </div>
                 </div>

                 <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-3">Do you have a valid Provincial Nomination?</label>
                    <div className="bg-[#fffbeb] border border-[#fde68a] p-4 rounded-xl text-[#92400e] text-[0.9rem] mb-4 shadow-sm">
                      <strong className="text-[#b45309]">Note:</strong> A provincial nomination certificate is issued by a Canadian province or territory through their Provincial Nominee Program (PNP). This gives you 600 additional points and virtually guarantees an invitation to apply.
                    </div>
                    <div className="flex gap-4">
                      <OptionCard title="Yes" selected={provincialNom === 'Yes'} onClick={() => setProvincialNom('Yes')} />
                      <OptionCard title="No" selected={provincialNom === 'No'} onClick={() => setProvincialNom('No')} />
                    </div>
                 </div>
               </div>
            )}

            {/* PHASE 4: SPOUSE FACTORS */}
            {p.id === 'spouse' && (
              <div className="space-y-8">
                 <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-3">Spouse's Highest Level of Education</label>
                    <select className="w-full p-4 bg-white/60 backdrop-blur-md border border-white/60 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary/50 text-slate-800" value={spouseEducation} onChange={e => setSpouseEducation(e.target.value)}>
                      <option value="">Select level...</option>
                      <option value="none">None, or less than secondary</option>
                      <option value="secondary">Secondary diploma (high school)</option>
                      <option value="one-year">One-year program</option>
                      <option value="two-year">Two-year program</option>
                      <option value="bachelors">Bachelor's degree or 3+ year program</option>
                      <option value="two-or-more">Two or more certificates (one being 3+ years)</option>
                      <option value="masters">Master's degree or professional degree</option>
                      <option value="doctoral">Doctoral degree</option>
                    </select>
                 </div>

                 <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-3">Spouse's Canadian Work Experience</label>
                    <select className="w-full p-4 bg-white/60 backdrop-blur-md border border-white/60 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary/50 text-slate-800" value={spouseCanadianWork} onChange={e => setSpouseCanadianWork(e.target.value)}>
                      <option value="">Select years...</option>
                      <option value="None or less than a year">None or less than a year</option>
                      <option value="1 year">1 year</option>
                      <option value="2 years">2 years</option>
                      <option value="3 years">3 years</option>
                      <option value="4 years">4 years</option>
                      <option value="5 years or more">5 years or more</option>
                    </select>
                 </div>

                 <div className="p-6 rounded-2xl border-2 border-pink-100 bg-pink-50/30">
                    <h4 className="font-bold text-pink-900 mb-4">Spouse's Language Test</h4>
                    <select className="w-full p-4 mb-6 bg-white border border-pink-200 rounded-xl" value={spLangTest} onChange={e => {
                        setSpLangTest(e.target.value);
                        setSpL(''); setSpS(''); setSpR(''); setSpW('');
                      }}>
                      <option value="None / Not Applicable">None / Not Applicable</option>
                      <option value="CELPIP-General (English)">CELPIP-General (English)</option>
                      <option value="IELTS General Training (English)">IELTS General Training (English)</option>
                      <option value="PTE Core (English)">PTE Core (English)</option>
                      <option value="TEF Canada (French)">TEF Canada (French)</option>
                      <option value="TCF Canada (French)">TCF Canada (French)</option>
                    </select>

                    {spLangTest !== 'None / Not Applicable' && (
                      <div className="grid grid-cols-2 gap-4">
                        {['Listening', 'Speaking', 'Reading', 'Writing'].map(skill => (
                          <div key={skill}>
                            <label className="block text-xs font-semibold text-pink-800 mb-1">{skill}</label>
                            <select className="w-full p-2 bg-white border border-pink-200 rounded-lg text-sm" value={skill==='Listening'?spL:skill==='Speaking'?spS:skill==='Reading'?spR:spW} onChange={e => {
                              if (skill==='Listening') setSpL(e.target.value);
                              if (skill==='Speaking') setSpS(e.target.value);
                              if (skill==='Reading') setSpR(e.target.value);
                              if (skill==='Writing') setSpW(e.target.value);
                            }}>
                              <option value="">Score</option>
                              {getLangOptions(spLangTest, skill as any).map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                            </select>
                          </div>
                        ))}
                      </div>
                    )}
                 </div>
              </div>
            )}

            {/* PHASE 5: RESULTS */}
            {isResults && (
              <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-50 text-blue-500 mb-6 relative">
                  <div className="absolute inset-0 rounded-full bg-blue-400/20 blur-xl"></div>
                  <svg className="w-10 h-10 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg>
                </div>
                
                <h1 className="text-4xl font-extrabold text-slate-900 mb-2">Calculation Complete</h1>
                <p className="text-lg text-slate-500 mb-8">Your estimated Comprehensive Ranking System score is ready.</p>
                
                <div className="bg-gradient-to-b from-white to-slate-50 rounded-[2.5rem] p-10 shadow-[0_10px_40px_rgba(0,0,0,0.04)] border border-white mb-12 relative overflow-hidden">
                  <h2 className="text-xl font-bold text-slate-800 mb-4 relative z-10">Total CRS Score</h2>
                  <div 
                    className="text-[9rem] sm:text-[10rem] leading-none font-black text-primary relative z-10 select-none tracking-tighter mb-4"
                    style={{ 
                      textShadow: "0 10px 30px rgba(37,99,235,0.2)"
                    }}
                  >
                    {score.total}
                  </div>
                  <p className="text-slate-400/80 text-sm max-w-sm mx-auto font-medium absolute bottom-8 left-0 right-0 z-0 select-none tracking-wider uppercase">This score dictates your rank in the pool.</p>
                </div>

                <div className="text-left space-y-6 mb-16">
                  <h3 className="text-2xl font-bold text-slate-900 mb-6">Detailed Breakdown</h3>
                  
                  {[
                    { label: 'Core / Human Capital', val: score.core, max: hasSpouseForMath ? 460 : 500, color: 'bg-indigo-500' },
                    ...(hasSpouseForMath ? [{ label: 'Spouse Factors', val: score.spouse, max: 40, color: 'bg-pink-500' }] : []),
                    { label: 'Skill Transferability', val: score.transferability, max: 100, color: 'bg-emerald-500' },
                    { label: 'Additional Points', val: score.additional, max: 600, color: 'bg-amber-500' }
                  ].map(sec => (
                    <div key={sec.label} className="bg-[#fafafa] rounded-2xl p-6 border border-slate-100">
                      <div className="flex justify-between items-end mb-4">
                        <span className="font-bold text-slate-800 text-[1.05rem]">{sec.label}</span>
                        <span className="font-semibold text-slate-600 tabular-nums text-[0.95rem]">{sec.val} <span className="text-slate-400 font-medium">/ {sec.max} points</span></span>
                      </div>
                      <div className="h-3 bg-slate-200/80 rounded-full overflow-hidden w-full">
                        <motion.div 
                           className={cn("h-full rounded-full transition-all", sec.color)} 
                           initial={{ width: 0 }}
                           animate={{ width: `${Math.min((sec.val / sec.max) * 100, 100)}%` }}
                           transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="text-left space-y-6">
                   <h3 className="text-2xl font-bold text-slate-900 mb-6">Comprehensive Breakdown Table</h3>
                   
                   <div className="overflow-hidden bg-white shadow-sm ring-1 ring-slate-200/60 rounded-xl">
                      <table className="min-w-full divide-y divide-slate-100">
                        <thead>
                          <tr className="bg-[#FAFAFA] border-b border-slate-200">
                            <th scope="col" className="py-4 pl-6 pr-3 text-left text-sm font-bold text-slate-900 uppercase tracking-wide">Factor</th>
                            <th scope="col" className="px-6 py-4 text-right text-sm font-bold text-slate-900 uppercase tracking-wide">Points Awarded</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/60 bg-white">
                          <tr><td colSpan={2} className="py-4 pl-6 text-[0.8rem] font-bold text-[#3730a3] uppercase tracking-wide border-t-0">A. Core/human capital factors</td></tr>
                          <tr><td className="whitespace-nowrap pb-3 pt-2 pl-10 pr-3 text-[0.9rem] text-slate-500">Age</td><td className="whitespace-nowrap px-6 py-3 text-right text-[0.9rem] text-slate-800 font-semibold">{score.breakdown.core.age}</td></tr>
                          <tr><td className="whitespace-nowrap py-3 pl-10 pr-3 text-[0.9rem] text-slate-500">Level of education</td><td className="whitespace-nowrap px-6 py-3 text-right text-[0.9rem] text-slate-800 font-semibold">{score.breakdown.core.education}</td></tr>
                          <tr><td className="whitespace-nowrap py-3 pl-10 pr-3 text-[0.9rem] text-slate-500">Official languages</td><td className="whitespace-nowrap px-6 py-3 text-right text-[0.9rem] text-slate-800 font-semibold">{score.breakdown.core.officialLanguages}</td></tr>
                          <tr><td className="whitespace-nowrap py-3 pl-10 pr-3 text-[0.9rem] text-slate-500">Canadian work experience</td><td className="whitespace-nowrap px-6 py-3 text-right text-[0.9rem] text-slate-800 font-semibold">{score.breakdown.core.canadianWorkExperience}</td></tr>
                          
                          {hasSpouseForMath && (
                            <>
                              <tr><td colSpan={2} className="py-4 pl-6 border-t border-slate-100 text-[0.8rem] font-bold text-[#9d174d] uppercase tracking-wide">B. Spouse factors</td></tr>
                              <tr><td className="whitespace-nowrap pb-3 pt-2 pl-10 pr-3 text-[0.9rem] text-slate-500">Level of education</td><td className="whitespace-nowrap px-6 py-3 text-right text-[0.9rem] text-slate-800 font-semibold">{score.breakdown.spouse.education}</td></tr>
                              <tr><td className="whitespace-nowrap py-3 pl-10 pr-3 text-[0.9rem] text-slate-500">Official languages</td><td className="whitespace-nowrap px-6 py-3 text-right text-[0.9rem] text-slate-800 font-semibold">{score.breakdown.spouse.firstOfficialLanguages}</td></tr>
                              <tr><td className="whitespace-nowrap py-3 pl-10 pr-3 text-[0.9rem] text-slate-500">Canadian work experience</td><td className="whitespace-nowrap px-6 py-3 text-right text-[0.9rem] text-slate-800 font-semibold">{score.breakdown.spouse.canadianWorkExperience}</td></tr>
                            </>
                          )}

                          <tr><td colSpan={2} className="py-4 pl-6 border-t border-slate-100 text-[0.8rem] font-bold text-[#115e59] uppercase tracking-wide">C. Skill transferability factors</td></tr>
                          <tr><td className="whitespace-nowrap pb-3 pt-2 pl-10 pr-3 text-[0.9rem] text-slate-500">Education</td><td className="whitespace-nowrap px-6 py-3 text-right text-[0.9rem] text-slate-800 font-semibold">{score.breakdown.transferability.education.subtotal}</td></tr>
                          <tr><td className="whitespace-nowrap py-3 pl-10 pr-3 text-[0.9rem] text-slate-500">Foreign work experience</td><td className="whitespace-nowrap px-6 py-3 text-right text-[0.9rem] text-slate-800 font-semibold">{score.breakdown.transferability.foreignWork.subtotal}</td></tr>
                          <tr><td className="whitespace-nowrap py-3 pl-10 pr-3 text-[0.9rem] text-slate-500">Certificate of qualification</td><td className="whitespace-nowrap px-6 py-3 text-right text-[0.9rem] text-slate-800 font-semibold">{score.breakdown.transferability.certificateOfQualification}</td></tr>
                          
                          <tr><td colSpan={2} className="py-4 pl-6 border-t border-slate-100 text-[0.8rem] font-bold text-[#b45309] uppercase tracking-wide">D. Additional points</td></tr>
                          <tr><td className="whitespace-nowrap pb-3 pt-2 pl-10 pr-3 text-[0.9rem] text-slate-500">Provincial nomination</td><td className="whitespace-nowrap px-6 py-3 text-right text-[0.9rem] text-slate-800 font-semibold">{score.breakdown.additional.provincialNomination}</td></tr>
                          <tr><td className="whitespace-nowrap py-3 pl-10 pr-3 text-[0.9rem] text-slate-500">Job offer</td><td className="whitespace-nowrap px-6 py-3 text-right text-[0.9rem] text-slate-800 font-semibold">0</td></tr>
                          <tr><td className="whitespace-nowrap py-3 pl-10 pr-3 text-[0.9rem] text-slate-500">Study in Canada</td><td className="whitespace-nowrap px-6 py-3 text-right text-[0.9rem] text-slate-800 font-semibold">{score.breakdown.additional.studyInCanada}</td></tr>
                          <tr><td className="whitespace-nowrap py-3 pl-10 pr-3 text-[0.9rem] text-slate-500">Sibling in Canada</td><td className="whitespace-nowrap px-6 py-3 text-right text-[0.9rem] text-slate-800 font-semibold">{score.breakdown.additional.siblingInCanada}</td></tr>
                          <tr><td className="whitespace-nowrap py-3 pl-10 pr-3 text-[0.9rem] text-slate-500">French-language skills</td><td className="whitespace-nowrap px-6 py-3 text-right text-[0.9rem] text-slate-800 font-semibold">{score.breakdown.additional.frenchLanguageSkills}</td></tr>

                          <tr className="bg-[#FAFAFA] border-t border-slate-200">
                            <td className="whitespace-nowrap py-6 pl-6 text-[0.85rem] font-extrabold text-slate-900 uppercase tracking-widest">Grand Total</td>
                            <td className="whitespace-nowrap px-6 py-6 text-right text-3xl text-slate-900 font-black">{score.total}</td>
                          </tr>
                        </tbody>
                      </table>
                   </div>
                </div>

              </div>
            )}
            
            {/* Navigation Actions */}
            <div className="flex justify-between items-center mt-12 pt-6 border-t border-gray-100">
               {currentPhaseIndex > 0 ? (
                 <button onClick={handleBack} className="btn btn-outline" style={{ minWidth: '120px' }}>
                   ← Back
                 </button>
               ) : <div />}

               {!isResults && (
                 <button 
                   onClick={handleNext} 
                   disabled={!canAdvance()}
                   className={cn(
                     "btn btn-primary btn-lg shadow-md transition-all",
                     !canAdvance() && "opacity-50 cursor-not-allowed shadow-none hover:-translate-y-0"
                   )}
                   style={{ minWidth: '150px' }}
                 >
                   {currentPhaseIndex === phases.length - 2 ? "See Result →" : "Next Step →"}
                 </button>
               )}
            </div>

          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};
