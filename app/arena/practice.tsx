import { useQuery } from 'convex/react';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import ArenaStage, { closeArena, ResultPanel } from '@/components/ArenaStage';
import { api } from '@/convex/_generated/api';
import { type ArenaResult, type Entrant, practiceEntrants, startOfToday } from '@/lib/arena';
import { useDeviceId } from '@/lib/device';
import { Palette } from '@/lib/theme';

const randomSeed = () => Math.floor(Math.random() * 2 ** 31);

export default function PracticeScreen() {
  const deviceId = useDeviceId();
  const [since] = useState(startOfToday);
  const mine = useQuery(api.monsters.listMine, { deviceId });
  const today = useQuery(api.monsters.listToday, { since, includeTest: true });
  const [entrants, setEntrants] = useState<Entrant[] | null>(null);
  const [seed, setSeed] = useState(randomSeed);
  const [result, setResult] = useState<ArenaResult | null>(null);

  if (!entrants && mine && today) setEntrants(practiceEntrants(mine[0], today));
  if (!entrants) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#cfeaf0' }}>
        <ActivityIndicator color={Palette.ink} />
      </View>
    );
  }

  const myId = mine?.[0]?._id ?? null;
  const winner = entrants.find((e) => e.id === result?.winnerId);
  const myPlace = myId && result ? result.placements.indexOf(myId) + 1 : 0;

  return (
    <ArenaStage
      entrants={entrants}
      seed={seed}
      followId={myId}
      title="PRACTICE"
      label="Practice · does not count"
      onEnd={setResult}>
      {result ? (
        <ResultPanel
          headline={myPlace === 1 ? 'You won the practice!' : myPlace ? `You finished #${myPlace} of ${entrants.length}` : `${winner?.name ?? 'Nobody'} wins`}
          detail={myPlace > 1 && winner ? `${winner.name} took the crown. Practice · does not count` : 'Practice · does not count'}
          actions={[
            { label: 'Close', onPress: closeArena },
            {
              label: 'Run it back',
              primary: true,
              onPress: () => {
                setResult(null);
                setSeed(randomSeed());
              },
            },
          ]}
        />
      ) : null}
    </ArenaStage>
  );
}
