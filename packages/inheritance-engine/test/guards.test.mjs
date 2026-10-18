import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate, APPROVALS, fraction, initialShare, add, multiply, InputError,
  validateConservation, validateIdentityPaths, createSnapshot, refreshSnapshot, evaluateArithmeticPaths } from '../src/index.mjs';
import { t01, t02a, t03, f, person, present, absent } from './fixtures.mjs';

const blocked = (input, code, approvals = APPROVALS) => {
  const result = calculate(input, approvals);
  assert.equal(result.status, 'BLOCKED');
  assert.ok(result.blockedReasons.some(r => r.code === code), JSON.stringify(result.blockedReasons));
  assert.deepEqual(result.allocations, []);
  assert.deepEqual(result.paths, []);
  assert.equal(result.unresolved.length, 1);
  assert.deepEqual(result.unresolved[0].wholeShare, input.asset.share);
  assert.ok(result.checks.conservation.ok);
  return result;
};

test('Incomplete family and each collection block; empty records never imply absence', () => {
  for (const collection of ['spouse','children','parents','remoteRelatives']) {
    const input = t01(); input.family[collection].complete = 'UNKNOWN';
    blocked(input, 'FAMILY_INCOMPLETE');
  }
  const input = t01(); input.family.complete = 'UNKNOWN'; blocked(input, 'FAMILY_INCOMPLETE');
  const missing = t01(); delete missing.family.children; blocked(missing, 'FAMILY_UNKNOWN');
  const unknown = t01(); unknown.family.spouse = { ...absent(), existence: 'UNKNOWN' };
  blocked(unknown, 'SPOUSE_UNKNOWN');
  assert.equal(unknown.family.spouse.existence, 'UNKNOWN');
});

test('Unreviewed relationship, unknown life and unknown scope cannot become confirmed facts', () => {
  const rel = t01(); rel.family.children.members[0].relationshipReview = 'EXTRACTED'; blocked(rel, 'FACT_UNCONFIRMED');
  const life = t01(); life.family.children.members[0].life = 'UNKNOWN'; blocked(life, 'LIFE_STATUS_UNKNOWN');
  const issue = t01(); delete issue.scopeFacts.renunciation; blocked(issue, 'SCOPE_UNCONFIRMED');
  const unknown = t01(); unknown.scopeFacts.renunciation = 'UNKNOWN'; blocked(unknown, 'SCOPE_UNCONFIRMED');
});

test('All excluded scope flags block rather than redistributing to surviving people', () => {
  for (const key of Object.keys(t01().scopeFacts)) {
    const input = t01(); input.scopeFacts[key] = 'PRESENT'; blocked(input, 'UNSUPPORTED_SCOPE');
  }
});

test('Predeceased children do not activate R04 even if an absent-branch assertion is contradictory', () => {
  const input = t01(); input.family.children.members[0].life = 'PREDECEASED';
  const result = blocked(input, 'UNSUPPORTED_SCOPE');
  assert.ok(!result.provenance.appliedRules.some(r => r.id === 'BL1-R04'));
});

test('Multiple events or extra legal fields do not activate R05 or an implicit extension', () => {
  const input = t01(); input.event.kind = 'SUCCESSIVE'; blocked(input, 'UNSUPPORTED_SCOPE');
  const extra = t01(); extra.events = [{ id: 'E2' }]; blocked(extra, 'UNSUPPORTED_SCOPE');
  const personExtra = t01(); personExtra.family.children.members[0].renounced = true; blocked(personExtra, 'UNSUPPORTED_SCOPE');
});

test('Only the approved exact date pair and law snapshot are accepted', () => {
  for (const date of ['2017-01-20', '1960-01-01', '1991-01-01', '2026-03-17']) {
    const input = t01(); input.event.openingDate.value = date; blocked(input, 'DATE_OUT_OF_SCOPE');
  }
  const ref = t01(); ref.referenceDate.value = '2017-01-12'; blocked(ref, 'DATE_OUT_OF_SCOPE');
  const law = t01(); law.lawSnapshotId = 'UNREVIEWED_LAW'; blocked(law, 'LAW_SNAPSHOT_UNSUPPORTED');
});

test('Pending common/legal rules, pending law/truth and unapproved versions block', () => {
  for (const id of ['BL1-G00','BL1-R01','BL1-R06','BL1-R07']) {
    const approvals = structuredClone(APPROVALS); approvals.rules[id].status = 'PENDING';
    blocked(t01(), 'RULE_PENDING', approvals);
  }
  const approvals = structuredClone(APPROVALS); approvals.rules['BL1-R01'].version = 'v2';
  blocked(t01(), 'RULE_VERSION_MISMATCH', approvals);
  const pendingLaw = structuredClone(APPROVALS); pendingLaw.law.status = 'PENDING'; blocked(t01(), 'LAW_PENDING', pendingLaw);
  const pendingTruth = structuredClone(APPROVALS); pendingTruth.truths['BL1-T01'].status = 'PENDING'; blocked(t01(), 'TRUTH_PENDING', pendingTruth);
  const truth = t01(); truth.truthReference.version = 'v2'; blocked(truth, 'TRUTH_VERSION_MISMATCH');
  const unknownTruth = t01(); unknownTruth.truthReference.id = 'BL1-T04'; blocked(unknownTruth, 'TRUTH_PENDING');
});

