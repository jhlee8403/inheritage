export function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const item of Object.values(value)) deepFreeze(item);
    Object.freeze(value);
  }
  return value;
}
export const LAW_ID = 'BL1-LAW-2016-14409';
export const VERSION = 'v1';
export const RULE_IDS = Object.freeze(['BL1-G00', 'BL1-R01', 'BL1-R02', 'BL1-R03', 'BL1-R06', 'BL1-R07']);
export const TRUTH_IDS = Object.freeze(['BL1-T01', 'BL1-T02-A', 'BL1-T02-B', 'BL1-T03',
  'BL1-T06-A', 'BL1-T06-B', 'BL1-T07', 'BL1-T08', 'BL1-T09', 'BL1-T10', 'BL1-T11']);
export const APPROVALS = deepFreeze({
  recordVersion: 'C1-approval-v1',
  approvedBy: '사용자',
  approvedOn: '2026-10-18',
  timezone: 'Asia/Seoul',
  law: { id: LAW_ID, status: 'APPROVED_FOR_C1' },
  rules: Object.fromEntries([...RULE_IDS.map(id => [id, { version: VERSION, status: 'APPROVED_FOR_C1' }]),
    ['BL1-R04', { version: VERSION, status: 'PENDING' }],
    ['BL1-R05', { version: VERSION, status: 'PENDING' }]]),
  truths: Object.fromEntries(TRUTH_IDS.map(id => [id, { version: VERSION, status: 'APPROVED_FOR_C1' }])),
});
export const ruleRef = id => ({ id, version: VERSION });

// An injected context can revoke approval for tests/review; it cannot widen this allowlist.
export function approvalReasons(ids, input, approvals) {
  const reasons = [];
  if (approvals?.recordVersion !== APPROVALS.recordVersion) {
    reasons.push({ code: 'APPROVAL_RECORD_MISMATCH', field: 'approvalRecordVersion' });
  }
  for (const id of ids) {
    const entry = approvals?.rules?.[id];
    if (!RULE_IDS.includes(id)) reasons.push({ code: 'UNSUPPORTED_RULE', field: 'rules', ruleId: id });
    else if (entry?.status !== 'APPROVED_FOR_C1') reasons.push({ code: 'RULE_PENDING', field: 'rules', ruleId: id });
    else if (entry.version !== VERSION) reasons.push({ code: 'RULE_VERSION_MISMATCH', field: 'rules', ruleId: id });
  }
  if (input.lawSnapshotId !== LAW_ID || approvals?.law?.id !== LAW_ID) {
    reasons.push({ code: 'LAW_SNAPSHOT_UNSUPPORTED', field: 'lawSnapshotId' });
  } else if (approvals.law.status !== 'APPROVED_FOR_C1') {
    reasons.push({ code: 'LAW_PENDING', field: 'lawSnapshotId' });
  }
  if (input.truthReference != null) {
    const { id, version } = input.truthReference;
    if (!TRUTH_IDS.includes(id) || approvals?.truths?.[id]?.status !== 'APPROVED_FOR_C1') {
      reasons.push({ code: 'TRUTH_PENDING', field: 'truthReference' });
    } else if (version !== VERSION || approvals.truths[id].version !== VERSION) {
      reasons.push({ code: 'TRUTH_VERSION_MISMATCH', field: 'truthReference' });
    }
  }
  return reasons;
}
