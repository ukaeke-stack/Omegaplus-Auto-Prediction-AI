(()=>{"use strict";
const $=s=>document.querySelector(s);
const esc=v=>String(v??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
let conversationId=null,busy=false;
async function api(url,options={}) {
  const response=await fetch(url,{credentials:"same-origin",...options,headers:{"Content-Type":"application/json",...(options.headers||{})}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data.ok)throw new Error(data.error||"AI assistant request failed.");
  return data;
}
function status(message){const el=$("#aiChatStatus");if(el)el.textContent=message}
function scrollBottom(){const box=$("#aiChatMessages");if(box)box.scrollTop=box.scrollHeight}
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
  status("Answered by "+result.provider+(result.fallbackUsed?" after a provider fallback.":".")); 
  if($("#aiChatSpeak")?.checked&&window.SpeechSynthesisUtterance){try{speechSynthesis.cancel();speechSynthesis.speak(new SpeechSynthesisUtterance(result.reply))}catch{}}
 }catch(error){
  if(box){const pending=box.querySelector(".pending");if(pending)pending.remove()}
  status(error.message);
 }finally{busy=false;$("#aiChatSend").disabled=false;$("#aiChatMic").disabled=false;$("#aiChatNew").disabled=false;input.focus()}
}
function listen(){
 const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!SR){status("Voice input is not supported by this browser. Type your message instead.");return}
 const rec=new SR();rec.lang="en-NG";rec.interimResults=false;rec.maxAlternatives=1;
 const btn=$("#aiChatMic");btn.disabled=true;btn.textContent="Listening…";
 rec.onresult=e=>{const input=$("#aiChatInput");if(input)input.value=(input.value?input.value+" ":"")+e.results[0][0].transcript;input?.focus();status("Voice captured. Review your message, then send it.")};
 rec.onerror=e=>status(e.error==="not-allowed"?"Microphone permission was denied. Allow microphone access or type your message.":"Voice input failed. Type your message instead.");
 rec.onend=()=>{btn.disabled=false;btn.textContent="Speak"};
 try{rec.start()}catch{btn.disabled=false;btn.textContent="Speak";status("Could not start microphone input.")}
}
function init(){
 const page=$("#page-voice-assistant"),intro=page?.querySelector(".page-title > p");
 if(!page||!intro||$("#aiChatPanel"))return;
 const panel=document.createElement("section");panel.className="ai-chat-panel";panel.id="aiChatPanel";
 panel.innerHTML='<div class="ai-chat-head"><div><small>MULTI-PROVIDER AI</small><h3>Ask Omegaplus AI</h3><p>Groq → Gemini → Ollama Cloud fallback. Conversations are saved to your account.</p></div><button type="button" class="secondary" id="aiChatNew">New chat</button></div><div id="aiChatMessages" class="ai-chat-messages" aria-live="polite"><div class="ai-chat-empty">Loading your conversation…</div></div><div class="ai-chat-compose"><label for="aiChatInput">Message</label><textarea id="aiChatInput" rows="3" maxlength="2000" placeholder="Ask a question or follow up on your previous message…"></textarea><div class="ai-chat-actions"><button type="button" class="secondary" id="aiChatMic">Speak</button><label class="ai-chat-speak"><input type="checkbox" id="aiChatSpeak"> Read replies aloud</label><button type="button" class="primary" id="aiChatSend">Send message</button></div></div><div class="analysis-status" id="aiChatStatus" role="status" aria-live="polite">Connecting to your saved conversations…</div><p class="ai-chat-note">AI replies can be wrong. It does not place bets or generate booking codes; review live fixtures and odds in the analyzer.</p>';
 intro.insertAdjacentElement("afterend",panel);
 $("#aiChatSend").addEventListener("click",sendMessage);
 $("#aiChatInput").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage()}});
 $("#aiChatMic").addEventListener("click",listen);
 $("#aiChatNew").addEventListener("click",()=>{conversationId=null;renderMessages([]);status("New conversation ready. Your next message will start a saved chat.");$("#aiChatInput").focus()});
 loadHistory();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();