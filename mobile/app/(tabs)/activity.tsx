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

type QualitySummary = {
  answer_rate_percent: number
  avg_setup_ms: number | null
}

export default function ActivityScreen() {
  const router = useRouter()
  const [calls, setCalls] = useState<CallLog[]>([])
  const [quality, setQuality] = useState<QualitySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    Promise.all([
      apiGet<{ calls: CallLog[] }>("/api/calls?limit=100"),
      apiGet<{ summary: QualitySummary }>("/api/voice/quality?days=7"),
    ])
      .then(([callsData, qualityData]) => {
        setCalls(callsData.calls ?? [])
        setQuality(qualityData.summary ?? null)
      })
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
      <Text style={styles.title}>Operations</Text>
      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiValue}>{quality ? `${quality.answer_rate_percent.toFixed(1)}%` : "--"}</Text>
          <Text style={styles.kpiLabel}>Answer rate</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiValue}>
            {quality?.avg_setup_ms != null ? `${Math.round(quality.avg_setup_ms)}ms` : "--"}
          </Text>
          <Text style={styles.kpiLabel}>Avg setup</Text>
        </View>
      </View>
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
  kpiRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  kpiCard: { flex: 1, backgroundColor: "#1e293b", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#334155" },
  kpiValue: { fontSize: 16, fontWeight: "700", color: "#f8fafc" },
  kpiLabel: { fontSize: 11, color: "#94a3b8", marginTop: 2 },
  muted: { fontSize: 14, color: "#64748b" },
  card: { backgroundColor: "#1e293b", borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#334155" },
  fromTo: { fontSize: 14, color: "#f8fafc" },
  meta: { fontSize: 12, color: "#94a3b8", marginTop: 4 },
})
