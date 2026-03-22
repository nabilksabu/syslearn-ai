import { initializeApp } from 'firebase/app'
import {
  getAuth, GoogleAuthProvider,
  signInWithPopup, signInWithRedirect,
  signOut as firebaseSignOut,
  onAuthStateChanged
} from 'firebase/auth'
import {
  getFirestore, doc, setDoc,
  collection, query, orderBy, limit, getDocs
} from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyCXDs1QgZFncPpB83995JKT9qO4Caieybw",
  authDomain: "syslearn-ai.firebaseapp.com",
  projectId: "syslearn-ai",
  storageBucket: "syslearn-ai.firebasestorage.app",
  messagingSenderId: "1026616889335",
  appId: "1:1026616889335:web:af485b975c59902af6a8f2",
  measurementId: "G-553TD6KE0W"
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export { onAuthStateChanged }

const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

export async function signInWithGoogle() {
  try {
    return await signInWithPopup(auth, googleProvider)
  } catch (e) {
    if (e.code === 'auth/cancelled-popup-request') return null
    if (e.code === 'auth/popup-blocked') {
      return await signInWithRedirect(auth, googleProvider)
    }
    throw e
  }
}

export const signOut = () => firebaseSignOut(auth)

export async function saveAnalysis(uid, owner, repo, summary, techStack) {
  try {
    const ref = doc(db, 'users', uid, 'analyses', `${owner}-${repo}`)
    await setDoc(ref, { owner, repo, summary, techStack: techStack || [], analyzedAt: Date.now() }, { merge: true })
  } catch (e) { console.warn('Firestore save failed:', e) }
}

export async function getRecentAnalyses(uid) {
  try {
    const ref = collection(db, 'users', uid, 'analyses')
    const q = query(ref, orderBy('analyzedAt', 'desc'), limit(5))
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ ...d.data(), ts: d.data().analyzedAt }))
  } catch (e) { console.warn('Firestore read failed:', e); return [] }
}
