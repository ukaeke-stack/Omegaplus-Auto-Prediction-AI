import pg from "pg";

const {Pool}=pg;
let pool=null;
let schemaPromise=null;

function getPool(){
  if(!process.env.DATABASE_URL)return null;
  if(!pool){
    pool=new Pool({connectionString:process.env.DATABASE_URL,max:4,idleTimeoutMillis:30000,connectionTimeoutMillis:5000,ssl:process.env.DATABASE_SSL==="false"?false:{rejectUnauthorized:false}});
    pool.on("error",err=>console.error("Offline sync PostgreSQL pool error:",err.message));
  }
  return pool;
}

export async function initOfflineSyncDb(){
  const p=getPool();
  if(!p)return false;
  if(!schemaPromise)schemaPromise=p.query(`
    CREATE TABLE IF NOT EXISTS user_offline_records(
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      record_key text NOT NULL,
      payload jsonb NOT NULL,
      client_updated_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY(user_id,record_key)
    );
    CREATE INDEX IF NOT EXISTS user_offline_records_updated_idx ON user_offline_records(user_id,updated_at DESC);
  `).catch(err=>{schemaPromise=null;throw err});
  await schemaPromise;
  return true;
}

function validateRecord(record){
  const key=String(record?.key||"");
  if(!/^(settings|slip:(football|basketball))$/.test(key))throw new Error("Unsupported offline record key.");
  if(!record.payload||typeof record.payload!=="object")throw new Error("Offline record payload must be an object or array.");
  const bytes=Buffer.byteLength(JSON.stringify(record.payload),"utf8");
  if(bytes>65536)throw new Error("Offline record is too large.");
  const parsed=Date.parse(record.clientUpdatedAt);
  if(!Number.isFinite(parsed))throw new Error("Offline record timestamp is invalid.");
  return {key,payload:record.payload,clientUpdatedAt:new Date(parsed).toISOString()};
}

export async function readOfflineRecords(userId){
  await initOfflineSyncDb();
  const p=getPool();
  if(!p)throw new Error("Offline sync database is unavailable.");
  const result=await p.query("SELECT record_key,payload,client_updated_at,updated_at FROM user_offline_records WHERE user_id=$1",[userId]);
  return result.rows.map(row=>({key:row.record_key,payload:row.payload,clientUpdatedAt:row.client_updated_at,updatedAt:row.updated_at}));
}

export async function writeOfflineRecords(userId,records){
  if(!Array.isArray(records)||records.length>10)throw new Error("Send between 1 and 10 offline records.");
  const validated=records.map(validateRecord);
  await initOfflineSyncDb();
  const p=getPool();
  if(!p)throw new Error("Offline sync database is unavailable.");
  const client=await p.connect();
  try{
    await client.query("BEGIN");
    for(const item of validated){
      await client.query(`
        INSERT INTO user_offline_records(user_id,record_key,payload,client_updated_at,updated_at)
        VALUES($1,$2,$3::jsonb,$4::timestamptz,now())
        ON CONFLICT(user_id,record_key) DO UPDATE
        SET payload=EXCLUDED.payload,client_updated_at=EXCLUDED.client_updated_at,updated_at=now()
        WHERE user_offline_records.client_updated_at < EXCLUDED.client_updated_at
      `,[userId,item.key,JSON.stringify(item.payload),item.clientUpdatedAt]);
    }
    await client.query("COMMIT");
  }catch(error){
    await client.query("ROLLBACK");
    throw error;
  }finally{client.release()}
  return readOfflineRecords(userId);
}
