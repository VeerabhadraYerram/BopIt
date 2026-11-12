let recording=null;
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
 if(sender.id!==chrome.runtime.id||message?.target!=='bopit-audio')return;
 if(message.type==='BOPIT_AUDIO_START'){
  if(recording){respond({error:'An audio capture is already running.'});return;}
  (async()=>{const stream=await navigator.mediaDevices.getUserMedia({audio:{mandatory:{chromeMediaSource:'tab',chromeMediaSourceId:message.streamId}},video:false});
   const audio=new AudioContext();await audio.resume();audio.createMediaStreamSource(stream).connect(audio.destination);
   const mimeType=MediaRecorder.isTypeSupported('audio/webm;codecs=opus')?'audio/webm;codecs=opus':'audio/webm';const recorder=new MediaRecorder(stream,{mimeType,audioBitsPerSecond:96000}),chunks=[];
   recording=new Promise(resolve=>{recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};const cleanup=()=>{stream.getTracks().forEach(t=>t.stop());audio.close();};recorder.onerror=()=>{cleanup();resolve({error:'Could not record this video’s audio.'});};recorder.onstop=async()=>{cleanup();const blob=new Blob(chunks,{type:'audio/webm'});const buffer=new Uint8Array(await blob.arrayBuffer());let binary='';for(let i=0;i<buffer.length;i+=8192)binary+=String.fromCharCode(...buffer.subarray(i,i+8192));resolve({audio:btoa(binary),mimeType:'audio/webm'});};});
   recorder.start();setTimeout(()=>{if(recorder.state==='recording')recorder.stop();},message.duration*1000);return {started:true};
  })().then(respond).catch(()=>{recording=null;respond({error:'Chrome could not capture this tab’s audio. Activate BopIt from its toolbar icon and try again.'});});return true;
 }
 if(message.type==='BOPIT_AUDIO_COLLECT'){if(!recording){respond({error:'No audio recording is running.'});return;}recording.then(respond).finally(()=>recording=null);return true;}
});
