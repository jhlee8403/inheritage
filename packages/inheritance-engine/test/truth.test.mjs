import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate, APPROVALS, fraction, evaluateArithmeticPaths, InputError } from '../src/index.mjs';
import { f, t01, POSITIVE_TRUTHS } from './fixtures.mjs';

const warnings = ['SYNTHETIC_ONLY', 'STATUTORY_SHARE_ONLY', 'NOT_A_RIGHTS_DETERMINATION'];
const baseRules = ['BL1-G00', 'BL1-R06', 'BL1-R07'].map(id => ({ id, version: 'v1' }));
const zero = f('0');
for (const truth of POSITIVE_TRUTHS) {
  test(truth.id, () => {
    const input = truth.input();
    const untouched = structuredClone(input);
    const result = calculate(input);
    const rules = ['BL1-G00', truth.rule, 'BL1-R06', 'BL1-R07'].map(id => ({ id, version: 'v1' }));
    assert.equal(result.status, 'REVIEW_READY');
    assert.deepEqual(result.initialShare, input.asset.share);
    // People, fractions, path IDs and path provenance are asserted independently of sums.
    assert.deepEqual(result.allocations, truth.whole.map(([personId,n,d], index) => ({ personId,
      relativeShare: f(truth.relative[index][1], truth.relative[index][2]), wholeShare: f(n,d),
      pathIds: [`E1:A:${personId}:DIRECT`] })));
    assert.deepEqual(result.paths, truth.whole.map(([toId,n,d], index) => ({ pathId: `E1:A:${toId}:DIRECT`,
      eventId: 'E1', fromId: 'A', toId, kind: 'DIRECT', relativeShare: f(truth.relative[index][1], truth.relative[index][2]),
      wholeShare: f(n,d), appliedRules: rules, lawSnapshotId: 'BL1-LAW-2016-14409',
      truthReference: { id: truth.id, version: 'v1' } })));
    assert.deepEqual(result.nonSelected, truth.nonSelected.map(([personId, reason]) => ({ personId, reason, relativeShare: zero, wholeShare: zero })));
    assert.deepEqual(result.unresolved, []);
    assert.deepEqual(result.blockedReasons, []);
    assert.deepEqual(result.warnings, warnings);
    assert.deepEqual(result.provenance, { engineVersion: '0.1.0', approvalRecordVersion: 'C1-approval-v1',
      appliedRules: rules, attemptedRules: rules, lawSnapshotId: 'BL1-LAW-2016-14409',
      truthReference: { id: truth.id, version: 'v1' }, truthVersion: 'v1', eventId: 'E1', inputRevision: '1' });
    assert.deepEqual(result.checks.conservation, { ok: true, allocated: input.asset.share, unresolved: zero,
      total: input.asset.share, expected: input.asset.share });
    assert.deepEqual(result.checks.identityPaths, { ok: true, issues: [] });
    assert.deepEqual(input, untouched);
  });
}

test('BL1-T07', () => {
  const result = evaluateArithmeticPaths({ initial: f('2','5'), truthReference: { id: 'BL1-T07', version: 'v1' }, paths: [
    { pathId: 'p1', personId: 'X', factors: [f('1','3'), f('1','2')] },
    { pathId: 'p2', personId: 'X', factors: [f('2','3'), f('1','4')] },
    { pathId: 'pY', personId: 'Y', factors: [f('2','3')] },
  ] });
  assert.equal(result.status, 'ARITHMETIC_ONLY');
  assert.deepEqual(result.warnings, ['NO_LEGAL_CAPACITY_DETERMINATION']);
  assert.deepEqual(result.unresolved, []);
  assert.deepEqual(result.blockedReasons, []);
  assert.deepEqual(result.provenance, {
    appliedRules: [{ id: 'BL1-R06', version: 'v1' }, { id: 'BL1-R07', version: 'v1' }],
    truthReference: { id: 'BL1-T07', version: 'v1' }, truthVersion: 'v1', eventId: null,
    lawSnapshotId: null, lawApplicability: 'NOT_APPLICABLE_ARITHMETIC_ONLY',
  });
  assert.deepEqual(result.allocations, [
    { personId: 'X', pathIds: ['p1','p2'], relativeShare: f('1','3'), wholeShare: f('2','15') },
    { personId: 'Y', pathIds: ['pY'], relativeShare: f('2','3'), wholeShare: f('4','15') },
  ]);
  assert.deepEqual(result.paths.map(p => [p.pathId,p.personId,p.relativeShare,p.wholeShare]), [
    ['p1','X',f('1','6'),f('1','15')],['p2','X',f('1','6'),f('1','15')],['pY','Y',f('2','3'),f('4','15')],
  ]);
  assert.deepEqual(fraction(f('3','9')), f('1','3'));
  assert.deepEqual(fraction(f('0','8')), zero);
  assert.deepEqual(fraction(f('9007199254740993','27021597764222979')), f('1','3'));
  for (const invalid of [f('1','0'), f('-1','3')]) assert.throws(() => fraction(invalid), InputError);
  assert.throws(() => evaluateArithmeticPaths({ initial: zero, paths: [] }), { code: 'INITIAL_SHARE_OUT_OF_RANGE' });
  assert.throws(() => evaluateArithmeticPaths({ initial: f('1'), paths: [
    { pathId: 'p1', personId: 'X', factors: [f('1','2')] },
    { pathId: 'p1', personId: 'X', factors: [f('1','2')] },
  ] }), { code: 'DUPLICATE_PATH' });
});

