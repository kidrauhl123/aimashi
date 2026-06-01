import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color, space } from "../theme";
import { Label, Body } from "../ui/Text";
import Button from "../ui/Button";
import { useApi } from "../state/clientProvider";
import { useEvents } from "../state/events";
import { PermissionDecision, decisionToHermesChoice, type PermissionDecisionT } from "../api/types";

// Swiss:固定置底审批卡 —— 白底 + 顶部强黑规则线 + 橙色「允许」。
export default function ApprovalSheet() {
  const api = useApi();
  const { activeApproval, resolveApproval } = useEvents();
  const insets = useSafeAreaInsets();
  if (!activeApproval) return null;

  const decide = async (decision: PermissionDecisionT) => {
    const { conversationId, runId } = activeApproval;
    resolveApproval(runId);
    try {
      await api.api(
        `/api/conversations/${encodeURIComponent(conversationId)}/runs/${encodeURIComponent(runId)}/approval`,
        { method: "POST", body: { decision, choice: decisionToHermesChoice(decision) } }
      );
    } catch {
      /* run 可能已失效:静默,sheet 已前进 */
    }
  };

  return (
    <View style={[styles.sheet, { paddingBottom: space.lg + insets.bottom }]}>
      <View style={styles.markRow}>
        <View style={styles.mark} />
        <Label>请求权限</Label>
      </View>
      <Body style={styles.preview}>{activeApproval.preview}</Body>
      <View style={styles.actions}>
        <Button label="拒绝" variant="outline" style={styles.btn} onPress={() => decide(PermissionDecision.Deny)} />
        <Button label="允许" style={styles.btn} onPress={() => decide(PermissionDecision.AllowOnce)} />
        <Button label="始终" variant="outline" style={styles.btn} onPress={() => decide(PermissionDecision.AllowAlways)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: color.surface,
    borderTopWidth: 2,
    borderTopColor: color.rule,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
  },
  markRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginBottom: space.sm },
  mark: { width: 10, height: 10, backgroundColor: color.accent },
  preview: { marginBottom: space.lg },
  actions: { flexDirection: "row", gap: space.sm },
  btn: { flex: 1, paddingHorizontal: space.xs },
});
