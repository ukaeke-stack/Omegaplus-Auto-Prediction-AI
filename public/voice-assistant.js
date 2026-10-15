(()=>{"use strict";
const $=s=>document.querySelector(s),esc=v=>String(v??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
let lastRequest=null,lastSelections=[],conversationId=null;
async function api(url,options={}){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);try{const r=await fetch(url,{credentials:"same-origin",...options,signal:controller.signal,headers:{"Content-Type":"application/json",...(options.headers||{})}});const d=await r.json().catch(()=>({}));if(!r.ok||!d.ok)throw new Error(d.error||(r.status===401?"Please log in before using the assistant.":"Assistant request failed (HTTP "+r.status+")."));return d}catch(error){if(error.name==="AbortError")throw new Error("The assistant took too long to respond. Please try again.");throw error}finally{clearTimeout(timer)}}
function say(text){const synth=window.speechSynthesis,SR=window.SpeechSynthesisUtterance;if(!synth||!SR)return false;try{const utterance=new SR(String(text||""));utterance.lang="en-NG";utterance.rate=1;utterance.pitch=1;utterance.volume=1;synth.cancel();const voices=synth.getVoices();const voice=voices.find(v=>/^en(-NG|-GB|-US)?$/i.test(v.lang))||voices.find(v=>/^en/i.test(v.lang));if(voice)utterance.voice=voice;utterance.onerror=()=>{const status=$("#assistantHomeStatus")||$("#assistantStatus");if(status)status.textContent="Spoken reply could not play. Tap Speak reply and check your phone media volume.";};synth.speak(utterance);return true}catch{return false}}
function addSpeakButton(target,text){if(!target)return;const b=document.createElement("button");b.type="button";b.className="secondary";b.textContent="🔊 Speak reply";b.style.marginTop="8px";b.setAttribute("aria-label","Play assistant reply aloud");b.addEventListener("click",()=>{if(!say(text)){const status=$("#assistantHomeStatus")||$("#assistantStatus");if(status)status.textContent="Speech is not supported in this browser. Try Chrome and check text-to-speech settings.";}});target.appendChild(b)}
function setStatus(text){const el=$("#assistantStatus");if(el)el.textContent=text}
function drawSlipImage(code){
 const canvas=document.createElement("canvas"),w=1000,lineH=54,head=230,foot=code?190:90,h=head+lastSelections.length*lineH+foot;
 canvas.width=w;canvas.height=Math.max(700,h);const ctx=canvas.getContext("2d");
 ctx.fillStyle="#07120e";ctx.fillRect(0,0,w,canvas.height);
 ctx.fillStyle="#18e76b";ctx.fillRect(0,0,w,12);
 ctx.fillStyle="#eef5f0";ctx.font="bold 42px system-ui";ctx.fillText("OMEGAPLUS AUTO PREDICTION AI",48,76);
 ctx.fillStyle="#93a79a";ctx.font="24px system-ui";ctx.fillText("SPORTYBET · "+String(lastRequest?.marketLabel||"FOOTBALL SELECTIONS").toUpperCase(),48,122);
 ctx.fillStyle="#18e76b";ctx.font="bold 28px system-ui";ctx.fillText(lastSelections.length+" selections",48,174);
 let y=head;
 lastSelections.forEach((s,i)=>{ctx.fillStyle=i%2?"#0e1b14":"#0b1510";ctx.fillRect(32,y-34,w-64,lineH);ctx.fillStyle="#eef5f0";ctx.font="bold 22px system-ui";ctx.fillText((i+1)+". "+String(s.home+" vs "+s.away).slice(0,60),50,y);ctx.fillStyle="#18e76b";ctx.font="20px system-ui";ctx.fillText("Over 2.5 goals",w-260,y);y+=lineH});
 if(code){ctx.fillStyle="#eef5f0";ctx.font="22px system-ui";ctx.fillText("BOOKING CODE",48,y+25);ctx.fillStyle="#18e76b";ctx.font="bold 40px system-ui";ctx.fillText(code,48,y+80);ctx.fillStyle="#93a79a";ctx.font="18px system-ui";ctx.fillText("Verify selections and odds on SportyBet before placing a bet.",48,y+125)}
 const link=document.createElement("a");link.download="omegaplus-sportybet-slip.png";link.href=canvas.toDataURL("image/png");link.click();
}
function render(d){
 lastRequest=d.request;lastSelections=d.selections||[];
 const box=$("#assistantResults");if(!box)return;
 box.innerHTML='<div class="assistant-result-summary"><b>'+lastSelections.length+' of '+esc(d.request.requestedGames)+' requested games selected</b><small>'+esc(d.request.dateLabels.join(", "))+' · '+esc(d.request.marketLabel)+' · '+esc(d.request.bookmaker)+'</small></div>'+
 (d.warnings||[]).map(w=>'<div class="analysis-status">'+esc(w)+'</div>').join("")+
 '<div class="assistant-fixtures">'+lastSelections.map((s,i)=>'<article class="assistant-fixture"><span>'+String(i+1).padStart(2,"0")+'</span><div><b>'+esc(s.home)+' vs '+esc(s.away)+'</b><small>'+esc(s.league||"League unavailable")+' · '+esc(s.date)+' · '+esc(s.pick)+' · Odds '+esc(s.odds||"—")+'</small></div></article>').join("")+'</div>'+
 '<div class="control-actions"><button class="primary" id="assistantGenerateCode" '+(lastSelections.length?"":"disabled")+'>Generate SportyBet booking code</button><button class="secondary" id="assistantImage">Save slip image</button></div><div class="analysis-status" id="assistantBookingStatus">Review the selected fixtures before generating a booking code.</div><div id="assistantBookingResult" hidden></div>';
 $("#assistantImage").onclick=()=>drawSlipImage("");
 $("#assistantGenerateCode").onclick=generateCode;
 setStatus(d.message||"Selections ready for review.");
}
function showHomeStatus(text){const host=$(".assistant-home-launch");if(!host)return;let status=$("#assistantHomeStatus");if(!status){status=document.createElement("div");status.id="assistantHomeStatus";status.className="analysis-status";status.setAttribute("role","status");status.setAttribute("aria-live","polite");host.appendChild(status)}status.textContent=text;return status}
function showHomeReply(text,isError=false){const host=$(".assistant-home-launch");if(!host)return;let reply=$("#assistantHomeReply");if(!reply){reply=document.createElement("div");reply.id="assistantHomeReply";reply.className="assistant-result-summary";host.appendChild(reply)}reply.hidden=false;reply.textContent=text;reply.style.whiteSpace="pre-wrap";reply.style.overflowWrap="anywhere";reply.style.borderLeft=isError?"3px solid #ef4444":"3px solid #18e76b";reply.style.padding="10px 12px";return reply}
function openAssistantPage(){document.querySelectorAll(".page").forEach(p=>p.classList.remove("active-page"));$("#page-voice-assistant")?.classList.add("active-page");document.querySelectorAll("[data-page]").forEach(x=>x.classList.toggle("active",x.dataset.page==="voice-assistant"))}
async function submitPrompt(options={}){
 const home=Boolean(options.home),input=$("#assistantPrompt"),prompt=String(options.prompt??input?.value??"").trim();
 if(!prompt){if(home)showHomeStatus("Type or say what you want help with.");else setStatus("Type or say what you want help with.");return}
 if(input&&options.prompt!==undefined)input.value=prompt;
 const btn=$("#assistantSubmit");if(btn)btn.disabled=true;
 if(home)showHomeStatus("Sending your request to Omegaplus AI…");else setStatus("Sending your request to Omegaplus AI…");
 const results=$("#assistantResults");if(results)results.innerHTML="";
 try{
  const d=await api("/api/assistant/chat",{method:"POST",body:JSON.stringify({message:prompt,conversationId})});
  conversationId=d.conversationId||conversationId;
  if(d.bookingPreview){
   openAssistantPage();
   const preview=d.bookingPreview;
   render({request:preview.request,selections:preview.selections||[],warnings:preview.warnings||[],message:d.reply});
   return;
  }
  const reply=String(d.reply||"I received your message, but no reply was returned. Please try again.");
  if(home){const homeReply=showHomeReply(reply);addSpeakButton(homeReply,reply);showHomeStatus("Answered by "+String(d.provider||"Omegaplus AI")+(d.fallbackUsed?" after a provider fallback.":"."));}
  else{if(results){results.innerHTML='<article class="assistant-fixture assistant-conversation-reply"><div><b>OMEGAPLUS AI</b><p>'+esc(reply)+'</p></div></article>';addSpeakButton(results.querySelector(".assistant-conversation-reply"),reply);}setStatus("Answered by "+String(d.provider||"Omegaplus AI")+(d.fallbackUsed?" after a provider fallback.":"."));}
  if(!say(reply)){if(home)showHomeStatus("Reply displayed. Tap Speak reply to hear it aloud.");else setStatus("Reply displayed. Tap Speak reply to hear it aloud.");}
 }catch(e){
  if(home){showHomeStatus("Assistant request failed.");showHomeReply(e.message||"The assistant could not respond. Please try again.",true);}
  else{setStatus(e.message||"The assistant could not respond. Please try again.");if(results)results.innerHTML='<article class="assistant-fixture assistant-conversation-reply"><div><b>ASSISTANT ERROR</b><p>'+esc(e.message||"The assistant could not respond. Please try again.")+'</p></div></article>';}
  say(e.message||"The assistant could not respond. Please try again.");
 }finally{if(btn)btn.disabled=false}
}
async function generateCode(){
 const btn=$("#assistantGenerateCode"),status=$("#assistantBookingStatus");btn.disabled=true;status.textContent="Checking current SportyBet markets and requesting a booking code…";
 try{
  const d=await api("/api/booking-code",{method:"POST",body:JSON.stringify({sport:"football",bookmaker:"sportybet",selections:lastSelections.map(s=>({eventId:s.eventId,home:s.home,away:s.away,pick:s.pick,marketId:s.marketId,specifier:s.specifier,outcomeId:s.outcomeId,date:s.date}))})});
  status.textContent="Booking code created. Verify the slip and odds on SportyBet before placing a bet.";
  const result=$("#assistantBookingResult");result.hidden=false;result.innerHTML='<div class="assistant-code"><small>SPORTYBET BOOKING CODE</small><strong>'+esc(d.bookingCode)+'</strong><button type="button" class="secondary" id="assistantCopyCode">Copy code</button></div>'+(d.shareURL?'<p><a href="'+esc(d.shareURL)+'" target="_blank" rel="noopener">Open SportyBet shared slip</a></p>':"")+'<button type="button" class="primary full" id="assistantCodeImage">Save slip image with code</button>';
  $("#assistantCopyCode").onclick=async()=>{try{await navigator.clipboard.writeText(d.bookingCode);$("#assistantCopyCode").textContent="Copied"}catch{status.textContent="Code: "+d.bookingCode}};
  $("#assistantCodeImage").onclick=()=>drawSlipImage(d.bookingCode);
  say("Your SportyBet booking code is ready.");
 }catch(e){status.textContent=e.message; if(/paid|subscription|plan/i.test(e.message))status.textContent=e.message+" You can review the selected games, but code generation follows your account's booking-code access.";say(e.message)}
 finally{btn.disabled=false}
}
function voice(promptSelector="#assistantPrompt",buttonSelector="#assistantMic"){
 const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!SR){setStatus("Voice input is not supported by this browser. You can type the request instead.");return}
 const rec=new SR();rec.lang="en-NG";rec.interimResults=false;rec.maxAlternatives=1;
 const b=$(buttonSelector);if(!b)return;b.disabled=true;b.textContent="Listening…";
 rec.onresult=e=>{const input=$(promptSelector),transcript=String(e.results?.[0]?.[0]?.transcript||"").trim();if(!input||!transcript){setStatus("I could not hear a clear request. Please try again or type it.");return}input.value=transcript;if(promptSelector==="#assistantPromptHome"){showHomeStatus("Voice captured. Sending your request to Omegaplus AI…");submitPrompt({prompt:transcript,home:true})}else{setStatus("Voice captured. Sending your request to Omegaplus AI…");submitPrompt({prompt:transcript})}};
 rec.onerror=e=>setStatus(e.error==="not-allowed"?"Microphone permission was denied. Allow microphone access or type your request.":"Voice input failed. You can type the request instead.");
 rec.onend=()=>{b.disabled=false;b.textContent="🎙 Speak";};
 try{rec.start()}catch(error){b.disabled=false;b.textContent="🎙 Speak";setStatus("Could not start microphone input. Check browser microphone permission and try again.");}
}
function init(){
 const nav=document.querySelector(".side-nav");
 if(nav&&!nav.querySelector('[data-page="voice-assistant"]')){const b=document.createElement("button");b.dataset.page="voice-assistant";b.innerHTML="⌕ <span>Voice & Text Assistant</span>";nav.insertBefore(b,nav.children[1]||null)}
 document.querySelectorAll('[data-page="voice-assistant"]').forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".page").forEach(p=>p.classList.remove("active-page"));$("#page-voice-assistant")?.classList.add("active-page");document.querySelectorAll("[data-page]").forEach(x=>x.classList.toggle("active",x.dataset.page==="voice-assistant"));$("#side")?.classList.remove("open");$("#backdrop")?.classList.remove("show")}));
 $("#assistantSubmit")?.addEventListener("click",submitPrompt);
 $("#assistantPrompt")?.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();submitPrompt()}});
 $("#assistantMic")?.addEventListener("click",()=>voice("#assistantPrompt","#assistantMic"));
 $("#assistantMicHome")?.addEventListener("click",()=>voice("#assistantPromptHome","#assistantMicHome"));
 $("#assistantLaunch")?.addEventListener("click",()=>{const home=$("#assistantPromptHome");submitPrompt({prompt:home?.value||"",home:true})});
 $("#assistantPromptHome")?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();$("#assistantLaunch")?.click()}});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();