import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Text } from "react-native";
import ConversationListScreen from "../screens/ConversationListScreen";
import ChatScreen from "../screens/ChatScreen";
import ContactsScreen from "../screens/ContactsScreen";
import MeScreen from "../screens/MeScreen";
import { color, hairlineWidth } from "../theme";
import type { MessagesStackParamList } from "./types";

const Stack = createNativeStackNavigator<MessagesStackParamList>();
const Tab = createBottomTabNavigator();

// 导航主题对齐桌面:白头、系统字体粗标题、靛蓝 tint、淡边线。
const headerOptions = {
  headerStyle: { backgroundColor: color.bg },
  headerShadowVisible: false,
  headerTintColor: color.accent,
  headerTitleStyle: { fontSize: 17, fontWeight: "700" as const, color: color.ink },
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

function tabIcon(glyph: string) {
  return ({ color: c, size }: { color: string; size: number }) => (
    <Text style={{ color: c, fontSize: size - 4 }}>{glyph}</Text>
  );
}

export default function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        ...headerOptions,
        tabBarActiveTintColor: color.accent,
        tabBarInactiveTintColor: color.inkFaint,
        tabBarStyle: { backgroundColor: color.bg, borderTopWidth: hairlineWidth, borderTopColor: color.line },
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      <Tab.Screen name="Messages" component={MessagesStack} options={{ headerShown: false, title: "消息", tabBarIcon: tabIcon("✦") }} />
      <Tab.Screen name="Contacts" component={ContactsScreen} options={{ title: "联系人", tabBarIcon: tabIcon("◇") }} />
      <Tab.Screen name="Me" component={MeScreen} options={{ title: "我", tabBarIcon: tabIcon("●") }} />
    </Tab.Navigator>
  );
}
