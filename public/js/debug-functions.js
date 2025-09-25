// public/js/signaling-debug.js
import {
  addDoc, setDoc, serverTimestamp, collection, doc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ---------- JSON-safe (strip undefined/functions) ---------- */
function sanitize(v) {
  if (v === null || typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map(sanitize);
  const out = {};
  for (const [k, val] of Object.entries(v)) {
    if (val !== undefined && typeof val !== "function") out[k] = sanitize(val);
  }
  return out;
}

/* ---------- Logging ---------- */
const ok   = (label, path, data, extra={}) =>
  console.log(`✅ [SIGNAL OK] ${label}`, { path, ...extra, data });
const fail = (label, path, data, err)   =>
  console.error(`❌ [SIGNAL FAIL] ${label}`, { path, code:err?.code, message:err?.message, data });

/* ---------- Serializers ---------- */
export function serializeOffer(o)  { return o ? { type:o.type,  sdp:o.sdp } : null; }
export function serializeAnswer(a) { return a ? { type:a.type,  sdp:a.sdp } : null; }
export function serializeIceCandidate(c) {
  // Skip final/null ICE
  if (!c || !c.candidate) return null;
  return {
    candidate: c.candidate,
    sdpMid: c.sdpMid ?? null,
    sdpMLineIndex: (typeof c.sdpMLineIndex === "number" ? c.sdpMLineIndex : null),
  };
}

/* ---------- Safe writers ---------- */
export async function safeAdd(colRef, data, label="add") {
  const body = sanitize({ ...data, ts: serverTimestamp() });
  try { const res = await addDoc(colRef, body); ok(label, colRef.path, body, { id:res.id }); return res; }
  catch (e) { fail(label, colRef.path, body, e); throw e; }
}

export async function safeSet(docRef, data, label="set") {
  const body = sanitize({ ...data, ts: serverTimestamp() });
  try { await setDoc(docRef, body, { merge:true }); ok(label, docRef.path, body); }
  catch (e) { fail(label, docRef.path, body, e); throw e; }
}

/* Choose addDoc vs setDoc by path length (odd=collection, even=document) */
export async function safeSendSignal(ref, data, label="signal") {
  const path = ref?.path || "";
  const isCollection = (typeof path === "string" && path.split("/").length % 2 === 1);
  return isCollection ? safeAdd(ref, data, label) : safeSet(ref, data, label);
}

/* ---------- Common refs ---------- */
export function makeChannelRefs(db, sid) {
  const base = doc(db, "liveStreamSignals", sid);
  return {
    baseDoc: base,
    offersRef: collection(base, "offers"),      // optional (not used by default)
    answersRef: collection(base, "answers"),
    candRef: collection(base, "candidates"),
  };
}
