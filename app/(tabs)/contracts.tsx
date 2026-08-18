import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ContractCard, Screen, ScreenHeader } from '@/components';
import { colors } from '@/constants/theme';
import { useGame } from '@/hooks/useGame';
import type { Contract } from '@/types/game';

export default function ContractsScreen() {
  const router = useRouter();
  const { contracts, activeContract, selectContract, refreshContracts } = useGame();

  const onSelect = (contract: Contract) => {
    selectContract(contract);
    router.navigate('/');
  };

  return (
    <Screen>
      <ScreenHeader
        eyebrow="Contract Board"
        title="Available Contracts"
        subtitle="Choose a job, then head to the hangar to build for it."
        right={
          <Pressable onPress={refreshContracts} hitSlop={10} accessibilityLabel="Refresh contracts">
            <MaterialCommunityIcons name="refresh" size={24} color={colors.primary} />
          </Pressable>
        }
      />

      <View style={styles.list}>
        {contracts.map((c) => (
          <ContractCard
            key={c.id}
            contract={c}
            active={activeContract?.id === c.id}
            onPress={() => onSelect(c)}
          />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
});
