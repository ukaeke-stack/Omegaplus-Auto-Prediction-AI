(()=>{"use strict";
const $=s=>document.querySelector(s);
const esc=v=>String(v??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
let conversationId=null,busy=false,pendingBooking=null;
async function api(url,options={}) {
  const response=await fetch(url,{credentials:"same-origin",...options,headers:{"Content-Type":"application/json",...(options.headers||{})}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data.ok)throw new Error(data.error||"AI assistant request failed.");
  return data;
}
function status(message){const el=$("#aiChatStatus");if(el)el.textContent=message}
function scrollBottom(){const box=$("#aiChatMessages");if(box)box.scrollTop=box.scrollHeight}
function appendBookingPreview(preview){
 const box=$("#aiChatMessages");if(!box||!preview)return;
 pendingBooking=preview;
 const request=preview.request||{},selections=Array.isArray(preview.selections)?preview.selections:[];
 const html='<article class="ai-chat-booking-preview"><div class="ai-chat-booking-heading"><strong>Booking slip review</strong><span>'+selections.length+' qualified</span></div><p>'+esc(request.marketLabel||"Requested market")+' · '+esc((request.dateLabels||[]).join(", "))+'</p><details class="ai-chat-booking-details"><summary>Review '+selections.length+' selected fixtures</summary><div class="ai-chat-booking-list">'+selections.map((s,i)=>'<div class="ai-chat-booking-row"><b>'+String(i+1).padStart(2,"0")+'. '+esc(s.home)+' vs '+esc(s.away)+'</b><small>'+esc(s.league||"League unavailable")+' · '+esc(s.date||"Date unavailable")+' · '+esc(s.pick||"Selection")+' · Odds '+esc(Number(s.odds)>1?Number(s.odds).toFixed(2):"unavailable")+'</small></div>').join("")+'</div></details>'+(preview.warnings||[]).map(w=>'<p class="ai-chat-booking-warning">'+esc(w)+'</p>').join("")+'<p class="ai-chat-booking-warning">You can ask me to find more or add another market. I will not change your requested option unless you ask.</p><button type="button" class="primary" id="aiChatGenerateCode">Generate booking code</button><div id="aiChatBookingStatus" role="status"></div></article>';
 box.insertAdjacentHTML("beforeend",html);
 $("#aiChatGenerateCode").addEventListener("click",generateChatBookingCode);
 scrollBottom();
}
async function generateChatBookingCode(){
 if(busy||!pendingBooking)return;
 const btn=$("#aiChatGenerateCode"),statusEl=$("#aiChatBookingStatus");
 busy=true;btn.disabled=true;statusEl.textContent="Rechecking selected markets and requesting a SportyBet code…";status(statusEl.textContent);
 try{
  const result=await api("/api/assistant/booking-code",{method:"POST",body:JSON.stringify({conversationId,selections:pendingBooking.selections.map(s=>({eventId:s.eventId,home:s.home,away:s.away,pick:s.pick,marketId:s.marketId,specifier:s.specifier,outcomeId:s.outcomeId,date:s.date}))})});
  conversationId=result.conversationId||conversationId;pendingBooking=null;
  const history=await api("/api/assistant/conversations/"+encodeURIComponent(conversationId));
  renderMessages(history.messages||[]);
  const box=$("#aiChatMessages");
  const codeHtml='<article class="ai-chat-booking-code"><small>SPORTYBET BOOKING CODE</small><strong>'+esc(result.bookingCode)+'</strong><div class="ai-chat-actions"><button type="button" class="secondary" id="aiChatCopyCode">Copy code</button>'+(result.shareURL?'<a class="secondary ai-chat-share-link" href="'+esc(result.shareURL)+'" target="_blank" rel="noopener">Open shared slip</a>':"")+'</div><p>Verify the shared slip and current odds on SportyBet before placing a bet. No bet has been placed.</p></article>';
  box?.insertAdjacentHTML("beforeend",codeHtml);
  $("#aiChatCopyCode")?.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(result.bookingCode);$("#aiChatCopyCode").textContent="Copied"}catch{status("Copy was unavailable. Booking code: "+result.bookingCode)}});
  status("Booking code generated successfully by SportyBet.");
 }catch(error){
  status(error.message);
  if(statusEl)statusEl.textContent=error.message;
  if(btn){btn.disabled=false;btn.textContent="Try booking code again"}
 }finally{busy=false;$("#aiChatSend").disabled=false;$("#aiChatMic").disabled=false;$("#aiChatNew").disabled=false}
}
function renderMessages(messages){
 const box=$("#aiChatMessages");if(!box)return;
 if(!messages.length){box.innerHTML='<div class="ai-chat-empty">Ask about Omegaplus features, football markets, prediction methods, or how to use the app. Live odds and fixtures must be checked in the analyzer.</div>';return}
 box.innerHTML=messages.map(m=>'<article class="ai-chat-message '+(m.role==="user"?"user":"assistant")+'"><small>'+(m.role==="user"?"YOU":"OMEGAPLUS AI")+'</small><div>'+esc(m.content).replace(/\n/g,"<br>")+'</div>'+(m.provider?'<small class="ai-chat-provider">Provider: '+esc(m.provider)+'</small>':"")+'</article>').join("");
 scrollBottom();
}
async function loadHistory(){
 try{
  const data=await api("/api/assistant/conversations");
  if(!data.conversations.length){conversationId=null;renderMessages([]);status("Ready. Your conversation will be saved to your account.");return}
  conversationId=data.conversations[0].id;
  const history=await api("/api/assistant/conversations/"+encodeURIComponent(conversationId));
  renderMessages(history.messages||[]);
  status("Previous conversation restored.");
 }catch(error){status(error.message==="Login required."?"Sign in to use saved AI conversations.":error.message)}
}
async function sendMessage(){
 if(busy)return;
 const input=$("#aiChatInput"),message=String(input?.value||"").trim();
 if(!message){status("Type a message first.");return}
 if(message.length>2000){status("Keep each message under 2,000 characters.");return}
 if(pendingBooking&&/\\b(generate|create|make|get|give)\\b.{0,35}\\b(booking\\s*code|code)\\b/i.test(message)){
   input.value="";
   const box=$("#aiChatMessages");
   if(box)box.insertAdjacentHTML("beforeend",'<article class="ai-chat-message user"><small>YOU</small><div>'+esc(message)+'</div></article>');
   scrollBottom();
   await generateChatBookingCode();
   return;
 }
 busy=true;$("#aiChatSend").disabled=true;$("#aiChatMic").disabled=true;$("#aiChatNew").disabled=true;
 const box=$("#aiChatMessages");
 if(box&&box.querySelector(".ai-chat-empty"))box.innerHTML="";
 const existing=box?.innerHTML||"";
 if(box)box.innerHTML=existing+'<article class="ai-chat-message user"><small>YOU</small><div>'+esc(message).replace(/\n/g,"<br>")+'</div></article><article class="ai-chat-message assistant pending"><small>OMEGAPLUS AI</small><div>Thinking…</div></article>';
 input.value="";scrollBottom();status("Trying the configured AI providers…");
 try{
  const result=await api("/api/assistant/chat",{method:"POST",body:JSON.stringify({message,conversationId})});
  conversationId=result.conversationId;
  const history=await api("/api/assistant/conversations/"+encodeURIComponent(conversationId));
  renderMessages(history.messages||[]);
  if(result.bookingPreview)appendBookingPreview(result.bookingPreview);
  status(result.provider==="booking-assistant"?"Booking request prepared. Review the selections before generating a code.":"Answered by "+result.provider+(result.fallbackUsed?" after a provider fallback.":".")); 
  if($("#aiChatSpeak")?.checked&&window.SpeechSynthesisUtterance){try{speechSynthesis.cancel();speechSynthesis.speak(new SpeechSynthesisUtterance(result.reply))}catch{}}
 }catch(error){
  if(box){const pending=box.querySelector(".pending");if(pending)pending.remove()}
  status(error.message);
 }finally{busy=false;$("#aiChatSend").disabled=false;$("#aiChatMic").disabled=false;$("#aiChatNew").disabled=false;input.focus()}
}
function listen(){
 const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!SR){status("Voice input is not supported by this browser. Type your message instead.");return}
 const rec=new SR();rec.lang="en-NG";rec.continuous=true;rec.interimResults=true;rec.maxAlternatives=1;
 const btn=$("#aiChatMic");btn.disabled=true;btn.textContent="Listening…";
 let transcript="",silenceTimer=null,submitted=false;
 const finish=()=>{if(submitted)return;submitted=true;clearTimeout(silenceTimer);try{rec.stop()}catch{};const text=transcript.trim();if(!text){status("I didn't catch a complete message. Please speak again or type it.");return}
 const input=$("#aiChatInput");if(!input)return;input.value=(input.value?input.value+" ":"")+text;input.focus();status("You’ve finished speaking. Sending your message…");sendMessage()};
 rec.onresult=e=>{let combined="";for(let i=0;i<e.results.length;i++){const result=e.results[i];if(result&&result[0])combined+=result[0].transcript+" "}transcript=combined.trim();clearTimeout(silenceTimer);silenceTimer=setTimeout(finish,2200)};
 rec.onerror=e=>{clearTimeout(silenceTimer);status(e.error==="not-allowed"?"Microphone permission was denied. Allow microphone access or type your message.":"Voice input failed. Type your message instead.")};
 rec.onend=()=>{clearTimeout(silenceTimer);btn.disabled=false;btn.textContent="Speak";if(!submitted&&transcript.trim())finish()};
 try{rec.start();status("Listening. I’ll wait for about two seconds of silence before sending your message.")}catch{btn.disabled=false;btn.textContent="Speak";status("Could not start microphone input. Check browser microphone permission and try again.")}
}
function init(){
 const page=$("#page-voice-assistant"),intro=page?.querySelector(".page-title > p");
 if(!page||!intro||$("#aiChatPanel"))return;
 const panel=document.createElement("section");panel.className="ai-chat-panel";panel.id="aiChatPanel";
 panel.innerHTML='<div class="ai-chat-head"><div><small>MULTI-PROVIDER AI</small><h3>Ask Omegaplus AI</h3><p>Groq → Gemini → Ollama Cloud fallback. Conversations are saved to your account.</p></div><button type="button" class="secondary" id="aiChatNew">New chat</button></div><div id="aiChatMessages" class="ai-chat-messages" aria-live="polite"><div class="ai-chat-empty">Loading your conversation…</div></div><div class="ai-chat-compose"><label for="aiChatInput">Message</label><textarea id="aiChatInput" rows="3" maxlength="2000" placeholder="Ask a question or follow up on your previous message…"></textarea><div class="ai-chat-actions"><button type="button" class="secondary" id="aiChatMic">Speak</button><label class="ai-chat-speak"><input type="checkbox" id="aiChatSpeak"> Read replies aloud</label><button type="button" class="primary" id="aiChatSend">Send message</button></div></div><div class="analysis-status" id="aiChatStatus" role="status" aria-live="polite">Connecting to your saved conversations…</div><p class="ai-chat-note">AI replies can be wrong. Booking-code requests show a reviewable slip first; generating a code does not place a bet.</p>';
 intro.insertAdjacentElement("afterend",panel);
 $("#aiChatSend").addEventListener("click",sendMessage);
 $("#aiChatInput").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage()}});
 $("#aiChatMic").addEventListener("click",listen);
 $("#aiChatNew").addEventListener("click",()=>{conversationId=null;pendingBooking=null;renderMessages([]);status("New conversation ready. Your next message will start a saved chat.");$("#aiChatInput").focus()});
 loadHistory();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();