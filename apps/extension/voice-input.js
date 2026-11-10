export function attachVoiceInput({input, button, status, Recognition = window.SpeechRecognition || window.webkitSpeechRecognition, onTranscript = () => {}}) {
  let recognition = null, listening = false;
  const reset = () => { listening=false;button.textContent='🎤';button.setAttribute('aria-label','Speak your request');button.setAttribute('aria-pressed','false'); };
  function cancel() { if(recognition){recognition.onresult=null;recognition.onerror=null;recognition.onend=null;try{recognition.abort();}catch{/* A stopped service may already be closed. */}recognition=null;}reset(); }
  button.onclick=()=>{
    if(listening){recognition?.stop();return;}
    if(!Recognition){status.textContent='Voice input isn’t available in this browser. Please type your request.';return;}
    cancel();
    try {
      const session = new Recognition();recognition=session;listening=true;
      session.lang=document.documentElement.lang||navigator.language||'en-US';session.continuous=false;session.interimResults=true;
      let received=false;
      button.textContent='Stop';button.setAttribute('aria-label','Stop listening');button.setAttribute('aria-pressed','true');
      status.textContent='Listening… Speak your request, then review the text before pressing Find.';
      session.onresult=event=>{
        if(recognition!==session)return;
        const transcript=Array.from(event.results).map(result=>result[0]?.transcript||'').join(' ').trim().slice(0,input.maxLength>0?input.maxLength:2500);
        if(!transcript)return;
        input.value=transcript;received=true;onTranscript();
        status.textContent='Review your words, then press Find. You can edit them first.';
      };
      session.onerror=event=>{
        if(recognition!==session)return;
        const messages={'not-allowed':'Microphone access was blocked. Allow it in Chrome or type your request.','service-not-allowed':'Voice input is blocked here. You can still type your request.','audio-capture':'No microphone was found. Connect one or type your request.','network':'Voice input couldn’t connect. Try again or type your request.','no-speech':'No speech was detected. Tap the microphone to try again.'};
        status.textContent=messages[event.error]||'Voice input stopped. Try again or type your request.';recognition=null;reset();
      };
      session.onend=()=>{if(recognition!==session)return;recognition=null;reset();if(!received)status.textContent='No words captured. Try again or type your request.';};
      session.start();
    }catch{cancel();status.textContent='Voice input couldn’t start here. Please type your request.';}
  };
  input.addEventListener('input',()=>{if(listening){cancel();status.textContent='Edit your request, then press Find.';}});
  window.addEventListener('pagehide',cancel);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();});
  return {cancel};
}
