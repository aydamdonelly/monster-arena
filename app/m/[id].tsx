import { useLocalSearchParams } from 'expo-router';

import MonsterPage from '@/components/MonsterPage';

export { MonsterErrorBoundary as ErrorBoundary } from '@/components/MonsterPage';

export default function PublicMonsterScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <MonsterPage id={id} mode="public" />;
}
