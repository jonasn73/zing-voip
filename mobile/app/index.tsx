import { useEffect } from "react"
import { View, ActivityIndicator, StyleSheet } from "react-native"
import { useRouter } from "expo-router"

// Go straight to login so the app always loads (no API call on first screen).
// If the backend is unreachable (e.g. localhost on a device), this avoids a crash.
export default function Index() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/login")
  }, [router])

  return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color="#6366f1" />
    </View>
  )
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0f172a",
  },
})