test('R04/R05 stay PENDING and the built-in approval record is immutable', () => {
  assert.equal(APPROVALS.rules['BL1-R04'].status, 'PENDING');
  assert.equal(APPROVALS.rules['BL1-R05'].status, 'PENDING');
  assert.throws(() => { APPROVALS.rules['BL1-R04'].status = 'APPROVED_FOR_C1'; }, TypeError);
  const forged = t01(); forged.requestedRuleIds = ['BL1-R04']; blocked(forged, 'UNSUPPORTED_SCOPE');
});

test('Unsupported ages, adoption, spouse-only and grandparent-only families block', () => {
  const minor = t01(); minor.family.children.members[0].adult = 'MINOR'; blocked(minor, 'UNSUPPORTED_AGE_OR_UNKNOWN');
  const adopted = t01(); adopted.family.children.members[0].kind = 'ADOPTED'; blocked(adopted, 'UNSUPPORTED_RELATIONSHIP');
  const spouseOnly = t01(); spouseOnly.family.children = absent(); blocked(spouseOnly, 'UNSUPPORTED_SCOPE');
  const grandparent = t02a(); grandparent.family.parents.members.forEach(p => { p.life = 'PREDECEASED'; });
  blocked(grandparent, 'UNSUPPORTED_SCOPE');
});

test('Invalid Q or non-string fractions fail as input errors, not fabricated unresolved zero', () => {
  for (const share of [f('0'),f('-1','3'),f('2'),f('1','0'),f('1','-3'),{numerator:1,denominator:3},f('0.1'),f('1'.repeat(1025))]) {
    const input = t01(); input.asset.share = share;
    assert.throws(() => calculate(input), InputError);
  }
});

test('Duplicate people, missing references and contradictory collections fail explicitly', () => {
  const duplicate = t01(); duplicate.family.children.members[0].id = 'W';
  assert.throws(() => calculate(duplicate), { code: 'DUPLICATE_PERSON' });
  const missing = t03(); missing.family.remoteRelatives.members[0].viaId = 'not_in_family';
  assert.throws(() => calculate(missing), { code: 'MISSING_RELATIONSHIP_REFERENCE' });
  const contradictory = t01(); contradictory.family.spouse.existence = 'ABSENT_CONFIRMED';
  assert.throws(() => calculate(contradictory), { code: 'CONTRADICTORY_COLLECTION' });
});

test('More than two parents and multiple spouses are unsupported rather than silently truncated', () => {
  const input = t02a(); input.family.parents.members.push(person('P3','PARENT')); blocked(input, 'UNSUPPORTED_SCOPE');
  const spouse = t01(); spouse.family.spouse.members.push(person('W2','SPOUSE')); blocked(spouse, 'UNSUPPORTED_SCOPE');
});

test('Fraction algebra preserves large exact integers and normalized decimal-string serialization', () => {
  assert.deepEqual(add(f('9007199254740993','27021597764222979'),f('2','3')), f('1'));
  assert.deepEqual(multiply(f('9007199254740993','3'),f('3','9007199254740993')), f('1'));
  assert.deepEqual(initialShare(f('003','009')), f('1','3'));
  assert.deepEqual(fraction(f('0','999')), f('0'));
  assert.equal(JSON.stringify(fraction(f('3','9'))), '{"numerator":"1","denominator":"3"}');
});

test('Conservation can pass while person/path validation fails', () => {
  const result = structuredClone(calculate(t01()));
  result.allocations[0].personId = 'WRONG_PERSON';
  assert.equal(validateConservation(result).ok, true);
  assert.equal(validateIdentityPaths(result).ok, false);
  assert.ok(validateIdentityPaths(result).issues.includes('PATH_PERSON_MISMATCH'));
  const duplicate = structuredClone(calculate(t01())); duplicate.paths.push(structuredClone(duplicate.paths[0]));
  assert.equal(validateConservation(duplicate).ok, true);
  assert.equal(validateIdentityPaths(duplicate).ok, false);
});

test('A structurally consistent wrong recipient is still rejected by independent truth identity assertions', () => {
  const result = structuredClone(calculate(t01()));
  result.allocations[0].personId = 'WRONG_PERSON'; result.paths[0].toId = 'WRONG_PERSON';
  assert.equal(validateConservation(result).ok, true);
  assert.equal(validateIdentityPaths(result).ok, true);
  assert.throws(() => assert.deepEqual(result.allocations.map(a => a.personId), ['W','C1','C2']));
});

