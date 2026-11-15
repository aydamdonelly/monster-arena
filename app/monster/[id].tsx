import { useLocalSearchParams } from 'expo-router';

import MonsterPage from '@/components/MonsterPage';

export { MonsterErrorBoundary as ErrorBoundary } from '@/components/MonsterPage';

export default function MonsterDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <MonsterPage id={id} mode="owner" />;
}
