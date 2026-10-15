function lagosDateKey(now=new Date()){
  const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Africa/Lagos",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);
  const values=Object.fromEntries(parts.filter(x=>x.type!=="literal").map(x=>[x.type,x.value]));
  return values.year+"-"+values.month+"-"+values.day;
}
function shiftDateKey(baseDate,offset){
  if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(baseDate))throw new Error("Invalid base date.");
  const [year,month,day]=baseDate.split("-").map(Number);
  return new Date(Date.UTC(year,month-1,day+offset,12)).toISOString().slice(0,10);
}
function parseCriteria(text){
  const q=text.toLowerCase(),criteria=[];
  const add=(c)=>{if(!criteria.some(x=>JSON.stringify(x)===JSON.stringify(c)))criteria.push(c)};
  const lineRe=/\\b(over|under)\\s*(?:total\\s*)?(?:(goals?|corners?|cards?|bookings?)\\s*)?(\\d+(?:\\.\\d+)?)\\b/gi;
  for(const m of q.matchAll(lineRe)){
    const surrounding=q.slice(m.index,Math.min(q.length,m.index+m[0].length+18));
    const category=/corner/.test((m[2]||"")+" "+surrounding)?"corners":/card|booking/.test((m[2]||"")+" "+surrounding)?"cards":"goals";
    add({type:category,direction:m[1].toLowerCase(),line:Number(m[3]),label:(m[1][0].toUpperCase()+m[1].slice(1))+" "+m[3]+(category==="goals"?" goals":category==="corners"?" corners":" cards")});
  }
  if(/\\b(btts|both teams to score)\\b/.test(q)){
    const no=/\\b(btts|both teams to score)\\s*(?:no|not)\\b|\\bno\\s+(?:btts|both teams to score)\\b/.test(q);
    add({type:"btts",option:no?"No":"Yes",label:"BTTS "+(no?"No":"Yes")});
  }
  if(/\\b(double chance|1x|x2|12|home or draw|draw or away|home or away)\\b/.test(q)){
    let option=/\\b(x2|draw or away)\\b/.test(q)?"X2":/\\b(12|home or away)\\b/.test(q)?"12":"1X";
    add({type:"double_chance",option,label:"Double Chance "+option});
  }
  if(/\\b(draw no bet|dnb)\\b/.test(q)){
    const option=/\\b(away|2)\\b/.test(q)?"Away":"Home";
    add({type:"dnb",option,label:"Draw No Bet "+option});
  }
  if(/\\b(1x2|match result|match winner|home win|away win|draw)\\b/.test(q)){
    const option=/\\b(away win|away team|away)\\b/.test(q)?"Away":/\\b(draw|tie)\\b/.test(q)?"Draw":"Home";
    add({type:"1x2",option,label:"1X2 "+option});
  }
  if(/\\b(any market|any option|best games|best picks|mix(?:ed)? markets|mixed options|mix options|all markets)\\b/.test(q))add({type:"any",label:"Best available markets"});
  if(!criteria.length)throw new Error("Which market and option should I search? For example: BTTS Yes, Over 2.5 goals, 1X2 Home, Double Chance 1X, or a mix of markets.");
  for(const c of criteria){
    if(c.line!==undefined&&(!Number.isFinite(c.line)||c.line<0.5||c.line>20))throw new Error("Please specify a valid market line.");
    if(c.type==="goals"&&![0.5,1.5,2.5,3.5,4.5].includes(c.line))throw new Error("Supported goal lines are 0.5, 1.5, 2.5, 3.5 and 4.5.");
  }
  return criteria;
}
export function parseBookingAssistantPrompt(prompt,today=lagosDateKey()){
  const text=String(prompt||"").trim();
  if(!text||text.length>600)throw new Error("Enter a request of up to 600 characters.");
  if(!/sportybet/i.test(text))throw new Error("Please specify SportyBet for booking-code generation.");
  if(!/football|soccer/i.test(text))throw new Error("This assistant request currently supports football fixtures.");
  const countMatch=text.match(/\\b(\\d{1,2})\\s*(?:football\\s*)?(?:games?|matches|fixtures|selections|picks)\\b/i);
  const requestedGames=countMatch?Number(countMatch[1]):1;
  if(requestedGames<1||requestedGames>50)throw new Error("Request between 1 and 50 games.");
  const criteria=parseCriteria(text);
  const mentionsToday=/\\btoday\\b/i.test(text),mentionsTomorrow=/\\btomorrow\\b/i.test(text),mentionsDayAfter=/day\\s+after\\s+tomorrow|next\\s+tomorrow|tomorrow\\s+after\\s+tomorrow/i.test(text);
  const offsets=new Set();
  if(mentionsToday)offsets.add(0);
  if(mentionsTomorrow)offsets.add(1);
  if(mentionsDayAfter)offsets.add(2);
  if(!offsets.size)offsets.add(0);
  const dates=[...offsets].sort((a,b)=>a-b).map(offset=>({offset,date:shiftDateKey(today,offset),label:offset===0?"Today":offset===1?"Tomorrow":"Day after tomorrow"}));
  return {requestedGames,sport:"football",bookmaker:"SportyBet",criteria,marketLabel:criteria.map(c=>c.label).join(" + "),dates};
}
