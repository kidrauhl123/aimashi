import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useFonts,
  Archivo_600SemiBold,
  Archivo_800ExtraBold,
  Archivo_900Black,
} from "@expo-google-fonts/archivo";
import { AuthProvider } from "./src/state/auth";
import { ApiProvider } from "./src/state/clientProvider";
import { EventsProvider } from "./src/state/events";
import RootNavigator from "./src/navigation/RootNavigator";
import { color } from "./src/theme";

const queryClient = new QueryClient();

export default function App() {
  const [fontsLoaded] = useFonts({
    Archivo_600SemiBold,
    Archivo_800ExtraBold,
    Archivo_900Black,
  });

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: color.bg }} />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ApiProvider>
              <EventsProvider>
                <StatusBar style="dark" />
                <RootNavigator />
              </EventsProvider>
            </ApiProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
