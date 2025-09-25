// Script to set admin status for Unfavorablejosh
// Run this in browser console on any page with Firebase loaded

import { db, doc, setDoc, serverTimestamp } from './public/js/firebase.js';

// Set admin status for Unfavorablejosh
async function setAdminStatus() {
  try {
    const userRef = doc(db, 'users', '3rOEe2tzu6cahiDBgmck7WIZ2nS2');
    await setDoc(userRef, {
      isAdmin: true,
      isModerator: true,
      adminSince: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    console.log('✅ Admin status set for Unfavorablejosh');
    return true;
  } catch (error) {
    console.error('❌ Error setting admin status:', error);
    return false;
  }
}

// Also create system admin document
async function createSystemAdminDoc() {
  try {
    const adminRef = doc(db, 'system_admins', '3rOEe2tzu6cahiDBgmck7WIZ2nS2');
    await setDoc(adminRef, {
      uid: '3rOEe2tzu6cahiDBgmck7WIZ2nS2',
      displayName: 'Unfavorablejosh',
      adminLevel: 'super',
      permissions: ['chat_clear', 'user_ban', 'content_moderate'],
      grantedAt: serverTimestamp()
    });
    
    console.log('✅ System admin document created for Unfavorablejosh');
    return true;
  } catch (error) {
    console.error('❌ Error creating system admin doc:', error);
    return false;
  }
}

// Run both functions
setAdminStatus();
createSystemAdminDoc();