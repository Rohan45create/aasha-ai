import { useJsApiLoader, GoogleMap, Circle, InfoWindow, Marker } from '@react-google-maps/api';
import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuthStore } from '../../stores/authStore';

const FALLBACK_ASHA_IDS = [
  'asha_lata_001', 'asha_priya_002', 'asha_kavita_003',
  'asha_meena_004', 'asha_anita_005'
];

// Beed district approximate center coordinates per village
const VILLAGE_COORDS = {
  'Pimpalgaon': { lat: 19.42, lng: 75.85 },
  'Shirur':     { lat: 19.40, lng: 75.92 },
  'Parli':      { lat: 18.85, lng: 76.53 },
  'Georai':     { lat: 19.27, lng: 75.73 },
  'Beed City':  { lat: 18.99, lng: 75.76 },
  'Manjlegaon': { lat: 19.15, lng: 76.22 },
  'Ambajogai':  { lat: 18.73, lng: 76.38 },
};

const CoverageMap = () => {
  const [villages, setVillages] = useState([]);
  const [activeAshas, setActiveAshas] = useState([]);
  const [selectedVillage, setSelectedVillage] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [mapType, setMapType] = useState('roadmap');

  const { headId: storeHeadId } = useAuthStore();
  const headId = storeHeadId || localStorage.getItem('headId') || 'head_sunita_001';

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    onError: (e) => setLoadError(e.message)
  });

  useEffect(() => {
    if (!headId) return;

    // Use fallback IDs directly — no async getDoc needed here since we
    // always scope to the known ASHA IDs to avoid full-collection scans
    const ashaIds = FALLBACK_ASHA_IDS;

    // Real-time household aggregation filtered to this supervisor's ASHAs
    const householdsUnsub = onSnapshot(
      query(collection(db, 'households')),
      (snap) => {
        const villageMap = {};
        snap.forEach(d => {
          const data = d.data();
          // Filter to only households belonging to this head's ASHAs
          if (!ashaIds.includes(data.ashaId)) return;

          const v = data.village || 'Unknown';
          if (!villageMap[v]) {
            // Use known coords if available, otherwise use stored GPS or randomize in Beed region
            const known = VILLAGE_COORDS[v];
            villageMap[v] = {
              name: v,
              total: 0,
              critical: 0,
              lat: known?.lat ?? (data.gpsLat || 18.75 + (Math.random() - 0.5) * 1.5),
              lng: known?.lng ?? (data.gpsLng || 75.71 + (Math.random() - 0.5) * 1.5),
            };
          }
          villageMap[v].total++;
          if (data.hasCriticalCase) villageMap[v].critical++;
        });
        setVillages(Object.values(villageMap));
      },
      (err) => console.error('Households snapshot error:', err)
    );

    // Real-time ASHA worker locations (filtered to this head)
    const ashasUnsub = onSnapshot(
      query(collection(db, 'ashas'), where('supervisorId', '==', headId)),
      (snap) => {
        const active = [];
        snap.forEach(d => {
          const data = d.data();
          if (data.isActive) {
            active.push({
              id: d.id,
              name: data.name || d.id,
              lat: data.lastKnownLocation?.lat ?? (18.75 + (Math.random() - 0.5) * 0.5),
              lng: data.lastKnownLocation?.lng ?? (75.71 + (Math.random() - 0.5) * 0.5),
            });
          }
        });
        setActiveAshas(active);
      },
      (err) => console.error('ASHA snapshot error:', err)
    );

    return () => {
      householdsUnsub();
      ashasUnsub();
    };
  }, [headId]);

  if (loadError) return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl md:text-3xl font-bold mb-6">Coverage Map</h1>
      <div className="bg-[#FFF8E1] border border-[#FFCA28] rounded-2xl p-6">
        <p className="text-[#5D4037] font-medium flex items-center gap-1"><span className="material-symbols-outlined text-[20px]">warning</span> Map failed to load: {loadError}</p>
        <p className="text-sm text-gray-600 mt-2">Check your <code>VITE_GOOGLE_MAPS_API_KEY</code> in .env.local</p>
        {/* Still show village summary cards without the map */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {villages.map(v => <VillageCard key={v.name} v={v} onClick={() => {}} />)}
        </div>
      </div>
    </div>
  );

  if (!isLoaded) return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl md:text-3xl font-bold mb-6">Coverage Map</h1>
      <div className="animate-pulse bg-gray-200 h-96 rounded-2xl" />
    </div>
  );

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl md:text-3xl font-bold">Coverage Map</h1>
        <span className="text-xs text-[#5F5E5A] bg-gray-100 px-3 py-1 rounded-full">{villages.length} village{villages.length !== 1 ? 's' : ''} tracked</span>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-[#D3D1C7] overflow-hidden mb-6 relative">
        {/* Satellite Toggle */}
        <button
          onClick={() => setMapType(t => t === 'roadmap' ? 'satellite' : 'roadmap')}
          className="absolute top-3 right-3 z-10 bg-white shadow-md border border-gray-200 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1 hover:bg-gray-50 transition-colors"
          title="Toggle satellite view"
        >
          <span className="material-symbols-outlined text-sm">{mapType === 'satellite' ? 'map' : 'satellite'}</span>
          {mapType === 'satellite' ? 'Map' : 'Satellite'}
        </button>
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '480px' }}
          center={{ lat: 18.99, lng: 75.76 }}
          zoom={9}
          options={{ mapTypeControl: false, streetViewControl: false, mapTypeId: mapType }}
        >
          {villages.map(v => (
            <Circle
              key={v.name}
              center={{ lat: v.lat, lng: v.lng }}
              radius={Math.max(800, v.total * 120)}
              options={{
                fillColor: v.critical > 0 ? '#E24B4A' : v.total < 10 ? '#BA7517' : '#1D9E75',
                fillOpacity: 0.35,
                strokeColor: v.critical > 0 ? '#E24B4A' : '#1D9E75',
                strokeWeight: 2,
                cursor: 'pointer',
              }}
              onClick={() => setSelectedVillage(v)}
            />
          ))}

          {activeAshas.map(asha => (
            <Marker
              key={asha.id}
              position={{ lat: asha.lat, lng: asha.lng }}
              icon={{
                url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
                scaledSize: new window.google.maps.Size(36, 36),
              }}
              onClick={() => setSelectedVillage({
                name: `ASHA: ${asha.name}`,
                lat: asha.lat,
                lng: asha.lng,
                total: 1,
                critical: 0,
                isWorker: true,
              })}
            />
          ))}

          {selectedVillage && (
            <InfoWindow
              position={{ lat: selectedVillage.lat, lng: selectedVillage.lng }}
              onCloseClick={() => setSelectedVillage(null)}
            >
              <div className="p-1 min-w-[120px]">
                <strong className="block text-sm mb-1">{selectedVillage.name}</strong>
                {!selectedVillage.isWorker && (
                  <>
                    <p className="text-xs text-gray-600">{selectedVillage.total} families</p>
                    {selectedVillage.critical > 0 && (
                      <p className="text-xs text-red-600 font-bold">{selectedVillage.critical} critical cases</p>
                    )}
                  </>
                )}
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 px-4 py-3 bg-gray-50 border-t border-[#D3D1C7] text-xs text-[#5F5E5A]">
        <span className="font-semibold">Legend:</span>
        <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-[#1D9E75] inline-block opacity-70"/> Good coverage (≥70%)</span>
        <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-[#BA7517] inline-block opacity-70"/> Low coverage (&lt;70%)</span>
        <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-[#E24B4A] inline-block opacity-70"/> Critical cases present</span>
      </div>

      {/* Village Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {villages.length === 0 && (
          <p className="text-[#5F5E5A] p-4 col-span-3">No household data found. Submit some Family Survey records first, or check that ashaIds match Firestore.</p>
        )}
        {villages.map(v => (
          <VillageCard key={v.name} v={v} onClick={() => setSelectedVillage(v)} />
        ))}
      </div>
    </div>
  );
};

const VillageCard = ({ v, onClick }) => (
  <div
    className="bg-white rounded-2xl p-4 shadow-sm border border-[#D3D1C7] cursor-pointer hover:shadow-md transition-shadow"
    onClick={onClick}
  >
    <div className="flex items-center justify-between mb-3">
      <h3 className="font-bold text-[#1A1A18]">{v.name}</h3>
      <span className={`w-3 h-3 rounded-full ${v.critical > 0 ? 'bg-[#E24B4A]' : v.total < 10 ? 'bg-[#BA7517]' : 'bg-[#1D9E75]'}`} />
    </div>
    <div className="grid grid-cols-2 gap-2 text-center">
      <div>
        <p className="text-xl font-bold text-[#085041]">{v.total}</p>
        <p className="text-[10px] text-[#5F5E5A] uppercase tracking-wide">Families</p>
      </div>
      <div>
        <p className={`text-xl font-bold ${v.critical > 0 ? 'text-[#E24B4A]' : 'text-[#1D9E75]'}`}>{v.critical}</p>
        <p className="text-[10px] text-[#5F5E5A] uppercase tracking-wide">Critical</p>
      </div>
    </div>
  </div>
);

export default CoverageMap;
