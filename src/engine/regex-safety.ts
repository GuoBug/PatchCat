/**
 * Heuristic guard against catastrophic-backtracking regexes (ReDoS).
 *
 * JS has no regex timeout, so this rejects the classic dangerous shapes before compiling:
 *   - nested quantifiers:   (a+)+   (a*)*   (a+){2,}   (.*a){10}
 *   - quantified alternation with repeated overlap: (a|a)+  (a|aa)+
 *
 * Limits: it is a heuristic, not a proof. It can reject some safe patterns and cannot catch
 * every adversarial one. The length caps in evaluateCondition remain the second line of defense.
 */

// A group whose body already contains a quantifier, itself followed by a quantifier.
// Supports both standard capturing groups and non-capturing/flagged groups: (?:a+)+, (?i:a+)+
const NESTED_QUANTIFIER = /\((?:\?[a-zA-Z-]*:)?(?:[^()\\]|\\.)*[+*](?:[^()\\]|\\.)*\)\s*(?:[+*]|\{\d+,?\d*\})/;

// Matches any quantified group containing alternation (capturing or non-capturing)
const QUANTIFIED_GROUP_PATTERN = /\((?:\?[a-zA-Z-]*:)?([^()]*)\)\s*(?:[+*]|\{\d+,?\d*\})/g;

export function isUnsafeRegexPattern(pattern: string): boolean {
  if (NESTED_QUANTIFIER.test(pattern)) return true;

  // Check quantified alternation with branch overlaps or nullable branches
  const regex = new RegExp(QUANTIFIED_GROUP_PATTERN.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = regex.exec(pattern)) !== null) {
    const innerContent = match[1];
    if (innerContent && innerContent.includes('|')) {
      const branches = innerContent.split('|').map((s) => s.trim().replace(/^\?[a-zA-Z-]*:/, ''));
      for (let i = 0; i < branches.length; i++) {
        const b1 = branches[i];
        if (b1 === undefined || b1 === '' || b1.endsWith('?') || b1.endsWith('*')) return true;
        for (let j = i + 1; j < branches.length; j++) {
          const b2 = branches[j];
          if (b2 === undefined || b2 === '' || b2.endsWith('?') || b2.endsWith('*')) return true;
          const c1 = b1.replace(/[?*+]/g, '');
          const c2 = b2.replace(/[?*+]/g, '');
          if (c1 && c2 && (c1 === c2 || c1.startsWith(c2) || c2.startsWith(c1))) return true;
        }
      }
    }
  }

  return false;
}
