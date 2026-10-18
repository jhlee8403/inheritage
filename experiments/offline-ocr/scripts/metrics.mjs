export const normalize = text => text.normalize('NFC').replace(/\s+/gu, '');
// Character-level Levenshtein alignment with explicit substitution/deletion/insertion counts.
// Deletions are missing reference characters; insertions are extra observed characters.
export function align(reference, observed) {
  const a=[...reference], b=[...observed];
  const d=Array.from({length:a.length+1},()=>new Uint32Array(b.length+1));
  for(let i=0;i<=a.length;i++)d[i][0]=i;
  for(let j=0;j<=b.length;j++)d[0][j]=j;
  for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
  let i=a.length,j=b.length,substitutions=0,deletions=0,insertions=0;
  const errors=[];
  while(i||j){
    if(i&&j&&d[i][j]===d[i-1][j-1]+(a[i-1]===b[j-1]?0:1)){
      if(a[i-1]!==b[j-1]){substitutions++;errors.push({kind:'substitution',expected:a[i-1],observed:b[j-1],referenceIndex:i-1});}i--;j--;
    }else if(i&&d[i][j]===d[i-1][j]+1){deletions++;errors.push({kind:'deletion',expected:a[i-1],referenceIndex:i-1});i--;}
    else{insertions++;errors.push({kind:'insertion',observed:b[j-1],observedIndex:j-1});j--;}
  }
  return {referenceCharacters:a.length,observedCharacters:b.length,substitutions,deletions,insertions,editDistance:d[a.length][b.length],cer:a.length?d[a.length][b.length]/a.length:null,errors:errors.reverse()};
}
export function measure(truth,text){
  const normalized=normalize(text);
  const fields=Object.fromEntries(Object.entries(truth.fields).filter(([,v])=>v).map(([k,v])=>[k,{expected:v,exactSubstring:normalized.includes(normalize(v))}]));
  const strip=(s,pattern)=>[...normalize(s)].filter(c=>pattern.test(c)).join('');
  return {fields,raw:align(truth.expectedText,text),normalized:align(normalize(truth.expectedText),normalized),
    numbers:align(strip(truth.expectedText,/[0-9]/u),strip(text,/[0-9]/u)),
    hanja:align(strip(truth.expectedText,/\p{Script=Han}/u),strip(text,/\p{Script=Han}/u)),
    manualCorrectionLowerBound:align(normalize(truth.expectedText),normalized).editDistance,
    note:'Field metric is exact substring presence after whitespace removal, not semantic extraction. Edit distance is an algorithmic lower bound, not measured human effort.'};
}
