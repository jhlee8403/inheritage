import { InputError } from '../fraction.mjs';

// Technical input limits, not measured performance or approved legal scope.
export const M2_LIMITS = Object.freeze({ jsonBytes:1048576, persons:256, relations:512, events:32,
  deathFacts:256, eventFacts:32, historicalFamilyFacts:256, nodes:20000, depth:32, stringBytes:4096 });
const bytes = text => new TextEncoder().encode(text).length;
const fail = (code,field) => { throw new InputError(code,field); };
function size(text,field,maximum) { if(bytes(text)>maximum) fail('INPUT_LIMIT_EXCEEDED',field); }
function budget() {
  let nodes=0;
  return (depth,field)=>{ if(++nodes>M2_LIMITS.nodes || depth>M2_LIMITS.depth) fail('INPUT_LIMIT_EXCEEDED',field); };
}

// Object API cannot establish whether an earlier JSON text contained duplicate keys.
export function captureM2Object(input) {
  const visit=budget(),ancestors=new Set();
  function copy(value,field,depth) {
    visit(depth,field);
    if(value===null || typeof value==='boolean') return value;
    if(typeof value==='string') { size(value,field,M2_LIMITS.stringBytes);return value; }
    if(typeof value==='number' && Number.isFinite(value)) return value;
    if(typeof value!=='object') fail('NON_JSON_INPUT',field);
    if(ancestors.has(value)) fail('CYCLIC_JSON_OBJECT',field);
    const proto=Object.getPrototypeOf(value);
    if(Array.isArray(value) ? proto!==Array.prototype : proto!==Object.prototype && proto!==null) fail('NON_JSON_INPUT',field);
    ancestors.add(value);
    const descriptors=Object.getOwnPropertyDescriptors(value);
    for(const key of Reflect.ownKeys(descriptors)) {
      if(typeof key!=='string') fail('NON_JSON_INPUT',field);
      if(Array.isArray(value) && key==='length') continue;
      size(key,field,M2_LIMITS.stringBytes);
      const d=descriptors[key];
      if(!d.enumerable || !Object.hasOwn(d,'value')) fail('NON_JSON_INPUT',`${field}.${key}`);
      if(Array.isArray(value) && (!/^(0|[1-9]\d*)$/.test(key) || !Number.isSafeInteger(Number(key)) || Number(key)>=value.length)) fail('NON_JSON_INPUT',field);
    }
    let result;
    if(Array.isArray(value)) {
      // Check before walking a sparse or huge array.
      if(value.length>M2_LIMITS.nodes) fail('INPUT_LIMIT_EXCEEDED',field);
      result=[];
      for(let i=0;i<value.length;i++) {
        if(!Object.hasOwn(descriptors,String(i))) fail('NON_JSON_INPUT',`${field}[${i}]`);
        result.push(copy(descriptors[i].value,`${field}[${i}]`,depth+1));
      }
    } else result=Object.fromEntries(Object.entries(descriptors).map(([k,d])=>[k,copy(d.value,`${field}.${k}`,depth+1)]));
    ancestors.delete(value);return result;
  }
  const result=copy(input,'$',1);
  size(JSON.stringify(result),'$',M2_LIMITS.jsonBytes);
  return result;
}

// Parse keys before assignment. Escaped equivalent keys are duplicates too.
export function parseM2InputJson(text) {
  if(typeof text!=='string') fail('INVALID_JSON_TEXT','$');
  size(text,'$',M2_LIMITS.jsonBytes);
  let at=0;const visit=budget();
  const whitespace=()=>{ while(/[\x20\t\r\n]/.test(text[at]??'!'))at++; };
  const bad=field=>fail('INVALID_JSON',field);
  function string(field) {
    const start=at++;
    while(at<text.length) {
      const c=text[at++];
      if(c==='\\') {at++;continue;}
      if(c==='"') {
        let value;try {value=JSON.parse(text.slice(start,at));}catch {bad(field);}
        size(value,field,M2_LIMITS.stringBytes);return value;
      }
    }
    bad(field);
  }
  function value(field,depth) {
    visit(depth,field);whitespace();const c=text[at];
    if(c==='"')return string(field);
    if(c==='{') {
      at++;whitespace();const pairs=[],seen=new Set();
      if(text[at]==='}') {at++;return {};}
      for(;;) {
        if(text[at]!=='"')bad(field);
        const key=string(field);
        if(seen.has(key))fail('DUPLICATE_JSON_KEY',`${field}.${key}`);
        seen.add(key);whitespace();if(text[at++]!==':')bad(field);
        pairs.push([key,value(`${field}.${key}`,depth+1)]);whitespace();
        const end=text[at++];if(end==='}')return Object.fromEntries(pairs);
        if(end!==',')bad(field);whitespace();
      }
    }
    if(c==='[') {
      at++;whitespace();const result=[];
      if(text[at]===']'){at++;return result;}
      for(;;) {
        result.push(value(`${field}[${result.length}]`,depth+1));whitespace();
        const end=text[at++];if(end===']')return result;
        if(end!==',')bad(field);whitespace();
      }
    }
    for(const [literal,result] of [['true',true],['false',false],['null',null]]) {
      if(text.startsWith(literal,at)){at+=literal.length;return result;}
    }
    const match=text.slice(at).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
    if(!match)bad(field);
    at+=match[0].length;const number=Number(match[0]);
    if(!Number.isFinite(number))fail('NON_JSON_INPUT',field);
    return number;
  }
  const result=value('$',1);whitespace();if(at!==text.length)bad('$');return result;
}
