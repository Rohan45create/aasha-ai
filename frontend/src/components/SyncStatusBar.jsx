import { useSyncStore } from '../stores/syncStore';
import { useTranslation } from 'react-i18next';

export default function SyncStatusBar() {
  const { isOnline, pendingCount, syncStatus } = useSyncStore();
  const { t } = useTranslation();

  const statusColor = syncStatus === 'green' ? 'bg-[#1D9E75]' : syncStatus === 'amber' ? 'bg-[#BA7517]' : 'bg-[#E24B4A]';

  return (
    <div className="flex items-center space-x-2 text-xs font-medium text-[#EAF3DE]">
      <span className={`w-2 h-2 rounded-full ${statusColor} animate-pulse`}></span>
      <span>{isOnline ? (pendingCount > 0 ? `${pendingCount} ${t('sync_pending')}` : 'Online') : t('offline_mode')}</span>
    </div>
  );
}
