function lagosDateKey(now=new Date()){
  const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Africa/Lagos",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);
  const values=Object.fromEntries(parts.filter(x=>x.type!=="literal").map(x=>[x.type,x.value]));
  return values.year+"-"+values.month+"-"+values.day;
}
function shiftDateKey(baseDate,offset){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(baseDate))throw new Error("Invalid base date.");
  const [year,month,day]=baseDate.split("-").map(Number);
  return new Date(Date.UTC(year,month-1,day+offset,12)).toISOString().slice(0,10);
}
export function parseBookingAssistantPrompt(prompt,today=lagosDateKey()){
  const text=String(prompt||"").trim();
  if(!text||text.length>600)throw new Error("Enter a request of up to 600 characters.");
  if(!/sportybet/i.test(text))throw new Error("Please specify SportyBet for booking-code generation.");
  if(!/football|soccer/i.test(text))throw new Error("This assistant request currently supports football fixtures.");
  const countMatch=text.match(/\b(\d{1,2})\s*(?:football\s*)?(?:games?|matches|fixtures|selections)\b/i);
  const requestedGames=countMatch?Number(countMatch[1]):1;
  if(requestedGames<1||requestedGames>50)throw new Error("Request between 1 and 50 games.");
  const marketMatch=text.match(/\b(over|under)\s*(?:goals?\s*)?(\d+(?:\.\d+)?)\s*(?:goals?)?\b/i);
  if(!marketMatch)throw new Error("Specify a goals market such as Over 2.5 goals or Under 3.5 goals.");
  const direction=marketMatch[1].toLowerCase(),line=Number(marketMatch[2]);
  if(![0.5,1.5,2.5,3.5,4.5].includes(line))throw new Error("Supported goal lines are 0.5, 1.5, 2.5, 3.5 and 4.5.");
  const mentionsToday=/\btoday\b/i.test(text),mentionsTomorrow=/\btomorrow\b/i.test(text),mentionsDayAfter=/day\s+after\s+tomorrow|next\s+tomorrow|tomorrow\s+after\s+tomorrow/i.test(text);
  const offsets=new Set();
  if(mentionsToday)offsets.add(0);
  if(mentionsTomorrow)offsets.add(1);
  if(mentionsDayAfter)offsets.add(2);
  if(!offsets.size)offsets.add(0);
  const dates=[...offsets].sort((a,b)=>a-b).map(offset=>({offset,date:shiftDateKey(today,offset),label:offset===0?"Today":offset===1?"Tomorrow":"Day after tomorrow"}));
  return {requestedGames,sport:"football",bookmaker:"SportyBet",direction,line,marketLabel:(direction==="over"?"Over ":"Under ")+line+" goals",dates};
}
