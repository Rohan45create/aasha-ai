/**
 * firestore.js — Centralised Firestore data access layer.
 * Every component imports from here. Nothing queries Firestore directly.
 */
import {
  collection, doc, addDoc, updateDoc, getDoc, getDocs,
  query, where, orderBy, limit, onSnapshot, serverTimestamp,
  arrayUnion
} from 'firebase/firestore';
import { db } from '../firebase';

// ── HOUSEHOLDS ────────────────────────────────────────────────────
export const subscribeToHouseholds = (ashaId, callback) =>
  onSnapshot(
    query(collection(db, 'households'), where('ashaId', '==', ashaId), orderBy('createdAt', 'desc')),
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => { console.error('households subscription error', err); callback([]); }
  );

export const addHousehold = async (data, ashaId) => {
  const ref = await addDoc(collection(db, 'households'), {
    ...data, ashaId, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  });
  return ref.id;
};

export const updateHousehold = async (id, data) =>
  updateDoc(doc(db, 'households', id), { ...data, updatedAt: serverTimestamp() });

// ── HOUSEHOLD MEMBERS ─────────────────────────────────────────────
export const subscribeToMembers = (householdId, callback) =>
  onSnapshot(
    query(collection(db, 'household_members'), where('householdId', '==', householdId)),
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => { console.error('members subscription error', err); callback([]); }
  );

export const addMember = async (data, ashaId) =>
  addDoc(collection(db, 'household_members'), {
    ...data, ashaId, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  });

export const checkAadhaarExists = async (aadhaarHash) => {
  if (!aadhaarHash) return null;
  const q = query(collection(db, 'household_members'), where('aadhaarEncrypted', '==', aadhaarHash));
  const snap = await getDocs(q);
  if (!snap.empty) {
    return { id: snap.docs[0].id, ...snap.docs[0].data() };
  }
  return null;
};

// ── CHILDREN ──────────────────────────────────────────────────────
export const subscribeToChildren = (ashaId, callback) =>
  onSnapshot(
    query(collection(db, 'children'), where('ashaId', '==', ashaId)),
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => { console.error('children subscription error', err); callback([]); }
  );

export const addChild = async (data, ashaId) =>
  addDoc(collection(db, 'children'), {
    ...data, ashaId, riskScore: data.riskScore ?? 50, riskLevel: data.riskLevel ?? 'MEDIUM',
    createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  });

export const updateChild = async (id, data) =>
  updateDoc(doc(db, 'children', id), { ...data, updatedAt: serverTimestamp() });

// ── PREGNANCIES ───────────────────────────────────────────────────
export const subscribeToPregnancies = (ashaId, callback) =>
  onSnapshot(
    query(collection(db, 'pregnancies'), where('ashaId', '==', ashaId)),
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => { console.error('pregnancies subscription error', err); callback([]); }
  );

export const addPregnancy = async (data, ashaId) =>
  addDoc(collection(db, 'pregnancies'), {
    ...data, ashaId, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  });

// ── VISITS ────────────────────────────────────────────────────────
export const addVisit = async (data, ashaId) =>
  addDoc(collection(db, 'visits'), {
    ...data, ashaId, visitDate: serverTimestamp(), createdAt: serverTimestamp()
  });

export const subscribeToVisits = (ashaId, callback) =>
  onSnapshot(
    query(collection(db, 'visits'), where('ashaId', '==', ashaId)),
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => { console.error('visits subscription error', err); callback([]); }
  );

// ── REFERRALS ─────────────────────────────────────────────────────
export const addReferral = async (data, ashaId) =>
  addDoc(collection(db, 'referrals'), {
    ...data, ashaId, status: 'Pending', createdAt: serverTimestamp()
  });

export const subscribeToReferrals = (ashaId, callback) =>
  onSnapshot(
    query(collection(db, 'referrals'), where('ashaId', '==', ashaId), orderBy('createdAt', 'desc')),
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => { console.error('referrals subscription error', err); callback([]); }
  );

// ── EDIT HISTORY (Immutable audit trail) ──────────────────────────
export const logEdit = async (collectionName, documentId, action, data, ashaId) =>
  addDoc(collection(db, 'edit_history'), {
    collectionName, documentId, action,
    data: typeof data === 'object' ? JSON.stringify(data) : String(data),
    ashaId, editedAt: serverTimestamp()
  });

// ── SURVEY TEMPLATES ──────────────────────────────────────────────
export const subscribeToSurveyTemplates = (ashaId, callback) =>
  onSnapshot(
    query(
      collection(db, 'survey_templates'),
      where('isPublished', '==', true),
      where('assignedTo', 'array-contains', ashaId)
    ),
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => { console.error('survey_templates subscription error', err); callback([]); }
  );

export const publishSurveyTemplate = async (data, headId, ashaIds) =>
  addDoc(collection(db, 'survey_templates'), {
    ...data,
    createdBy: headId,
    assignedTo: ashaIds,
    isPublished: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

// ── PRIORITY LIST (children sorted by riskScore descending) ──────
export const subscribeToPriorityList = (ashaId, callback) =>
  onSnapshot(
    query(
      collection(db, 'children'),
      where('ashaId', '==', ashaId),
      where('riskLevel', 'in', ['CRITICAL', 'HIGH', 'MEDIUM']),
      orderBy('riskScore', 'desc'),
      limit(50)
    ),
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => { console.error('priority subscription error', err); callback([]); }
  );

// ── ASHA STATS (real-time home screen counters) ──────────────────
export const subscribeToASHAStats = (ashaId, callback) => {
  const unsubs = [];
  let stats = { families: 0, highRisk: 0, visits: 0 };

  unsubs.push(onSnapshot(
    query(collection(db, 'households'), where('ashaId', '==', ashaId)),
    snap => { stats = { ...stats, families: snap.size }; callback({ ...stats }); },
    () => {}
  ));

  unsubs.push(onSnapshot(
    query(collection(db, 'children'), where('ashaId', '==', ashaId), where('riskLevel', 'in', ['HIGH', 'CRITICAL'])),
    snap => { stats = { ...stats, highRisk: snap.size }; callback({ ...stats }); },
    () => {}
  ));

  unsubs.push(onSnapshot(
    query(collection(db, 'visits'), where('ashaId', '==', ashaId)),
    snap => { stats = { ...stats, visits: snap.size }; callback({ ...stats }); },
    () => {}
  ));

  return () => unsubs.forEach(u => u());
};

// ── ADMIN — ASHA workers under a head ─────────────────────────────
export const subscribeToASHAWorkers = (headId, callback) =>
  onSnapshot(
    query(collection(db, 'ashas'), where('supervisorId', '==', headId)),
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => { console.error('ashas subscription error', err); callback([]); }
  );

export const getHeadDoc = async (headId) => {
  const snap = await getDoc(doc(db, 'asha_heads', headId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

// ── GENERIC — Disease cases, birth/death records ─────────────────
export const addGenericRecord = async (collectionName, data, ashaId) => {
  const ref = await addDoc(collection(db, collectionName), {
    ...data, ashaId, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  });
  return ref.id;
};

export const subscribeToCollection = (collectionName, ashaId, callback) =>
  onSnapshot(
    query(collection(db, collectionName), where('ashaId', '==', ashaId)),
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => { console.error(`${collectionName} subscription error`, err); callback([]); }
  );

// ── FCM TOKEN ─────────────────────────────────────────────────────
export const saveFCMToken = async (ashaId, token) =>
  updateDoc(doc(db, 'ashas', ashaId), { fcmToken: token, tokenUpdatedAt: serverTimestamp() });
