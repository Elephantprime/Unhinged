// per-user persistent bin (localStorage)
export class RecyclingBin {
  constructor(getUid) { this._getUid = getUid; }
  _key() { return `recycled_${this._getUid?.() || "anon"}`; }
  list() { try { return JSON.parse(localStorage.getItem(this._key()) || "[]"); } catch { return []; } }
  _save(a) { localStorage.setItem(this._key(), JSON.stringify(a)); }
  has(uid) { return this.list().some(p => p.uid === uid); }
  add(profile, action) {
    if (!profile?.uid) return;
    const arr = this.list().filter(p => p.uid !== profile.uid);
    arr.unshift({ ...profile, recycledAt: Date.now(), action }); // 'passed' | 'liked'
    if (arr.length > 300) arr.length = 300;
    this._save(arr);
  }
  restore(uid) { this._save(this.list().filter(p => p.uid !== uid)); }
  clear() { this._save([]); }
}
// CRITICAL FIX: Migration function to move anon data to user-specific key
function migrateAnonRecyclingBin(uid) {
  if (!uid) return;
  
  const anonKey = 'recycled_anon';
  const userKey = `recycled_${uid}`;
  
  try {
    const anonData = JSON.parse(localStorage.getItem(anonKey) || '[]');
    const userData = JSON.parse(localStorage.getItem(userKey) || '[]');
    
    if (anonData.length > 0) {
      console.log('🔄 Migrating', anonData.length, 'profiles from anon to user key');
      
      // Merge anon data into user data, avoiding duplicates
      const existingUids = new Set(userData.map(p => p.uid));
      const newProfiles = anonData.filter(p => !existingUids.has(p.uid));
      
      if (newProfiles.length > 0) {
        const merged = [...userData, ...newProfiles];
        localStorage.setItem(userKey, JSON.stringify(merged));
        console.log('✅ Migrated', newProfiles.length, 'new profiles to user recycling bin');
      }
      
      // Clear anon data after migration
      localStorage.removeItem(anonKey);
      console.log('🗑️ Cleared anonymous recycling bin after migration');
    }
  } catch (error) {
    console.error('❌ Error migrating recycling bin:', error);
  }
}

export const recyclingBin = new RecyclingBin(() => {
  const uid = window.me?.uid || null;
  
  // Auto-migrate if we have a UID and haven't migrated yet
  if (uid && !recyclingBin._migrated) {
    migrateAnonRecyclingBin(uid);
    recyclingBin._migrated = true;
  }
  
  return uid;
});