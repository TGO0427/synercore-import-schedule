import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'default',
      }}
    >
      <Stack.Screen
        name="login"
        options={{
          title: 'Login',
        }}
      />
      <Stack.Screen
        name="register"
        options={{
          title: 'Register',
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
      <Stack.Screen
        name="forgot-password"
        options={{
          title: 'Forgot Password',
        }}
      />
      <Stack.Screen
        name="reset-password"
        options={{
          title: 'Reset Password',
        }}
      />
    </Stack>
  );
}
