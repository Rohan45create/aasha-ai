import { useRef, useState } from 'react';
import jsQR from 'jsqr';

const AadhaarInput = ({ memberIndex, memberName, onAadhaarScanned }) => {
  const [mode, setMode] = useState('choose'); // choose | scan | manual
  const [masked, setMasked] = useState('');
  const canvasRef = useRef(null);
  const videoRef = useRef(null);

  const startCamera = async () => {
    setMode('scan');
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: 'environment' } 
    });
    // This timeout gives time for the video element to render before assigning srcObject
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        scanFrame(stream);
      }
    }, 100);
  };

  const stopCamera = (stream) => {
    if (stream) stream.getTracks().forEach(t => t.stop());
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
    }
  };

  const scanFrame = (stream) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !videoRef.current) return;
    
    const tick = () => {
      if (mode !== 'scan') {
        stopCamera(stream);
        return;
      }
      
      if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        ctx.drawImage(videoRef.current, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        
        if (code) {
          stopCamera(stream);
          parseAadhaarQR(code.data);
          return;
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const parseAadhaarQR = (qrData) => {
    try {
      const parser = new DOMParser();
      const xml = parser.parseFromString(qrData, 'text/xml');
      const root = xml.documentElement;
      
      const aadhaar = root.getAttribute('uid') || '';
      const name = root.getAttribute('name') || '';
      const dob = root.getAttribute('dob') || '';
      const gender = root.getAttribute('gender') === 'M' ? 'Male' : 
                     root.getAttribute('gender') === 'F' ? 'Female' : 'Other';
      
      const [d, m, y] = dob.split('-');
      const formattedDob = y && m && d ? `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}` : '';
      
      const last4 = aadhaar.slice(-4);
      setMasked(`XXXX-XXXX-XXXX-${last4}`);
      setMode('confirmed');
      
      onAadhaarScanned({ aadhaar_raw: aadhaar, name, dob: formattedDob, gender });
    } catch {
      const params = new URLSearchParams(qrData.split('?')[1]);
      const uid = params.get('uid') || qrData;
      setMasked(`XXXX-XXXX-XXXX-${uid.slice(-4)}`);
      setMode('confirmed');
      onAadhaarScanned({ aadhaar_raw: uid });
    }
  };

  const handleManualEntry = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 12);
    if (digits.length === 12) {
      setMasked(`XXXX-XXXX-XXXX-${digits.slice(-4)}`);
      setMode('confirmed');
      onAadhaarScanned({ aadhaar_raw: digits });
    }
  };

  if (mode === 'choose') return (
    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
      <p className="text-sm font-medium text-gray-700 mb-3">Aadhaar for {memberName || `Member ${memberIndex + 1}`}</p>
      <div className="flex flex-col gap-2">
        <button type="button" onClick={startCamera} className="w-full py-2 bg-blue-50 text-blue-700 rounded-lg flex items-center justify-center gap-2 font-medium hover:bg-blue-100 transition-colors">
          <span className="text-lg">📷</span> Scan Aadhaar QR
        </button>
        <button type="button" onClick={() => setMode('manual')} className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg flex items-center justify-center gap-2 font-medium hover:bg-gray-200 transition-colors">
          <span className="text-lg">✏️</span> Enter Manually
        </button>
        <button type="button" onClick={() => onAadhaarScanned(null)} className="w-full py-2 text-gray-500 font-medium mt-1">
          Skip for now
        </button>
      </div>
    </div>
  );
  
  if (mode === 'scan') return (
    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex flex-col gap-3">
      <div className="relative rounded-lg overflow-hidden bg-black aspect-video flex items-center justify-center">
        <video ref={videoRef} playsInline className="w-full h-full object-cover" />
        <div className="absolute inset-0 border-2 border-dashed border-white/50 m-4 rounded"></div>
      </div>
      <canvas ref={canvasRef} className="hidden" />
      <p className="text-sm text-center text-gray-600 font-medium">Point camera at Aadhaar QR code</p>
      <button type="button" onClick={() => { setMode('choose'); stopCamera(); }} className="w-full py-2 bg-gray-200 text-gray-800 rounded-lg font-medium hover:bg-gray-300">
        Cancel Scan
      </button>
    </div>
  );
  
  if (mode === 'manual') return (
    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
      <p className="text-sm font-medium text-gray-700 mb-2">Enter Manual Aadhaar</p>
      <input 
        type="tel" 
        maxLength={12}
        className="w-full p-3 border rounded-lg mb-3 font-mono text-center tracking-widest text-lg"
        placeholder="12-digit number"
        onChange={e => handleManualEntry(e.target.value)}
      />
      <button type="button" onClick={() => setMode('choose')} className="w-full py-2 text-gray-500 font-medium text-sm hover:text-gray-700">
        Cancel
      </button>
    </div>
  );
  
  if (mode === 'confirmed') return (
    <div className="p-4 bg-green-50 rounded-xl border border-green-200 flex justify-between items-center">
      <div className="flex items-center gap-2 text-green-700 font-medium">
        <span>✓</span>
        <span className="font-mono tracking-wider">{masked}</span>
      </div>
      <button type="button" onClick={() => setMode('choose')} className="text-sm text-blue-600 font-medium hover:underline">
        Replace
      </button>
    </div>
  );
};

export default AadhaarInput;
