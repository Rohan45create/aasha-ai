import { useState, useRef } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { db, storage } from '../../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';
import { compressImage } from '../../utils/imageCompressor';

export default function RegisterScan() {
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const fileInputRef = useRef();
  const { user } = useAuthStore();

  const handleCapture = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhoto(file);
      setPreview(URL.createObjectURL(file));
      setResult(null);
    }
  };

  const clearPhoto = () => {
    setPhoto(null);
    setPreview(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const handleUpload = async () => {
    if (!photo || !user) return;
    setIsLoading(true);
    try {
       // Compress photo
       const compressedBlob = await compressImage(photo);
       const compressed = new File([compressedBlob], photo.name, { type: 'image/jpeg', lastModified: Date.now() });
       
       // Upload to firebase storage
       const timestamp = Date.now();
       const storagePath = `registers/${user.uid}/${timestamp}.jpg`;
       const storageRef = ref(storage, storagePath);
       await uploadBytes(storageRef, compressed);

       // Call backend
       const token = await user.getIdToken();
       const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/register/extract`, {
         method: "POST",
         headers: { 
           "Authorization": `Bearer ${token}`,
           "Content-Type": "application/json"
         },
         body: JSON.stringify({
           storage_path: storagePath,
           register_type: "family_survey",
           asha_id: user.uid
         })
       });
       
       if (!response.ok) throw new Error("Vision API failed");
       
       const data = await response.json();
       
       setResult({
          status: 'review',
          data: (data.rows || [])
       });
    } catch (err) {
       console.error(err);
       setResult({ status: 'error', message: err.message });
    } finally {
       setIsLoading(false);
    }
  };

  const handleConfirmAll = async () => {
    setIsLoading(true);
    try {
      // Typically we'd batch write them.
      for (let rec of result.data) {
        await addDoc(collection(db, 'scanned_records'), {
           ...(rec.fields || {}),
           source: "ocr_import",
           originalOcrRaw: rec,
           ashaId: user.uid,
           scannedAt: serverTimestamp()
        });
      }
      setResult({ status: 'success', data: result.data });
    } catch (err) {
      console.error(err);
      alert('Failed to save records: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#D3D1C7] space-y-6">
        <h2 className="text-xl font-bold text-[#1A1A18]">Register Scanner (OCR)</h2>
        <p className="text-sm text-[#5F5E5A]">Take a photo of your handwritten register to automatically import patient data.</p>
        
        {result?.status === 'success' ? (
            <div className="space-y-4">
                <div className="bg-[#EAF3DE] p-4 rounded-xl border border-[#1D9E75]">
                    <h3 className="font-semibold text-[#085041] mb-2">Import Successful</h3>
                    <p className="text-sm text-[#085041]">Found and saved {result.data.length} records to the database.</p>
                </div>
                <button onClick={clearPhoto} className="w-full py-3 bg-[#1D9E75] text-white rounded-xl font-medium shadow-md">Scan Another Page</button>
            </div>
        ) : result?.status === 'review' ? (
            <div className="space-y-4">
                <div className="bg-[#FFF8E1] p-4 rounded-xl border border-[#FFCA28]">
                    <h3 className="font-semibold text-[#1A1A18] mb-2">Review Extracted Data</h3>
                    <p className="text-sm text-[#5F5E5A]">Found {result.data.length} rows. Please review any low confidence (amber) cells before confirming.</p>
                </div>
                
                <div className="overflow-x-auto border border-[#D3D1C7] rounded-xl shadow-sm">
                   <table className="w-full text-sm text-left text-gray-700">
                     <thead className="bg-gray-50 text-xs uppercase text-gray-500 border-b">
                       <tr>
                         {(result.data.length > 0 ? Object.keys(result.data[0].fields || {}) : []).map(h => 
                           <th key={h} className="px-4 py-2 whitespace-nowrap">{h.replace(/_/g, ' ')}</th>
                         )}
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-100">
                       {result.data.map((r, i) => {
                         const needsReview = r.needs_review;
                         const headers = Object.keys(r.fields || {});
                         return (
                           <tr key={i} className={needsReview ? 'bg-amber-50/50' : 'bg-white'}>
                             {headers.map(h => {
                               const conf = (r.confidence && r.confidence[h]) ? r.confidence[h] : 1.0;
                               const isLowConf = conf < 0.8;
                               const isUnreadable = r.unreadable_fields && r.unreadable_fields.includes(h);
                               const cellClass = "px-4 py-3";
                               
                               const valClass = isUnreadable 
                                    ? 'text-red-500 font-bold border border-red-500 px-1 inline-block' 
                                    : isLowConf 
                                        ? 'text-amber-800 bg-amber-100 border border-amber-400 font-medium px-1 rounded inline-block' 
                                        : '';

                               return (
                                 <td key={h} className={cellClass}>
                                   <span className={valClass}>{isUnreadable ? '?' : (r.fields[h] || '-')}</span>
                                 </td>
                               );
                             })}
                           </tr>
                         );
                       })}
                     </tbody>
                   </table>
                </div>

                <div className="flex gap-4">
                  <button onClick={clearPhoto} className="flex-1 py-3 bg-gray-100 text-gray-800 rounded-xl font-medium shadow-sm border hover:bg-gray-200">Discard</button>
                  <button onClick={handleConfirmAll} disabled={isLoading} className="flex-1 py-3 bg-[#1D9E75] text-white rounded-xl font-medium shadow-md hover:bg-[#16815e]">✓ Confirm All</button>
                </div>
            </div>
        ) : (
            <div className="space-y-4">
                {result?.status === 'error' && (
                   <div className="bg-[#FCEBEB] p-3 rounded-xl border border-[#E24B4A] text-sm text-[#791F1F]">
                      Error Processing Image: {result.message}
                   </div>
                )}
                
                {preview ? (
                   <div className="relative">
                      <img src={preview} alt="Document preview" className="w-full h-64 object-cover rounded-xl border" />
                      <button onClick={clearPhoto} className="absolute top-2 right-2 bg-white rounded-full p-1 shadow-md text-red-500 hover:bg-gray-100">
                         <span className="material-symbols-outlined">close</span>
                      </button>
                   </div>
                ) : (
                   <div 
                       onClick={() => fileInputRef.current.click()}
                       className="border-2 border-dashed border-[#1D9E75] rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-[#EAF3DE] transition-colors"
                   >
                       <span className="material-symbols-outlined text-4xl text-[#1D9E75] mb-2">add_a_photo</span>
                       <p className="text-sm font-medium text-[#1D9E75]">Tap to take photo</p>
                   </div>
                )}
                
                <input 
                   type="file" 
                   accept="image/*" 
                   capture="environment" 
                   ref={fileInputRef} 
                   onChange={handleCapture} 
                   className="hidden" 
                />

                <button 
                   onClick={handleUpload} 
                   disabled={!photo || isLoading}
                   className="w-full py-3 bg-[#1D9E75] text-white rounded-xl font-medium disabled:opacity-50 flex items-center justify-center shadow-md active:scale-[0.98] hover:bg-[#16815e]"
                >
                   {isLoading ? <span className="material-symbols-outlined animate-spin text-xl py-1">refresh</span> : 'Process With Vision AI'}
                </button>
            </div>
        )}
    </div>
  );
}
