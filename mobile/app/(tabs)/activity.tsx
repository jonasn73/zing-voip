import { useEffect, useState } from "react"
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native"
import { useRouter } from "expo-router"
import { apiGet } from "../../lib/api"

type CallLog = {
  id: string
  from_number: string
  to_number: string
  duration_seconds: number | null
  created_at: string
  recording_url: string | null
}

export default function ActivityScreen() {
  const router = useRouter()
  const [calls, setCalls] = useState<CallLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    apiGet<{ calls: CallLog[] }>("/api/calls?limit=100")
      .then((d) => setCalls(d.calls ?? []))
      .catch((e) => {
        const err = e as Error & { status?: number }
        if (err.status === 401) router.replace("/login")
        else setError(err instanceof Error ? err.message : "Failed to load")
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error}</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Call history</Text>
      {calls.length === 0 ? (
        <Text style={styles.muted}>No calls yet</Text>
      ) : (
        calls.map((c) => (
          <View key={c.id} style={styles.card}>
            <Text style={styles.fromTo}>{c.from_number} → {c.to_number}</Text>
            <Text style={styles.meta}>
              {new Date(c.created_at).toLocaleString()} · {c.duration_seconds != null ? `${Math.round(c.duration_seconds / 60)}m` : "—"}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0f172a" },
  error: { color: "#fca5a5", fontSize: 14 },
  title: { fontSize: 18, fontWeight: "700", color: "#f8fafc", marginBottom: 16 },
  muted: { fontSize: 14, color: "#64748b" },
  card: { backgroundColor: "#1e293b", borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#334155" },
  fromTo: { fontSize: 14, color: "#f8fafc" },
  meta: { fontSize: 12, color: "#94a3b8", marginTop: 4 },
})
