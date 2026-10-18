import { InputError, ZERO, ONE, initialShare, ratio, multiply } from './fraction.mjs';
import { APPROVALS, VERSION, ruleRef, approvalReasons, deepFreeze } from './approval.mjs';
import { assertIntegrity } from './validation.mjs';

export const SCOPE_FACTS = Object.freeze([
  'predeceasedChildBranches', 'fetus', 'adoption', 'relationshipDispute', 'renunciation',
  'disqualification', 'lossOfInheritance', 'limitedAcceptance', 'specialBenefit', 'contribution',
  'bequest', 'partition', 'specialAsset', 'internationalLaw', 'simultaneousDeath', 'missingPerson',
  'multipleCapacity', 'successiveSuccession', 'historicalLaw', 'specialKinship',
]);
export const BASE_WARNINGS = Object.freeze(['SYNTHETIC_ONLY', 'STATUTORY_SHARE_ONLY', 'NOT_A_RIGHTS_DETERMINATION']);
const BASE_RULES = ['BL1-G00', 'BL1-R06', 'BL1-R07'];
const COLLECTIONS = ['spouse', 'children', 'parents', 'remoteRelatives'];
const idPattern = /^[A-Za-z0-9_-]{1,100}$/;
function requireId(value, field) {
  if (typeof value !== 'string' || !idPattern.test(value)) throw new InputError('INVALID_ID', field);
}
function isExactDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}
function checkShape(input) {
  if (!input || typeof input !== 'object' || input.schemaVersion !== 'c1-v1') throw new InputError('INVALID_SCHEMA', 'schemaVersion');
  requireId(input.caseId, 'caseId');
  requireId(input.inputRevision, 'inputRevision');
  requireId(input.asset?.id, 'asset.id');
  requireId(input.event?.id, 'event.id');
  requireId(input.event?.decedentId, 'event.decedentId');
  if (input.truthReference != null && (typeof input.truthReference !== 'object' || !input.truthReference.id)) {
    throw new InputError('INVALID_TRUTH_REFERENCE', 'truthReference');
  }
}
function reasonsForFacts(input) {
  const reasons = [];
  const block = (code, field) => reasons.push({ code, field });
  const allowedFields = [
    [input, ['schemaVersion','material','caseId','inputRevision','truthReference','lawSnapshotId','asset','referenceDate','event','family','scopeFacts'], 'input'],
    [input.event, ['id','decedentId','kind','deathOrder','openingDate'], 'event'],
    [input.asset, ['id','share','review'], 'asset'],
    [input.family, ['complete','review',...COLLECTIONS], 'family'],
  ];
  for (const [object, keys, field] of allowedFields) {
    for (const key of Object.keys(object ?? {})) if (!keys.includes(key)) block('UNSUPPORTED_SCOPE', `${field}.${key}`);
  }
  if (input.material !== 'SYNTHETIC') block('SYNTHETIC_ONLY', 'material');
  if (input.asset.review !== 'CONFIRMED') block('FACT_UNCONFIRMED', 'asset.review');
  if (input.event.openingDate?.review !== 'CONFIRMED' || input.event.openingDate?.precision !== 'DAY') {
    block('DEATH_DATE_UNCONFIRMED', 'event.openingDate');
  } else if (input.event.openingDate.value !== '2017-01-10') block('DATE_OUT_OF_SCOPE', 'event.openingDate');
  if (input.referenceDate?.review !== 'CONFIRMED') block('FACT_UNCONFIRMED', 'referenceDate');
  else if (input.referenceDate.value !== '2017-01-11') block('DATE_OUT_OF_SCOPE', 'referenceDate');
  if (input.event.deathOrder !== 'CONFIRMED') block('DEATH_ORDER_UNKNOWN', 'event.deathOrder');
  if (input.event.kind !== 'SINGLE') block('UNSUPPORTED_SCOPE', 'event.kind');
  if (input.family?.complete !== 'CONFIRMED') block('FAMILY_INCOMPLETE', 'family.complete');
  if (input.family?.review !== 'CONFIRMED') block('FACT_UNCONFIRMED', 'family.review');
  for (const key of SCOPE_FACTS) {
    const state = input.scopeFacts?.[key];
    if (state === 'PRESENT') block('UNSUPPORTED_SCOPE', `scopeFacts.${key}`);
    else if (state !== 'ABSENT_CONFIRMED') block('SCOPE_UNCONFIRMED', `scopeFacts.${key}`);
  }
  for (const key of Object.keys(input.scopeFacts ?? {})) {
    if (!SCOPE_FACTS.includes(key)) block('UNSUPPORTED_SCOPE', `scopeFacts.${key}`);
  }
  const seen = new Set([input.event.decedentId]);
  for (const key of COLLECTIONS) {
    const collection = input.family?.[key];
    const field = `family.${key}`;
    for (const extra of Object.keys(collection ?? {})) {
      if (!['existence','review','complete','members'].includes(extra)) block('UNSUPPORTED_SCOPE', `${field}.${extra}`);
    }
    if (collection?.existence === 'UNKNOWN' || collection?.existence == null) {
      block(key === 'spouse' ? 'SPOUSE_UNKNOWN' : 'FAMILY_UNKNOWN', `${field}.existence`);
    } else if (!['PRESENT', 'ABSENT_CONFIRMED'].includes(collection.existence)) {
      throw new InputError('INVALID_EXISTENCE_STATE', `${field}.existence`);
    }
    if (collection?.review !== 'CONFIRMED') block('FACT_UNCONFIRMED', `${field}.review`);
    if (collection?.complete !== 'CONFIRMED') block('FAMILY_INCOMPLETE', `${field}.complete`);
    if (!Array.isArray(collection?.members)) { block('FAMILY_INCOMPLETE', `${field}.members`); continue; }
    if ((collection.existence === 'ABSENT_CONFIRMED' && collection.members.length !== 0) ||
      (collection.existence === 'PRESENT' && collection.members.length === 0)) {
      throw new InputError('CONTRADICTORY_COLLECTION', field);
    }
    if (key === 'parents' && collection.members.length > 2) block('UNSUPPORTED_SCOPE', `${field}.members`);
    for (const p of collection.members) {
      for (const extra of Object.keys(p ?? {})) {
        if (!['id','relation','kind','life','adult','review','relationshipReview','viaId','deathDate'].includes(extra)) {
          block('UNSUPPORTED_SCOPE', `${field}.${p.id}.${extra}`);
        }
      }
      requireId(p?.id, `${field}.personId`);
      if (seen.has(p.id)) throw new InputError('DUPLICATE_PERSON', p.id);
      seen.add(p.id);
      if (p.review !== 'CONFIRMED' || p.relationshipReview !== 'CONFIRMED') block('FACT_UNCONFIRMED', `${field}.${p.id}`);
      if (p.adult !== 'CONFIRMED') block('UNSUPPORTED_AGE_OR_UNKNOWN', `${field}.${p.id}.adult`);
      if (!['ALIVE', 'PREDECEASED'].includes(p.life)) block('LIFE_STATUS_UNKNOWN', `${field}.${p.id}.life`);
      const expected = { spouse: 'SPOUSE', children: 'CHILD', parents: 'PARENT' }[key];
      if (expected && p.relation !== expected) block('UNSUPPORTED_RELATIONSHIP', `${field}.${p.id}.relation`);
      if (p.kind !== (key === 'spouse' ? 'LEGAL_MARRIAGE' : 'BIOLOGICAL')) block('UNSUPPORTED_RELATIONSHIP', `${field}.${p.id}.kind`);
      if (key === 'spouse' && p.life !== 'ALIVE') block('UNSUPPORTED_SCOPE', `${field}.${p.id}.life`);
      if (key === 'children' && p.life === 'PREDECEASED') block('UNSUPPORTED_SCOPE', `${field}.${p.id}.life`);
      if (p.deathDate != null) {
        if (p.deathDate.review !== 'CONFIRMED' || p.deathDate.precision !== 'DAY') {
          block('DEATH_DATE_UNCONFIRMED', `${field}.${p.id}.deathDate`);
        } else if (p.life !== 'PREDECEASED' || !isExactDate(p.deathDate.value) ||
          p.deathDate.value >= '2017-01-10') {
          block('UNSUPPORTED_SCOPE', `${field}.${p.id}.deathDate`);
        }
      }
      if (key === 'remoteRelatives') {
        if (!['GRANDCHILD', 'GRANDPARENT'].includes(p.relation)) block('UNSUPPORTED_RELATIONSHIP', `${field}.${p.id}.relation`);
        const via = p.relation === 'GRANDCHILD' ? input.family.children : input.family.parents;
        const parent = via?.members?.find(a => a.id === p.viaId);
        if (!parent) throw new InputError('MISSING_RELATIONSHIP_REFERENCE', `${field}.${p.id}.viaId`);
        if (p.relation === 'GRANDCHILD' && parent.life !== 'ALIVE') block('UNSUPPORTED_SCOPE', `${field}.${p.id}.viaId`);
      }
    }
  }
  return reasons;
}
function provenance(input, ids, attempted, approvals) {
  return {
    engineVersion: '0.1.0', approvalRecordVersion: approvals?.recordVersion ?? null,
    appliedRules: ids.map(ruleRef), attemptedRules: attempted.map(ruleRef),
    lawSnapshotId: input.lawSnapshotId ?? null,
    truthReference: input.truthReference ?? null, truthVersion: input.truthReference?.version ?? null,
    eventId: input.event.id, inputRevision: input.inputRevision,
  };
}
function finish(input, q, allocations, paths, nonSelected, blockedReasons, applied, attempted, approvals) {
  const result = {
    schemaVersion: 'c1-result-v1', caseId: input.caseId, eventId: input.event.id,
    status: blockedReasons.length ? 'BLOCKED' : 'REVIEW_READY', initialShare: q,
    allocations, paths, nonSelected,
    unresolved: blockedReasons.length ? [{ id: `${input.event.id}:unresolved`, eventId: input.event.id,
      relativeShare: ONE, wholeShare: q, reasons: blockedReasons }] : [],
    blockedReasons,
    warnings: [...new Set([...BASE_WARNINGS, ...blockedReasons.map(r => r.code)])],
    provenance: provenance(input, applied, attempted, approvals),
  };
  result.checks = assertIntegrity(result);
  // Clone so caller-owned fact/provenance objects cannot mutate this result later.
  return deepFreeze(structuredClone(result));
}
export function calculate(input, approvals = APPROVALS) {
  checkShape(input);
  const q = initialShare(input.asset.share);
  const baseReasons = approvalReasons(BASE_RULES, input, approvals);
  const appliedBase = BASE_RULES.filter(id => approvals?.rules?.[id]?.status === 'APPROVED_FOR_C1' && approvals.rules[id].version === VERSION);
  if (baseReasons.length) return finish(input, q, [], [], [], baseReasons, appliedBase, BASE_RULES, approvals);
  const reasons = reasonsForFacts(input);
  if (reasons.length) return finish(input, q, [], [], [], reasons, BASE_RULES, BASE_RULES, approvals);

  const { spouse, children, parents, remoteRelatives } = input.family;
  const w = spouse.members;
  const c = children.members;
  const p = parents.members.filter(p => p.life === 'ALIVE');
  let ruleId;
  let blood;
  if (c.length > 0 && w.length === 1) { ruleId = 'BL1-R01'; blood = c; }
  else if (c.length === 0 && children.existence === 'ABSENT_CONFIRMED' && w.length === 1 && p.length >= 1 && p.length <= 2) {
    ruleId = 'BL1-R02'; blood = p;
  } else if (c.length > 0 && spouse.existence === 'ABSENT_CONFIRMED') { ruleId = 'BL1-R03'; blood = c; }
  else return finish(input, q, [], [], [], [{ code: 'UNSUPPORTED_SCOPE', field: 'family' }], BASE_RULES, BASE_RULES, approvals);

  const attempted = ['BL1-G00', ruleId, 'BL1-R06', 'BL1-R07'];
  const ruleReasons = approvalReasons([ruleId], input, approvals);
  if (ruleReasons.length) return finish(input, q, [], [], [], ruleReasons, BASE_RULES, attempted, approvals);
  const denominator = w.length ? 3n + 2n * BigInt(blood.length) : BigInt(blood.length);
  const selected = [...w.map(person => [person, 3n]), ...blood.map(person => [person, w.length ? 2n : 1n])];
  const paths = selected.map(([person, weight]) => {
    const relativeShare = ratio(weight, denominator);
    return {
      pathId: `${input.event.id}:${input.event.decedentId}:${person.id}:DIRECT`,
      eventId: input.event.id, fromId: input.event.decedentId, toId: person.id, kind: 'DIRECT',
      relativeShare, wholeShare: multiply(q, relativeShare),
      appliedRules: attempted.map(ruleRef), lawSnapshotId: input.lawSnapshotId,
      truthReference: input.truthReference ?? null,
    };
  });
  const allocations = paths.map(p => ({ personId: p.toId, relativeShare: p.relativeShare,
    wholeShare: p.wholeShare, pathIds: [p.pathId] }));
  const nonSelected = [];
  if (c.length) {
    for (const person of parents.members) nonSelected.push({ personId: person.id,
      reason: person.life === 'PREDECEASED' ? 'PREDECEASED_ASCENDANT' : 'LOWER_RANK', relativeShare: ZERO, wholeShare: ZERO });
  } else {
    for (const person of parents.members.filter(p => p.life === 'PREDECEASED')) nonSelected.push({ personId: person.id,
      reason: 'PREDECEASED_ASCENDANT', relativeShare: ZERO, wholeShare: ZERO });
  }
  for (const person of remoteRelatives.members) nonSelected.push({ personId: person.id,
    reason: c.length && person.relation === 'GRANDPARENT' ? 'LOWER_RANK' : 'REMOTER_DEGREE', relativeShare: ZERO, wholeShare: ZERO });
  return finish(input, q, allocations, paths, nonSelected, [], attempted, attempted, approvals);
}
