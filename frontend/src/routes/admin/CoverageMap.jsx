import { useJsApiLoader, GoogleMap, Circle, InfoWindow, Marker } from '@react-google-maps/api';
import { useEffect, useState } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../../firebase';

const CoverageMap = () => {
  const [villages, setVillages] = useState([]);
  const [activeAshas, setActiveAshas] = useState([]);
  const [selectedVillage, setSelectedVillage] = useState(null);
  const [loadError, setLoadError] = useState(null);
  
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    onError: (e) => setLoadError(e.message)
  });

  useEffect(() => {
    // Listen to households collection for live updates
    const q = query(collection(db, 'households'));
    const unsubscribe = onSnapshot(q, (snap) => {
      // Aggregate by village
      const villageMap = {};
      snap.forEach(doc => {
        const d = doc.data();
        const v = d.village || 'Unknown';
        if (!villageMap[v]) {
          villageMap[v] = { name: v, total: 0, critical: 0, 
            lat: d.gpsLat || 18.5 + Math.random()*2, 
            lng: d.gpsLng || 75.5 + Math.random()*2 };
        }
        villageMap[v].total++;
        if (d.hasCriticalCase) villageMap[v].critical++;
      });
      setVillages(Object.values(villageMap));
    });

    const ashaQ = query(collection(db, 'ashas'));
    const unsubAshas = onSnapshot(ashaQ, (snap) => {
      const active = [];
      snap.forEach(doc => {
        const d = doc.data();
        if (d.isActive) {
          // Mock location if real location doesn't exist
          active.push({
             id: doc.id,
             name: d.name,
             lat: d.lastKnownLocation?.lat || 18.75 + (Math.random()-0.5)*0.5,
             lng: d.lastKnownLocation?.lng || 75.71 + (Math.random()-0.5)*0.5
          });
        }
      });
      setActiveAshas(active);
    });

    return () => { unsubscribe(); unsubAshas(); };
  }, []);

  if (loadError) return (
    <div className="p-4 bg-red-50 rounded">
      <p className="text-red-600">Map failed to load: {loadError}</p>
      <p className="text-sm text-gray-600">Check your Google Maps API key in .env.local</p>
    </div>
  );
  
  if (!isLoaded) return <div className="animate-pulse bg-gray-200 h-96 rounded" />;

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl md:text-3xl font-bold mb-6">Coverage Map</h1>
      
      <div className="bg-white rounded-2xl shadow-sm border border-[#D3D1C7] overflow-hidden">
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '500px' }}
          center={{ lat: 18.75, lng: 75.71 }}
          zoom={9}
        >
          {villages.map(v => (
            <Circle key={v.name}
              center={{ lat: v.lat, lng: v.lng }}
              radius={Math.max(500, v.total * 100)}
              options={{
                fillColor: v.critical > 0 ? '#E24B4A' : v.total < 10 ? '#BA7517' : '#1D9E75',
                fillOpacity: 0.4,
                strokeColor: v.critical > 0 ? '#E24B4A' : '#1D9E75',
                strokeWeight: 2,
                cursor: 'pointer'
              }}
              onClick={() => setSelectedVillage(v)}
            />
          ))}
          {activeAshas.map(asha => (
            <Marker key={asha.id}
              position={{ lat: asha.lat, lng: asha.lng }}
              icon={{
                url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
                scaledSize: new window.google.maps.Size(40, 40)
              }}
              onClick={() => setSelectedVillage({
                name: `ASHA Worker: ${asha.name}`,
                lat: asha.lat,
                lng: asha.lng,
                total: 1, critical: 0, isWorker: true
              })}
            />
          ))}
          {selectedVillage && (
            <InfoWindow position={{ lat: selectedVillage.lat, lng: selectedVillage.lng }}
              onCloseClick={() => setSelectedVillage(null)}>
              <div className="p-2">
                <strong>{selectedVillage.name}</strong>
                {!selectedVillage.isWorker && <p>{selectedVillage.total} families</p>}
                {!selectedVillage.isWorker && selectedVillage.critical > 0 && 
                  <p className="text-red-600">{selectedVillage.critical} critical cases</p>}
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </div>

      {/* Village Summary Cards */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {villages.length === 0 && <p className="text-[#5F5E5A] p-4">No villages found.</p>}
        {villages.map(v => (
          <div key={v.name} className="bg-white rounded-2xl p-4 shadow-sm border border-[#D3D1C7] cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedVillage(v)}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-[#1A1A18]">{v.name}</h3>
              <span className={`w-3 h-3 rounded-full ${v.critical > 0 ? 'bg-[#E24B4A]' : v.total < 10 ? 'bg-[#BA7517]' : 'bg-[#1D9E75]'}`} />
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div>
                <p className="text-lg font-bold text-[#085041]">{v.total}</p>
                <p className="text-[10px] text-[#5F5E5A] uppercase">Families</p>
              </div>
              <div>
                <p className={`text-lg font-bold ${v.critical > 0 ? 'text-[#E24B4A]' : 'text-[#1D9E75]'}`}>{v.critical}</p>
                <p className="text-[10px] text-[#5F5E5A] uppercase">Critical</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CoverageMap;
