// Revision/request identity is independent of asynchronous digest completion order.
export class CalculationSession {
  constructor(api, publish) { this.api=api; this.publish=publish; this.revision=0; this.request=0; this.snapshot=null; this.state={status:'EMPTY'}; }
  emit(state) { this.state=state; this.publish(state); }
  invalidate(input) {
    const previous=this.snapshot;
    this.revision++; this.request++; this.snapshot=null;
    this.emit({status:'STALE', message:'입력이 변경되었습니다. 재계산 전에는 복사할 수 없습니다.'});
    // No old result remains visible/copyable while the dependency hash is checked.
    if(previous) {
      const revision=this.revision, request=this.request;
      void this.api.refreshSnapshotAsync(previous, structuredClone(input)).catch(error=>{
        if(this.revision===revision && this.request===request) this.emit({status:'ERROR',message:`${error.code ?? error.name}: ${error.message}`});
      });
    }
  }
  cancel() { this.request++; this.snapshot=null; this.emit({status:'CANCELLED',message:'계산이 취소되었습니다. 다시 계산하세요.'}); }
  async calculate(input) {
    const request=++this.request, revision=this.revision;
    this.snapshot=null; this.emit({status:'CALCULATING',message:'현재 입력을 해시·계산 중입니다.'});
    try {
      const snapshot=await this.api.createSnapshotAsync(structuredClone(input));
      if(request!==this.request || revision!==this.revision) return;
      this.snapshot=snapshot;
      this.emit({status:snapshot.result.status, result:snapshot.result, hash:snapshot.dependencyHash});
    } catch(error) {
      if(request!==this.request || revision!==this.revision) return;
      this.emit({status:'ERROR',message:`${error.code ?? error.name} (${error.field ?? ''}): ${error.message}`});
    }
  }
  canCopy() { return !!this.snapshot && ['REVIEW_READY','BLOCKED'].includes(this.state.status); }
}
