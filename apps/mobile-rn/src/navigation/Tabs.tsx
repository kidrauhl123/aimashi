import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Text, View, StyleSheet } from "react-native";
import ConversationListScreen from "../screens/ConversationListScreen";
import ChatScreen from "../screens/ChatScreen";
import ContactsScreen from "../screens/ContactsScreen";
import MeScreen from "../screens/MeScreen";
import { color, font, hairlineWidth } from "../theme";
import type { MessagesStackParamList } from "./types";

const Stack = createNativeStackNavigator<MessagesStackParamList>();
const Tab = createBottomTabNavigator();

// Swiss 导航主题:纯白头、黑色大写粗标题、橙色 tint、细黑规则线。
const headerOptions = {
  headerStyle: { backgroundColor: color.bg },
  headerShadowVisible: false,
  headerTintColor: color.accent,
  headerTitleStyle: { fontFamily: font.display, fontSize: 17, letterSpacing: 1, color: color.ink },
  headerTitleAlign: "center" as const,
  contentStyle: { backgroundColor: color.bg },
};

function MessagesStack() {
  return (
    <Stack.Navigator screenOptions={headerOptions}>
      <Stack.Screen name="Conversations" component={ConversationListScreen} options={{ title: "消息" }} />
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={({ route }) => ({ title: route.params?.title || "" })}
      />
    </Stack.Navigator>
  );
}

function TabIcon({ glyph, focused }: { glyph: string; focused: boolean }) {
  return (
    <View style={styles.iconWrap}>
      <Text style={[styles.icon, { color: focused ? color.accent : color.inkFaint }]}>{glyph}</Text>
      {focused ? <View style={styles.dot} /> : null}
    </View>
  );
}

export default function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        ...headerOptions,
        tabBarActiveTintColor: color.ink,
        tabBarInactiveTintColor: color.inkFaint,
        tabBarStyle: { backgroundColor: color.bg, borderTopWidth: hairlineWidth, borderTopColor: color.rule },
        tabBarLabelStyle: { fontFamily: font.semibold, fontSize: 11, letterSpacing: 0.5 },
      }}
    >
      <Tab.Screen
        name="Messages"
        component={MessagesStack}
        options={{ headerShown: false, title: "消息", tabBarIcon: ({ focused }) => <TabIcon glyph="✦" focused={focused} /> }}
      />
      <Tab.Screen
        name="Contacts"
        component={ContactsScreen}
        options={{ title: "联系人", tabBarIcon: ({ focused }) => <TabIcon glyph="◇" focused={focused} /> }}
      />
      <Tab.Screen
        name="Me"
        component={MeScreen}
        options={{ title: "我", tabBarIcon: ({ focused }) => <TabIcon glyph="●" focused={focused} /> }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  iconWrap: { alignItems: "center", justifyContent: "center" },
  icon: { fontSize: 16 },
  dot: { width: 4, height: 4, backgroundColor: color.accent, marginTop: 2 },
});
