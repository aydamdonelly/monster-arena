import { useQuery } from 'convex/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import ArenaStage, { closeArena, ResultPanel } from '@/components/ArenaStage';
import { api } from '@/convex/_generated/api';
import { royaleHour, type ArenaResult } from '@/lib/arena';
import { useDeviceId } from '@/lib/device';
import { testArgs, useTestMode } from '@/lib/test-mode';
import { Palette, Type } from '@/lib/theme';

export default function ReplayScreen() {
  const deviceId = useDeviceId();
  const params = useLocalSearchParams<{ round?: string; live?: string }>();
  const index = Number(params.round ?? -1);
  const testMode = useTestMode();
  const round = useQuery(api.royale.round, { index, ...testArgs(testMode) });
  const mine = useQuery(api.royale.mine, { deviceId, ...testArgs(testMode) });
  const [result, setResult] = useState<ArenaResult | null>(null);
  const [take, setTake] = useState(0);

  if (!round) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.ground, gap: 12 }}>
        {round === null ? <Text style={Type.heading}>This round is not available.</Text> : <ActivityIndicator color={Palette.ink} />}
      </View>
    );
  }

  const myId = mine?.entered ? mine.monsterId : null;
  const followId = myId && round.entrants.some((e) => e.id === myId) ? myId : null;
  const title = `${round.title.toUpperCase()} · ${round.isFinal ? 'FINAL' : `HEAT ${round.index + 1}`}`;
  const winner = round.entrants.find((e) => e.id === result?.winnerId);
  const myPlace = followId && result ? result.placements.indexOf(followId) + 1 : 0;

  return (
    <ArenaStage
      key={take}
      entrants={round.entrants}
      seed={round.seed}
      dayElement={round.dayElement}
      followId={followId}
      title={title}
      label={`${royaleHour()} · ${round.isFinal ? 'Final' : `Heat ${round.index + 1}`} · ${round.entrants.length} eggs`}
      live={params.live === '1'}
      speed={round.speed}
      caption={followId ? mine?.entered ? mine.monsterName : null : null}
      onEnd={setResult}>
      {result ? (
        <ResultPanel
          headline={`${winner?.name ?? 'Nobody'} wins`}
          detail={myPlace ? `You finished #${myPlace} of ${round.entrants.length}` : undefined}
          actions={[
            { label: 'Close', onPress: closeArena },
            round.isFinal
              ? {
                  label: 'Again',
                  primary: true,
                  onPress: () => {
                    setResult(null);
                    setTake((t) => t + 1);
                  },
                }
              : { label: 'The final', primary: true, onPress: () => router.replace({ pathname: '/arena/replay', params: { round: '-1' } }) },
          ]}
        />
      ) : null}
    </ArenaStage>
  );
}
