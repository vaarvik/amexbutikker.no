import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { SymbolViewProps } from 'expo-symbols';
import type { ColorValue } from 'react-native';
import { usePalette } from '../../ui/theme';

function TabIcon(props: { readonly name: SymbolViewProps['name']; readonly color: ColorValue }) {
  return <SymbolView name={props.name} size={24} tintColor={props.color} />;
}

/** The bottom tabs. A map tab joins them when the map exists. */
export default function TabsLayout() {
  const palette = usePalette();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: palette.accent,
        tabBarInactiveTintColor: palette.muted,
        tabBarStyle: { backgroundColor: palette.card, borderTopColor: palette.border },
        headerStyle: { backgroundColor: palette.background },
        headerTitleStyle: { color: palette.text },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: palette.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Steder',
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <TabIcon
              name={{ ios: 'mappin.and.ellipse', android: 'place', web: 'place' }}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Innstillinger',
          tabBarIcon: ({ color }) => (
            <TabIcon
              name={{ ios: 'gearshape', android: 'settings', web: 'settings' }}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
