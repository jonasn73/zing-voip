import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from "react-native"
import { useRouter } from "expo-router"
import { useSession } from "../../lib/useSession"
import { API_URL, apiMutate } from "../../lib/api"

const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL ?? ""
const SUPPORT_URL = process.env.EXPO_PUBLIC_SUPPORT_URL ?? ""

export default function SettingsScreen() {
  const router = useRouter()
  const { user } = useSession()

  async function handleLogout() {
    try {
      await apiMutate("/api/auth/logout", { method: "POST" })
      router.replace("/login")
    } catch {
      router.replace("/login")
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Account</Text>
        <Text style={styles.cardValue}>{user?.name ?? "—"}</Text>
        <Text style={styles.cardHint}>{user?.email ?? ""}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>API URL</Text>
        <Text style={styles.cardHint} numberOfLines={2}>{API_URL}</Text>
        <Text style={styles.apiHint}>Set EXPO_PUBLIC_API_URL in .env to change (e.g. your deployed Next.js URL).</Text>
      </View>
      {PRIVACY_URL ? (
        <TouchableOpacity style={styles.card} onPress={() => Linking.openURL(PRIVACY_URL)}>
          <Text style={styles.cardLabel}>Privacy Policy</Text>
          <Text style={styles.cardHint}>Opens in browser</Text>
        </TouchableOpacity>
      ) : null}
      {SUPPORT_URL ? (
        <TouchableOpacity style={styles.card} onPress={() => Linking.openURL(SUPPORT_URL)}>
          <Text style={styles.cardLabel}>Help & Support</Text>
          <Text style={styles.cardHint}>Opens in browser</Text>
        </TouchableOpacity>
      ) : null}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  content: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 18, fontWeight: "700", color: "#f8fafc", marginBottom: 16 },
  card: { backgroundColor: "#1e293b", borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#334155" },
  cardLabel: { fontSize: 12, color: "#94a3b8", marginBottom: 4 },
  cardValue: { fontSize: 16, fontWeight: "600", color: "#f8fafc" },
  cardHint: { fontSize: 14, color: "#94a3b8", marginTop: 4 },
  apiHint: { fontSize: 12, color: "#64748b", marginTop: 8 },
  logoutButton: { marginTop: 24, backgroundColor: "rgba(239,68,68,0.15)", borderRadius: 12, padding: 16, minHeight: 44, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "rgba(239,68,68,0.3)" },
  logoutText: { color: "#fca5a5", fontSize: 16, fontWeight: "600" },
})
