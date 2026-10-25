// Fixed fabricated PDF only: no user document input, OCR or inheritance API.
document.querySelector('#run').addEventListener('click',async()=>{
  const status=document.querySelector('#status'), button=document.querySelector('#run');
  button.disabled=true;document.querySelector('#text').value='';status.textContent='RUNNING';
  let task;
  try{
    const data=Uint8Array.from(atob(PDF_BASE64),c=>c.charCodeAt(0));
    task=pdfjs.getDocument({data,isEvalSupported:false,useWasm:false,useWorkerFetch:false,
      useSystemFonts:false,disableAutoFetch:true,disableStream:true});
    const pdf=await task.promise,page=await pdf.getPage(1),viewport=page.getViewport({scale:1.4});
    if(viewport.width*viewport.height>4000000)throw new Error('Synthetic trial pixel limit');
    const canvas=document.querySelector('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
    await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
    const content=await page.getTextContent(),text=content.items.filter(i=>typeof i.str==='string'&&i.str.trim()).map(i=>i.str).join('\n');
    document.querySelector('#text').value=text;
    document.querySelector('#details').textContent=JSON.stringify({status:'NEEDS_REVIEW',numPages:pdf.numPages,
      renderedPages:[1],textItems:content.items.length,mode:'PDFJS_MAIN_THREAD_NO_NATIVE_WORKER',
      wasm:false,ocr:'NOT_RUN',candidateOnly:true},null,2);
    status.textContent='PASS';
  }catch(error){status.textContent='FAIL';document.querySelector('#details').textContent=error.stack??String(error);}
  finally{await task?.destroy();button.disabled=false;}
});
