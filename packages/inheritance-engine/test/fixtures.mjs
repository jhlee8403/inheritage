// Synthetic facts and literal expectations transcribed from the pre-implementation documents.
// This fixture module does not import the engine or derive expected shares from it.
export const f = (numerator, denominator = '1') => ({ numerator, denominator });
export const person = (id, relation, extra = {}) => ({ id, relation, kind: relation === 'SPOUSE' ? 'LEGAL_MARRIAGE' : 'BIOLOGICAL',
  life: 'ALIVE', adult: 'CONFIRMED', review: 'CONFIRMED', relationshipReview: 'CONFIRMED', ...extra });
export const present = members => ({ existence: 'PRESENT', review: 'CONFIRMED', complete: 'CONFIRMED', members });
export const absent = () => ({ existence: 'ABSENT_CONFIRMED', review: 'CONFIRMED', complete: 'CONFIRMED', members: [] });
export function t01(id = 'BL1-T01') {
  return {
    schemaVersion: 'c1-v1', material: 'SYNTHETIC', caseId: 'SyntheticCase', inputRevision: '1',
    truthReference: { id, version: 'v1' }, lawSnapshotId: 'BL1-LAW-2016-14409',
    asset: { id: 'SyntheticAsset', share: f('1'), review: 'CONFIRMED' },
    referenceDate: { value: '2017-01-11', review: 'CONFIRMED' },
    event: { id: 'E1', decedentId: 'A', kind: 'SINGLE', deathOrder: 'CONFIRMED',
      openingDate: { value: '2017-01-10', precision: 'DAY', review: 'CONFIRMED' } },
    family: { complete: 'CONFIRMED', review: 'CONFIRMED', spouse: present([person('W', 'SPOUSE')]),
      children: present([person('C1', 'CHILD'), person('C2', 'CHILD')]), parents: absent(), remoteRelatives: absent() },
    scopeFacts: {
      predeceasedChildBranches: 'ABSENT_CONFIRMED', fetus: 'ABSENT_CONFIRMED', adoption: 'ABSENT_CONFIRMED',
      relationshipDispute: 'ABSENT_CONFIRMED', renunciation: 'ABSENT_CONFIRMED', disqualification: 'ABSENT_CONFIRMED',
      lossOfInheritance: 'ABSENT_CONFIRMED', limitedAcceptance: 'ABSENT_CONFIRMED', specialBenefit: 'ABSENT_CONFIRMED',
      contribution: 'ABSENT_CONFIRMED', bequest: 'ABSENT_CONFIRMED', partition: 'ABSENT_CONFIRMED',
      specialAsset: 'ABSENT_CONFIRMED', internationalLaw: 'ABSENT_CONFIRMED', simultaneousDeath: 'ABSENT_CONFIRMED',
      missingPerson: 'ABSENT_CONFIRMED', multipleCapacity: 'ABSENT_CONFIRMED', successiveSuccession: 'ABSENT_CONFIRMED',
      historicalLaw: 'ABSENT_CONFIRMED', specialKinship: 'ABSENT_CONFIRMED',
    },
  };
}
export function t02a() {
  const input = t01('BL1-T02-A');
  input.family.children = absent();
  input.family.parents = present([person('F', 'PARENT'), person('M', 'PARENT')]);
  input.family.remoteRelatives = present([person('G', 'GRANDPARENT', { viaId: 'F' })]);
  return input;
}
export function t02b() {
  const input = t02a(); input.truthReference.id = 'BL1-T02-B';
  input.family.parents.members[0].life = 'PREDECEASED';
  return input;
}
export function t03(id = 'BL1-T03') {
  const input = t01(id);
  input.family.spouse = absent();
  input.family.children = present([person('C1', 'CHILD'), person('C2', 'CHILD'), person('C3', 'CHILD')]);
  input.family.remoteRelatives = present([person('G', 'GRANDCHILD', { viaId: 'C1' })]);
  return input;
}
export const POSITIVE_TRUTHS = [
  { id: 'BL1-T01', input: () => t01(), rule: 'BL1-R01', relative: [['W','3','7'],['C1','2','7'],['C2','2','7']],
    whole: [['W','3','7'],['C1','2','7'],['C2','2','7']], nonSelected: [] },
  { id: 'BL1-T02-A', input: t02a, rule: 'BL1-R02', relative: [['W','3','7'],['F','2','7'],['M','2','7']],
    whole: [['W','3','7'],['F','2','7'],['M','2','7']], nonSelected: [['G','REMOTER_DEGREE']] },
  { id: 'BL1-T02-B', input: t02b, rule: 'BL1-R02', relative: [['W','3','5'],['M','2','5']],
    whole: [['W','3','5'],['M','2','5']], nonSelected: [['F','PREDECEASED_ASCENDANT'],['G','REMOTER_DEGREE']] },
  { id: 'BL1-T03', input: () => t03(), rule: 'BL1-R03', relative: [['C1','1','3'],['C2','1','3'],['C3','1','3']],
    whole: [['C1','1','3'],['C2','1','3'],['C3','1','3']], nonSelected: [['G','REMOTER_DEGREE']] },
  { id: 'BL1-T06-A', input: () => { const i = t01('BL1-T06-A'); i.asset.share = f('1','3'); return i; }, rule: 'BL1-R01',
    relative: [['W','3','7'],['C1','2','7'],['C2','2','7']], whole: [['W','1','7'],['C1','2','21'],['C2','2','21']], nonSelected: [] },
  { id: 'BL1-T06-B', input: () => { const i = t03('BL1-T06-B'); i.asset.share = f('2','5'); return i; }, rule: 'BL1-R03',
    relative: [['C1','1','3'],['C2','1','3'],['C3','1','3']], whole: [['C1','2','15'],['C2','2','15'],['C3','2','15']], nonSelected: [['G','REMOTER_DEGREE']] },
];
