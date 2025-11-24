import { Stack } from 'expo-router';

export default function ShipmentsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="[id]"
        options={{
          presentation: 'card',
          headerShown: false,
        }}
      />
    </Stack>
  );
}
