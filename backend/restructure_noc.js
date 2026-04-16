/**
 * Restructure noc_index.json to separate sub-occupation categories.
 * 
 * In the original NOC 2021 PDF, many NOC codes contain multiple "example titles"
 * (sub-occupations) each with their own duties. When parsed into a flat array,
 * these sub-titles got concatenated with the last duty of the previous group:
 * 
 *   "May supervise construction projects. Civil engineering technicians"
 *   
 * This script detects these embedded sub-titles and restructures the data into:
 *   duty_groups: [
 *     { sub_title: "Civil engineering technologists", duties: [...] },
 *     { sub_title: "Civil engineering technicians", duties: [...] },
 *   ]
 */
const fs = require('fs');
const d = require('./noc_index.json');

function isSubHeader(text) {
  // Sub-headers are typically:
  // - Title-cased occupation names (e.g. "Credit managers", "Civil engineering technicians")
  // - 2-6 words, no verbs/prepositions-heavy phrases
  // NOT sub-headers:
  // - "Senior managers in this unit group may specialize in areas..."
  // - Long sentences with conjunctions

  if (text.length < 8 || text.length > 80) return false;
  
  // Reject if it contains telltale sentence structure
  const rejectPatterns = [
    'may specialize', 'may be', 'in this unit group', 'in areas such as',
    'may include', 'such as', 'for example', 'which are', 'who are',
    'are employed', 'are included', 'this group includes',
  ];
  const lower = text.toLowerCase();
  if (rejectPatterns.some(p => lower.includes(p))) return false;
  
  // Reject if too many words (sub-titles are usually concise)
  const words = text.trim().split(/\s+/);
  if (words.length > 10) return false;
  
  // Reject if it looks like a clause (contains common verbs/prepositions heavily)
  const clauseWords = ['and', 'or', 'to', 'for', 'in', 'of', 'the', 'a', 'an', 'with', 'by', 'from'];
  const clauseCount = words.filter(w => clauseWords.includes(w.toLowerCase())).length;
  if (clauseCount > 3) return false;

  return true;
}

const restructured = {};
let totalWithSubs = 0;
let totalSubGroups = 0;

Object.keys(d).forEach(key => {
  const entry = { ...d[key] };
  const duties = entry.duties || [];
  
  // Try to split duties into groups
  const groups = [];
  let currentGroup = { sub_title: null, duties: [] };
  
  duties.forEach(duty => {
    // Check if this duty contains an embedded sub-header
    const match = duty.match(/^(.*[.!])\s+([A-Z][a-zA-Z\s,()'-]+)$/);
    
    if (match && isSubHeader(match[2])) {
      // The text before is the last duty of the current group
      const lastDuty = match[1].trim();
      if (lastDuty) currentGroup.duties.push(lastDuty);
      
      // Push the current group (if it has duties)
      if (currentGroup.duties.length > 0) {
        groups.push(currentGroup);
      }
      
      // Start a new group with the sub-header
      currentGroup = { sub_title: match[2].trim(), duties: [] };
    } else {
      currentGroup.duties.push(duty);
    }
  });
  
  // Push the last group
  if (currentGroup.duties.length > 0) {
    groups.push(currentGroup);
  }
  
  // Only use grouped structure if we found sub-categories
  if (groups.length > 1) {
    // The first group might not have a sub_title (it's the "general" group for the main title)
    if (!groups[0].sub_title) {
      groups[0].sub_title = entry.title; // Use the main NOC title
    }
    entry.duty_groups = groups;
    totalWithSubs++;
    totalSubGroups += groups.length;
  } else {
    // No sub-categories, keep duties flat but also provide a single group for consistency
    entry.duty_groups = [{ sub_title: entry.title, duties: duties }];
  }
  
  // Keep original flat duties array too (for backward compat)
  // But clean up: remove embedded sub-headers from the flat list
  entry.duties_flat = [];
  groups.forEach(g => {
    g.duties.forEach(dd => entry.duties_flat.push(dd));
  });
  
  restructured[key] = entry;
});

console.log(`Total NOCs: ${Object.keys(restructured).length}`);
console.log(`NOCs with sub-categories: ${totalWithSubs}`);
console.log(`Total sub-groups: ${totalSubGroups}`);

// Save restructured JSON
fs.writeFileSync('./noc_index_v2.json', JSON.stringify(restructured, null, 2));
console.log('\nSaved to noc_index_v2.json');

// Print a few examples
console.log('\n--- Example: NOC 22300 ---');
const ex = Object.values(restructured).find(e => e.code === '22300');
if (ex) {
  ex.duty_groups.forEach(g => {
    console.log(`\n  [${g.sub_title}]`);
    g.duties.forEach(dd => console.log(`    - ${dd.substring(0, 80)}`));
  });
}

console.log('\n--- Example: NOC 10020 ---');
const ex2 = Object.values(restructured).find(e => e.code === '10020');
if (ex2) {
  ex2.duty_groups.forEach(g => {
    console.log(`\n  [${g.sub_title}]`);
    g.duties.forEach(dd => console.log(`    - ${dd.substring(0, 80)}`));
  });
}