test('Independent numeric and path-integrity checks detect different defects', () => {
  const missing = structuredClone(calculate(t01())); missing.allocations.pop();
  assert.equal(validateConservation(missing).ok, false);
  assert.equal(validateIdentityPaths(missing).ok, false);
  const path = structuredClone(calculate(t01())); path.paths[0].eventId = 'E2';
  assert.equal(validateConservation(path).ok, true);
  assert.equal(validateIdentityPaths(path).ok, false);
});

test('All dependencies invalidate snapshots without requiring the caller to bump revision', () => {
  const changes = [
    i => { i.family.children.members[0].review = 'NEEDS_REVIEW'; },
    i => { i.family.children.members[0].relationshipReview = 'CONFLICTED'; },
    i => { i.lawSnapshotId = 'OTHER_LAW'; },
    i => { i.asset.share = f('1','3'); },
    i => { i.referenceDate.value = '2017-01-12'; },
    i => { i.inputRevision = '2'; },
  ];
  const input = t01(); const snapshot = createSnapshot(input);
  assert.strictEqual(refreshSnapshot(snapshot, input), snapshot);
  for (const change of changes) {
    const next = structuredClone(input); change(next);
    const stale = refreshSnapshot(snapshot, next);
    assert.equal(stale.result.status, 'STALE');
    assert.deepEqual(stale.result.staleReasons, ['DEPENDENCIES_CHANGED']);
    assert.ok(stale.result.warnings.includes('STALE_RESULT_DO_NOT_USE'));
    assert.equal(snapshot.result.status, 'REVIEW_READY');
    assert.strictEqual(refreshSnapshot(stale, input), stale); // reverting cannot revive an old result
  }
});

test('Approval/status/version changes also make existing snapshots STALE', () => {
  const input = t01(); const snapshot = createSnapshot(input);
  for (const mutate of [a => { a.rules['BL1-R01'].status = 'PENDING'; },
    a => { a.rules['BL1-R01'].version = 'v2'; }, a => { a.truths['BL1-T01'].version = 'v2'; }]) {
    const approvals = structuredClone(APPROVALS); mutate(approvals);
    assert.equal(refreshSnapshot(snapshot, input, approvals).result.status, 'STALE');
  }
});

test('Snapshots are detached from mutable inputs and stable across object-key ordering', () => {
  const input = t01(); const snapshot = createSnapshot(input);
  assert.throws(() => { snapshot.result.allocations[0].wholeShare.numerator = '999'; }, TypeError);
  const reordered = Object.fromEntries(Object.entries(input).reverse());
  assert.strictEqual(refreshSnapshot(snapshot, reordered), snapshot);
  input.truthReference.id = 'BL1-T08';
  assert.equal(snapshot.result.provenance.truthReference.id, 'BL1-T01');
  assert.equal(refreshSnapshot(snapshot, input).result.status, 'STALE');
});

test('Arithmetic utility rejects nonconservation and cannot advertise a legal truth', () => {
  assert.throws(() => evaluateArithmeticPaths({ initial: f('1'), paths: [
    { pathId: 'p1', personId: 'X', factors: [f('1','3')] },
  ] }), { code: 'ARITHMETIC_CONSERVATION_ERROR' });
  assert.throws(() => evaluateArithmeticPaths({ initial: f('1'), paths: [], truthReference: { id: 'BL1-T04', version: 'v1' } }),
    { code: 'ARITHMETIC_TRUTH_UNSUPPORTED' });
});

test('Descendants exclude ascendants by rank, independently of ancestor degree', () => {
  const input = t01();
  input.family.parents = present([person('F','PARENT'),person('M','PARENT')]);
  input.family.remoteRelatives = present([person('G','GRANDPARENT',{viaId:'F'})]);
  const result = calculate(input);
  assert.deepEqual(result.allocations.map(a => a.personId), ['W','C1','C2']);
  assert.deepEqual(result.nonSelected.map(p => [p.personId,p.reason,p.wholeShare]), [
    ['F','LOWER_RANK',f('0')], ['M','LOWER_RANK',f('0')], ['G','LOWER_RANK',f('0')],
  ]);
});

test('Unrecognized approval record and inconsistent optional death dates cannot bypass gates', () => {
  const approvals = structuredClone(APPROVALS); approvals.recordVersion = 'UNAPPROVED_RECORD';
  blocked(t01(), 'APPROVAL_RECORD_MISMATCH', approvals);
  const input = t02a(); input.family.parents.members[0].life = 'PREDECEASED';
  input.family.parents.members[0].deathDate = { value: '2016-02-31', precision: 'DAY', review: 'CONFIRMED' };
  blocked(input, 'UNSUPPORTED_SCOPE');
});
