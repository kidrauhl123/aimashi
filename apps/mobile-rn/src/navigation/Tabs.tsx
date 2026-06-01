import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ConversationListScreen from "../screens/ConversationListScreen";
import ChatScreen from "../screens/ChatScreen";
import ContactsScreen from "../screens/ContactsScreen";
import MeScreen from "../screens/MeScreen";
import AnimatedTabBar from "./AnimatedTabBar";
import { color } from "../theme";
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

export default function Tabs() {
  return (
    <Tab.Navigator screenOptions={headerOptions} tabBar={(props) => <AnimatedTabBar {...props} />}>
      <Tab.Screen name="Messages" component={MessagesStack} options={{ headerShown: false, title: "消息" }} />
      <Tab.Screen name="Contacts" component={ContactsScreen} options={{ title: "联系人" }} />
      <Tab.Screen name="Me" component={MeScreen} options={{ title: "我" }} />
    </Tab.Navigator>
  );
}
