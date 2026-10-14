import pg from "pg";
import crypto from "node:crypto";

const {Pool}=pg;
let pool=null,initPromise=null;
function getPool(){
  if(!process.env.DATABASE_URL)return null;
  if(!pool){pool=new Pool({connectionString:process.env.DATABASE_URL,max:3,idleTimeoutMillis:30000,connectionTimeoutMillis:5000,ssl:process.env.DATABASE_SSL==="false"?false:{rejectUnauthorized:false}});pool.on("error",e=>console.error("Social publishing database error:",e.message));}
  return pool;
}
export async function initSocialPublishingDb(){
  const p=getPool();if(!p)return false;
  if(!initPromise)initPromise=p.query(`
    CREATE TABLE IF NOT EXISTS social_post_log(
      id bigserial PRIMARY KEY,
      platform text NOT NULL,
      post_date date NOT NULL,
      status text NOT NULL CHECK(status IN ('publishing','published','failed','skipped')),
      message text NOT NULL,
      external_post_id text,
      error_message text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(platform,post_date)
    );
    CREATE INDEX IF NOT EXISTS social_post_log_date_idx ON social_post_log(post_date DESC,created_at DESC);
  `).catch(e=>{initPromise=null;throw e});
  await initPromise;return true;
}
function oauthEncode(value){return encodeURIComponent(String(value)).replace(/[!'()*]/g,c=>"%"+c.charCodeAt(0).toString(16).toUpperCase())}
function oauthHeader(method,url,consumerKey,consumerSecret,accessToken,accessSecret){
  const oauth={oauth_consumer_key:consumerKey,oauth_nonce:crypto.randomBytes(16).toString("hex"),oauth_signature_method:"HMAC-SHA1",oauth_timestamp:String(Math.floor(Date.now()/1000)),oauth_token:accessToken,oauth_version:"1.0"};
  const params=Object.entries(oauth).map(([k,v])=>[oauthEncode(k),oauthEncode(v)]).sort((a,b)=>a[0].localeCompare(b[0])||a[1].localeCompare(b[1])).map(([k,v])=>k+"="+v).join("&");
  const base=method.toUpperCase()+"&"+oauthEncode(url)+"&"+oauthEncode(params);
  const key=oauthEncode(consumerSecret)+"&"+oauthEncode(accessSecret);
  oauth.oauth_signature=crypto.createHmac("sha1",key).update(base).digest("base64");
  return "OAuth "+Object.entries(oauth).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>oauthEncode(k)+'="'+oauthEncode(v)+'"').join(", ");
}
async function publishFacebook(message,date){
  const pageId=process.env.FACEBOOK_PAGE_ID||"",token=process.env.FACEBOOK_PAGE_ACCESS_TOKEN||"";
  if(!pageId||!token)return {platform:"facebook",status:"skipped",reason:"Facebook Page credentials are not configured."};
  const url="https://graph.facebook.com/v22.0/"+encodeURIComponent(pageId)+"/feed";
  const response=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message,access_token:token})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data.id)throw new Error("Facebook publishing failed (HTTP "+response.status+"): "+String(data.error?.message||"No post ID returned").slice(0,220));
  return {platform:"facebook",status:"published",externalPostId:String(data.id)};
}
async function publishX(message){
  const ck=process.env.X_API_KEY||"",cs=process.env.X_API_SECRET||"",at=process.env.X_ACCESS_TOKEN||"",as=process.env.X_ACCESS_TOKEN_SECRET||"";
  if(!ck||!cs||!at||!as)return {platform:"x",status:"skipped",reason:"X write credentials are not configured."};
  const url="https://api.x.com/2/tweets";
  const response=await fetch(url,{method:"POST",headers:{Authorization:oauthHeader("POST",url,ck,cs,at,as),"Content-Type":"application/json"},body:JSON.stringify({text:message.slice(0,280)})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data.data?.id)throw new Error("X publishing failed (HTTP "+response.status+"): "+String(data.detail||data.title||"No post ID returned").slice(0,220));
  return {platform:"x",status:"published",externalPostId:String(data.data.id)};
}
async function claim(platform,date,message){
  const p=getPool();await initSocialPublishingDb();
  const result=await p.query(`INSERT INTO social_post_log(platform,post_date,status,message) VALUES($1,$2,'publishing',$3)
    ON CONFLICT(platform,post_date) DO UPDATE SET status='publishing',message=EXCLUDED.message,error_message=NULL,updated_at=now()
    WHERE social_post_log.status IN ('failed','skipped')
    RETURNING id`,[platform,date,message]);
  return result.rows[0]?.id||null;
}
async function saveResult(platform,date,message,result){
  const p=getPool();
  await p.query(`INSERT INTO social_post_log(platform,post_date,status,message,external_post_id,error_message)
    VALUES($1,$2,$3,$4,$5,$6)
    ON CONFLICT(platform,post_date) DO UPDATE SET status=EXCLUDED.status,message=EXCLUDED.message,
    external_post_id=EXCLUDED.external_post_id,error_message=EXCLUDED.error_message,updated_at=now()`,
  [platform,date,result.status,message,result.externalPostId||null,result.reason||result.error||null]);
}
export async function publishDailyBestToSocials(date,message){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date)))throw new Error("Invalid post date.");
  if(!String(message||"").trim())throw new Error("Daily Best post message is empty.");
  await initSocialPublishingDb();
  const p=getPool();if(!p)throw new Error("DATABASE_URL is required for duplicate-safe social publishing.");
  const outcomes=[];
  for(const platform of ["facebook","x"]){
    const already=await p.query("SELECT status,external_post_id FROM social_post_log WHERE platform=$1 AND post_date=$2",[platform,date]);
    if(already.rows[0]?.status==="published"){outcomes.push({platform,status:"skipped",reason:"Already published for this date.",externalPostId:already.rows[0].external_post_id});continue;}
    const id=await claim(platform,date,message);
    if(!id){outcomes.push({platform,status:"skipped",reason:"A post for this date is already in progress or has already been published."});continue;}
    try{
      const result=platform==="facebook"?await publishFacebook(message,date):await publishX(message);
      await saveResult(platform,date,message,result);outcomes.push(result);
    }catch(error){
      const result={platform,status:"failed",error:String(error.message||error).slice(0,500)};
      await saveResult(platform,date,message,result);outcomes.push(result);
    }
  }
  return {date,outcomes};
}
export async function getSocialPublishingStatus(){
  const p=getPool();if(!p)return {configured:false,facebook:{configured:false},x:{configured:false},recent:[]};
  await initSocialPublishingDb();
  const recent=await p.query("SELECT platform,post_date,status,external_post_id,error_message,created_at,updated_at FROM social_post_log ORDER BY created_at DESC LIMIT 20");
  return {configured:true,facebook:{configured:Boolean(process.env.FACEBOOK_PAGE_ID&&process.env.FACEBOOK_PAGE_ACCESS_TOKEN)},x:{configured:Boolean(process.env.X_API_KEY&&process.env.X_API_SECRET&&process.env.X_ACCESS_TOKEN&&process.env.X_ACCESS_TOKEN_SECRET)},recent:recent.rows};
}