function assertBlocked(input, reasons, approvals = APPROVALS, attempted = baseRules) {
  const result = calculate(input, approvals);
  assert.equal(result.status, 'BLOCKED');
  assert.deepEqual(result.allocations, []);
  assert.deepEqual(result.paths, []);
  assert.deepEqual(result.nonSelected, []);
  assert.deepEqual(result.blockedReasons, reasons);
  assert.deepEqual(result.warnings, [...new Set([...warnings,...reasons.map(r => r.code)])]);
  assert.deepEqual(result.unresolved, [{ id: 'E1:unresolved', eventId: 'E1', relativeShare: f('1'),
    wholeShare: input.asset.share, reasons }]);
  assert.deepEqual(result.provenance, { engineVersion: '0.1.0', approvalRecordVersion: 'C1-approval-v1',
    appliedRules: baseRules, attemptedRules: attempted, lawSnapshotId: 'BL1-LAW-2016-14409',
    truthReference: input.truthReference, truthVersion: 'v1', eventId: 'E1', inputRevision: '1' });
  assert.deepEqual(result.checks.conservation, { ok: true, allocated: zero, unresolved: input.asset.share,
    total: input.asset.share, expected: input.asset.share });
  assert.deepEqual(result.checks.identityPaths, { ok: true, issues: [] });
  return result;
}

test('BL1-T08', () => {
  const input = t01('BL1-T08'); input.asset.share = f('1','3');
  input.family.spouse.existence = 'UNKNOWN';
  const before = structuredClone(input);
  assertBlocked(input, [{ code: 'SPOUSE_UNKNOWN', field: 'family.spouse.existence' }]);
  assert.deepEqual(input, before);
  assert.equal(input.family.spouse.existence, 'UNKNOWN');
});

test('BL1-T09', () => {
  const input = t01('BL1-T09'); input.asset.share = f('1','3');
  input.event.openingDate = { value: '2017', precision: 'YEAR', review: 'CONFIRMED' };
  input.event.deathOrder = 'UNKNOWN';
  input.family.spouse = { existence: 'ABSENT_CONFIRMED', review: 'CONFIRMED', complete: 'CONFIRMED', members: [] };
  input.family.children.members[0].id = 'B';
  input.family.children.members[1].id = 'C';
  // B's death is also only known to the year. Do not sort these into R04 or R05.
  input.family.children.members[0].life = 'UNKNOWN';
  input.family.children.members[0].deathDate = { value: '2017', precision: 'YEAR', review: 'CONFIRMED' };
  assertBlocked(input, [
    { code: 'DEATH_DATE_UNCONFIRMED', field: 'event.openingDate' },
    { code: 'DEATH_ORDER_UNKNOWN', field: 'event.deathOrder' },
    { code: 'LIFE_STATUS_UNKNOWN', field: 'family.children.B.life' },
    { code: 'DEATH_DATE_UNCONFIRMED', field: 'family.children.B.deathDate' },
  ]);
});

test('BL1-T10', () => {
  for (const issue of ['predeceasedChildBranches','multipleCapacity','lossOfInheritance','historicalLaw','specialKinship']) {
    const input = t01('BL1-T10'); input.asset.share = f('1','3'); input.scopeFacts[issue] = 'PRESENT';
    assertBlocked(input, [{ code: 'UNSUPPORTED_SCOPE', field: `scopeFacts.${issue}` }]);
  }
});

test('BL1-T11', () => {
  const input = t01('BL1-T11');
  const approvals = structuredClone(APPROVALS);
  approvals.rules['BL1-R01'].status = 'PENDING';
  const attempted = ['BL1-G00','BL1-R01','BL1-R06','BL1-R07'].map(id => ({ id, version: 'v1' }));
  assertBlocked(input, [{ code: 'RULE_PENDING', field: 'rules', ruleId: 'BL1-R01' }], approvals, attempted);
});
