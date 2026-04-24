import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { auth, db } from '../../firebase';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export default function Profile() {
  const { user, ashaId } = useAuthStore();
  const [profileData, setProfileData] = useState(null);
  
  useEffect(() => {
    const id = ashaId || user?.uid;
    if (id) {
       getDoc(doc(db, 'ashas', id)).then(d => {
         if (d.exists()) setProfileData(d.data());
       }).catch(console.error);
    }
  }, [ashaId, user]);

  const handleLogout = async () => {
    await signOut(auth);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[#D3D1C7] p-6 text-center">
       <div className="w-24 h-24 bg-[#085041] rounded-full mx-auto mb-4 flex items-center justify-center text-3xl text-white font-bold">
         {user?.displayName ? user.displayName.charAt(0).toUpperCase() : 'A'}
       </div>
       <h2 className="text-2xl font-bold text-[#1A1A18] mb-1">{user?.displayName || 'ASHA Worker'}</h2>
       <p className="text-[#5F5E5A] text-sm mb-6">{user?.phoneNumber}</p>
       
       <div className="space-y-3 mb-8 text-left border-t border-[#D3D1C7] pt-6">
          <div className="flex justify-between items-center py-2">
             <span className="text-[#5F5E5A] font-medium text-sm">Assigned PHC</span>
             <span className="font-semibold text-[#1A1A18] text-sm">{profileData?.phc || 'Shirur Rural'}</span>
          </div>
          <div className="flex justify-between items-center py-2">
             <span className="text-[#5F5E5A] font-medium text-sm">Coverage Area</span>
             <span className="font-semibold text-[#1A1A18] text-sm">{profileData?.village || 'Pimple Jagtap'}</span>
          </div>
       </div>

       <button onClick={handleLogout} className="w-full py-3 border border-[#E24B4A] text-[#791F1F] rounded-xl font-medium flex items-center justify-center space-x-2 hover:bg-[#FCEBEB] transition-colors">
          <span className="material-symbols-outlined">logout</span>
          <span>Log Out</span>
       </button>
    </div>
  );
}
