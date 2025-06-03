import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#ffffff',
        tabBarInactiveTintColor: '#666666',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarLabelStyle: {
          fontFamily: Platform.select({
            ios: 'Menlo',
            android: 'monospace',
            default: 'monospace',
          }),
          fontSize: 11,
          fontWeight: '400',
          marginTop: -2,
        },
        tabBarIconStyle: {
          marginBottom: -2,
        },
        tabBarStyle: {
          display: 'none',
        },
        tabBarItemStyle: {
          alignItems: 'center',
          justifyContent: 'center',
        },
      }}>
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color }) => <IconSymbol size={20} name="message.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
