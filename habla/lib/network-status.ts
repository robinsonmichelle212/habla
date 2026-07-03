import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { Platform } from 'react-native';

export function isNetworkOnline(state: NetInfoState): boolean {
  if (Platform.OS === 'web') return typeof navigator !== 'undefined' ? navigator.onLine : true;
  if (state.isConnected === false) return false;
  if (state.isInternetReachable === false) return false;
  return true;
}

export async function checkIsOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return isNetworkOnline(state);
}

export function subscribeToNetworkStatus(onChange: (isOnline: boolean) => void): () => void {
  return NetInfo.addEventListener((state) => {
    onChange(isNetworkOnline(state));
  });
}
