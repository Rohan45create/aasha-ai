import { useJsApiLoader, GoogleMap, Circle, InfoWindow, Marker } from '@react-google-maps/api';
import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuthStore } from '../../stores/authStore';
import { useTx } from '../../context/TranslationContext';

const CoverageMap = () => {
  const [villages, setVillages]           = useState([]);
  const [activeAshas, setActiveAshas]     = useState([]);
  const [selectedVillage, setSelectedVillage] = useState(null);
  const [loadError, setLoadError]         = useState(null);
  const [mapType, setMapType]             = useState('roadmap');
  const [mapCenter, setMapCenter]         = useState({ lat: 18.99, lng: 75.76 });
  const tx = useTx();

  const { headId: storeHeadId } = useAuthStore();
  const headId = storeHeadId || localStorage.getItem('headId') || 'head_sunita_001';

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    onError: (e) => setLoadError(e.message)
  });

  useEffect(() => {
    if (!headId) return;

    let ashasUnsub = () => {};
    let childrenUnsub = () => {};
    let householdsUnsub = () => {};

    const headUnsub = onSnapshot(doc(db, 'asha_heads', headId), (headSnap) => {
      if (!headSnap.exists()) {
        console.error("Head doc not found");
        return;
      }
      const headData = headSnap.data();
      const ashaIds = headData.ashaIds || [];
      
      if (ashaIds.length === 0) {
        setVillages([]);
        return;
      }

      ashasUnsub();
      ashasUnsub = onSnapshot(
        query(collection(db, 'ashas'), where('supervisorId', '==', headId)),
        (ashaSnap) => {
          const ashaMap = {}; 
          const active = [];
          ashaSnap.forEach(d => {
            const data = d.data();
            ashaMap[d.id] = data;
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

          childrenUnsub();
          childrenUnsub = onSnapshot(
            query(collection(db, 'children'), where('ashaId', 'in', ashaIds)),
            (childSnap) => {
              const criticalByAsha = {};
              childSnap.forEach(d => {
                const data = d.data();
                if (data.riskLevel === 'CRITICAL') {
                  criticalByAsha[data.ashaId] = (criticalByAsha[data.ashaId] || 0) + 1;
                }
              });

              householdsUnsub();
              householdsUnsub = onSnapshot(
                query(collection(db, 'households'), where('ashaId', 'in', ashaIds)),
                (hhSnap) => {
                  console.log(`Households query returned ${hhSnap.size} documents.`);
                  if (!hhSnap.empty) {
                    console.log("First document:", hhSnap.docs[0].data());
                  }

                  const vMap = {};
                  let totalLat = 0;
                  let totalLng = 0;
                  let validGpsCount = 0;

                  hhSnap.forEach(d => {
                    const data = d.data();
                    const ashaId = data.ashaId;
                    const ashaInfo = ashaMap[ashaId] || {};
                    const v = data.village || ashaInfo.village || 'Unknown';

                    if (!vMap[v]) {
                      vMap[v] = {
                        name: v,
                        total: 0,
                        critical: 0,
                        sumLat: 0,
                        sumLng: 0,
                        gpsCount: 0,
                        coveragePercent: ashaInfo.coveragePercent || 0,
                        ashaName: ashaInfo.name || 'Unknown',
                        ashaId: ashaId
                      };
                    }

                    vMap[v].total++;
                    if (data.gpsLat && data.gpsLng) {
                      vMap[v].sumLat += data.gpsLat;
                      vMap[v].sumLng += data.gpsLng;
                      vMap[v].gpsCount++;
                      
                      totalLat += data.gpsLat;
                      totalLng += data.gpsLng;
                      validGpsCount++;
                    }
                  });

                  const finalVillages = Object.values(vMap).map(v => {
                    v.critical = criticalByAsha[v.ashaId] || 0;
                    return {
                      ...v,
                      lat: v.gpsCount > 0 ? v.sumLat / v.gpsCount : 18.75,
                      lng: v.gpsCount > 0 ? v.sumLng / v.gpsCount : 75.71,
                    };
                  });
                  
                  setVillages(finalVillages);

                  if (validGpsCount > 0) {
                    setMapCenter({
                      lat: totalLat / validGpsCount,
                      lng: totalLng / validGpsCount
                    });
                  }
                },
                (err) => console.error('Households snapshot error:', err)
              );
            },
            (err) => console.error('Children snapshot error:', err)
          );
        },
        (err) => console.error('ASHA snapshot error:', err)
      );
    });

    return () => {
      headUnsub();
      ashasUnsub();
      childrenUnsub();
      householdsUnsub();
    };
  }, [headId]);

  if (loadError) return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl md:text-3xl font-bold mb-6">{tx('Coverage Map', 'coverage_map')}</h1>
      <div className="bg-[#FFF8E1] border border-[#FFCA28] rounded-2xl p-6">
        <p className="text-[#5D4037] font-medium flex items-center gap-1"><span className="material-symbols-outlined text-[20px]">warning</span> {tx('Map failed to load')}: {loadError}</p>
        <p className="text-sm text-gray-600 mt-2">{tx('Check your')} <code>VITE_GOOGLE_MAPS_API_KEY</code> in .env.local</p>
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {villages.map(v => <VillageCard key={v.name} v={v} tx={tx} onClick={() => {}} />)}
        </div>
      </div>
    </div>
  );

  if (!isLoaded) return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl md:text-3xl font-bold mb-6">{tx('Coverage Map', 'coverage_map')}</h1>
      <div className="animate-pulse bg-gray-200 h-96 rounded-2xl" />
    </div>
  );

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl md:text-3xl font-bold">{tx('Coverage Map', 'coverage_map')}</h1>
        <span className="text-xs text-[#5F5E5A] bg-gray-100 px-3 py-1 rounded-full">
          {villages.length} {tx('village')}{villages.length !== 1 ? 's' : ''} {tx('tracked')}
        </span>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-[#D3D1C7] overflow-hidden mb-6 relative">
        <button
          onClick={() => setMapType(t => t === 'roadmap' ? 'satellite' : 'roadmap')}
          className="absolute top-3 right-3 z-10 bg-white shadow-md border border-gray-200 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1 hover:bg-gray-50 transition-colors"
          title={tx('Toggle satellite view')}
        >
          <span className="material-symbols-outlined text-sm">{mapType === 'satellite' ? 'map' : 'satellite'}</span>
          {mapType === 'satellite' ? tx('Map') : tx('Satellite')}
        </button>
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '480px' }}
          center={mapCenter}
          zoom={11}
          options={{ mapTypeControl: false, streetViewControl: false, mapTypeId: mapType }}
        >
          {villages.map(v => (
            <Circle
              key={v.name}
              center={{ lat: v.lat, lng: v.lng }}
              radius={Math.min(2500, Math.max(800, v.total * 120))}
              options={{
                fillColor: v.critical > 0 ? '#E24B4A' : v.coveragePercent < 70 ? '#BA7517' : '#1D9E75',
                fillOpacity: 0.35,
                strokeColor: v.critical > 0 ? '#E24B4A' : v.coveragePercent < 70 ? '#BA7517' : '#1D9E75',
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
                {!selectedVillage.isWorker ? (
                  <>
                    <p className="text-xs text-gray-600"><strong>ASHA:</strong> {selectedVillage.ashaName}</p>
                    <p className="text-xs text-gray-600"><strong>Households:</strong> {selectedVillage.total}</p>
                    <p className="text-xs text-gray-600"><strong>Coverage:</strong> {selectedVillage.coveragePercent}%</p>
                    <p className={`text-xs font-bold ${selectedVillage.critical > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      <strong>Critical Cases:</strong> {selectedVillage.critical}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-gray-600">ASHA Worker Location</p>
                )}
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </div>

      <div className="flex items-center gap-6 px-4 py-3 bg-gray-50 border-t border-[#D3D1C7] text-xs text-[#5F5E5A]">
        <span className="font-semibold">{tx('Legend')}:</span>
        <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-[#1D9E75] inline-block opacity-70"/> {tx('Good coverage (≥70%)')}</span>
        <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-[#BA7517] inline-block opacity-70"/> {tx('Low coverage (<70%)')}</span>
        <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-[#E24B4A] inline-block opacity-70"/> {tx('Critical cases present')}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {villages.length === 0 && (
          <p className="text-[#5F5E5A] p-4 col-span-3">
            {tx('No household data found. Submit some Family Survey records first, or check that ashaIds match Firestore.')}
          </p>
        )}
        {villages.map(v => (
          <VillageCard key={v.name} v={v} tx={tx} onClick={() => setSelectedVillage(v)} />
        ))}
      </div>
    </div>
  );
};

const VillageCard = ({ v, onClick, tx }) => (
  <div
    className="bg-white rounded-2xl p-4 shadow-sm border border-[#D3D1C7] cursor-pointer hover:shadow-md transition-shadow"
    onClick={onClick}
  >
    <div className="flex items-center justify-between mb-3">
      <h3 className="font-bold text-[#1A1A18]">{v.name}</h3>
      <span className={`w-3 h-3 rounded-full ${v.critical > 0 ? 'bg-[#E24B4A]' : v.coveragePercent < 70 ? 'bg-[#BA7517]' : 'bg-[#1D9E75]'}`} />
    </div>
    <div className="grid grid-cols-2 gap-2 text-center">
      <div>
        <p className="text-xl font-bold text-[#085041]">{v.total}</p>
        <p className="text-[10px] text-[#5F5E5A] uppercase tracking-wide">{tx ? tx('Families', 'families') : 'Families'}</p>
      </div>
      <div>
        <p className={`text-xl font-bold ${v.critical > 0 ? 'text-[#E24B4A]' : 'text-[#1D9E75]'}`}>{v.critical}</p>
        <p className="text-[10px] text-[#5F5E5A] uppercase tracking-wide">{tx ? tx('Critical', 'critical') : 'Critical'}</p>
      </div>
    </div>
  </div>
);

export default CoverageMap;
