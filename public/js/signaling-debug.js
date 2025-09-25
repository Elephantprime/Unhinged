import { addDoc, setDoc, serverTimestamp, collection, doc }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// JSON-safe only
const cleanse = (v)=> (v===null||typeof v!=="object")?v:
  Array.isArray(v)?v.map(cleanse):
  Object.fromEntries(Object.entries(v).filter(([k,val])=>val!==undefined && typeof val!=="function").map(([k,val])=>[k,cleanse(val)]));

const ok=(l,p,d,e={})=>console.log(`✅ [SIGNAL OK] ${l}`,{path:p,...e,data:d});
const fail=(l,p,d,e)=>console.error(`❌ [SIGNAL FAIL] ${l}`,{path:p,code:e?.code,message:e?.message,data:d});

export const serializeOffer  = o => o?({type:o.type,sdp:o.sdp}):null;
export const serializeAnswer = a => a?({type:a.type,sdp:a.sdp}):null;
export const serializeIceCandidate = c => (!c||!c.candidate)?null:{
  candidate:c.candidate, sdpMid:c.sdpMid ?? null,
  sdpMLineIndex: (typeof c.sdpMLineIndex==="number"?c.sdpMLineIndex:null)
};

export async function safeAdd(colRef,data,label="add"){
  const body=cleanse({...data,ts:serverTimestamp()});
  try{ const res=await addDoc(colRef,body); ok(label,colRef.path,body,{id:res.id}); return res; }
  catch(e){ fail(label,colRef.path,body,e); throw e; }
}
export async function safeSet(docRef,data,label="set"){
  const body=cleanse({...data,ts:serverTimestamp()});
  try{ await setDoc(docRef,body,{merge:true}); ok(label,docRef.path,body); }
  catch(e){ fail(label,docRef.path,body,e); throw e; }
}
export async function safeSendSignal(ref,data,label="signal"){
  const path=ref?.path||""; const isCol=(typeof path==="string"&&path.split("/").length%2===1);
  return isCol?safeAdd(ref,data,label):safeSet(ref,data,label);
}
export function makeChannelRefs(db, sid){
  const base = doc(db,"liveStreamSignals",sid);
  return { baseDoc:base, answersRef:collection(base,"answers"), candRef:collection(base,"candidates") };
}
