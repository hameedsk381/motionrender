// Check measurable copy separately from drawing inputs such as frame counts,
// layout sizes, step numbers and easing parameters.
const numberWords = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const quantities = new RegExp(
  String.raw`(?<![\p{L}\d.])([+−-]?\d+(?:,\d{3})*(?:\.\d+)?|${numberWords.join('|')})\s*(%|percent\b|ms\b|milliseconds?\b|sec(?:ond)?s?\b|min(?:ute)?s?\b|h(?:ou)?rs?\b|days?\b|weeks?\b|months?\b|years?\b|[×x](?!\p{L}|\s*\d)|thousand\b|million\b|billion\b)`,
  'giu',
);

function asNumber(value: string): number {
  const word = numberWords.indexOf(value.toLowerCase());
  return word < 0 ? Number(value.replaceAll(',', '').replace('−', '-')) : word;
}

function normalizedQuantity(amount: string, unit: string): string {
  const canonical = unit.toLowerCase().replace(/^(percent|%)$/, '%')
    .replace(/^milliseconds?$/, 'ms').replace(/^sec(?:ond)?s?$/, 'second')
    .replace(/^min(?:ute)?s?$/, 'minute').replace(/^h(?:ou)?rs?$/, 'hour')
    .replace(/^(day|week|month|year)s$/, '$1').replace(/^x$/, '×');
  return asNumber(amount) + canonical;
}

export function reactGrounding(brief: string) {
  const measurements = [...brief.matchAll(quantities)];
  const supplied = new Set(measurements.map(match => normalizedQuantity(match[1]!, match[2]!)));
  const dataNumbers = /[+−-]?\d+(?:,\d{3})*(?:\.\d+)?/g;
  const briefNumbers = new Set([...(brief.match(dataNumbers) ?? []), ...measurements.map(match => match[1]!)].map(asNumber));

  function checkCopy(value: unknown): void {
    if (typeof value === 'string') {
      for (const match of value.matchAll(quantities)) {
        if (!supplied.has(normalizedQuantity(match[1]!, match[2]!))) {
          throw new Error(`Unsupplied quantity "${match[0]}". Remove it and express only the qualitative fact from the brief.`);
        }
      }
      return;
    }
    if (value === null || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (!['src', 'file', 'code'].includes(key)) checkCopy(child);
    }
  }

  function checkData(value: string) {
    for (const number of value.match(dataNumbers) ?? []) {
      if (!briefNumbers.has(asNumber(number))) throw new Error(`Data value "${number}" is absent from the brief. Use only supplied data values.`);
    }
  }

  return { checkCopy, checkData };
}
