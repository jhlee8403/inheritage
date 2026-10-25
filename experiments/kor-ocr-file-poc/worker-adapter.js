// Registered before the fixed Tesseract worker, so its dispatcher sees only its own jobs.
let deliverResources;
const localResources=new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error('TIMEOUT: worker resource message 10000ms')),10000);
  deliverResources=value=>{clearTimeout(timer);resolve(value);};
});
// Observe an early rejection even before the core requests the bytes.
localResources.catch(error=>stage('RESOURCE_TIMEOUT: '+String(error)));
const stage=name=>self.postMessage({workerId:'poc',jobId:'poc-stage',status:'progress',data:{status:name,progress:1}});
self.addEventListener('message',async event=>{
  if(event.data?.kind!=='POC_RESOURCE_BYTES')return;
  event.stopImmediatePropagation();
  deliverResources(event.data);stage('RESOURCE_MESSAGE_RECEIVED');
});
const onlyLocalFetch=async request=>{
  const url=typeof request==='string'?request:request.url;
  if(url!=='memory-model:/kor/kor.traineddata')throw new Error(`UNEXPECTED_RESOURCE_REQUEST: ${url}`);
  const {model}=await localResources;
  stage('KOR_BYTES_SUPPLIED');
  return new Response(model,{status:200,headers:{'Content-Type':'application/octet-stream'}});
};
// A private in-memory resource provider, not a file/CORS bypass or network proxy.
self.fetch=onlyLocalFetch;
stage('BLOB_WORKER_BOOTED');
