import * as Linking from 'expo-linking';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { getOcrResult } from "../utils/store";

type StudentResult = {
  image_index: number;
  ocr_text: string;
  simQS: number;
  simSC: number;
  point: number;
  model_response: string;
};

type QuestionResult = {
  question_index: number;
  question: string;
  correct_answer: string;
  analysis: StudentResult[];
};

export default function ResultsOcrScreen() {
  const data = getOcrResult();
  const [isDownloading, setIsDownloading] = useState(false);
  
  // Backend {results: [...]} şeklinde döndürüyor
  const results: QuestionResult[] = data?.results || [];

  const downloadExcel = async () => {
    if (results.length === 0) {
      Alert.alert("Hata", "Dışa aktarılacak veri yok.");
      return;
    }

    setIsDownloading(true);
    try {
      const url = "https://stoicheiometrically-uncognizant-marcos.ngrok-free.dev";
      const response = await fetch(`${url}/export-excel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results })
      });

      if (!response.ok) {
        throw new Error('Sunucudan hata döndü');
      }

      const { download_url } = await response.json();

      // Download linki aç
      await Linking.openURL(download_url);

      Alert.alert("Başarılı", "Excel dosyası indirildi!");
    } catch (error) {
      console.error('İndirme hatası:', error);
      Alert.alert('Hata', 'Dosya indirilemedi. Lütfen tekrar deneyin.');
    } finally {
      setIsDownloading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.7) return "#27ae60";
    if (score >= 0.4) return "#f39c12";
    return "#e74c3c";
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>📊 OCR Analiz Sonuçları</Text>

      {results.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Veri yüklenemedi veya sonuç bulunamadı.</Text>
        </View>
      ) : (
        results.map((res) => (
          <View key={res.question_index} style={styles.card}>
            {/* Soru Başlığı */}
            <View style={styles.cardHeader}>
              <Text style={styles.cardHeaderText}>Soru {res.question_index}</Text>
            </View>

            <View style={styles.cardBody}>
              <Text style={styles.label}>❓ Soru</Text>
              <Text style={styles.content2}>{res.question}</Text>

              <Text style={styles.label}>✅ Doğru Cevap</Text>
              <Text style={styles.content2}>{res.correct_answer}</Text>
            </View>

            <Text style={styles.analysisTitle}>
              👥 Öğrenci Cevapları ({res.analysis.length} kişi)
            </Text>

            {(res.analysis || []).map((evalItem) => (
              <View key={evalItem.image_index} style={styles.studentCard}>
                <Text style={styles.studentIndex}>Öğrenci {evalItem.image_index}</Text>

                <Text style={styles.label}>📝 Okunan Metin</Text>
                <Text style={styles.content2}>{evalItem.ocr_text || "Metin çıkarılamadı."}</Text>

                <View style={styles.scoreRow}>
                  <View style={styles.scoreBox}>
                    <Text style={styles.scoreLabel}>Soru Uyumu</Text>
                    <Text style={[styles.scoreValue, { color: getScoreColor(evalItem.simQS) }]}>
                      %{(evalItem.simQS * 100).toFixed(0)}
                    </Text>
                  </View>
                  <View style={styles.scoreBox}>
                    <Text style={styles.scoreLabel}>Cevap Doğruluğu</Text>
                    <Text style={[styles.scoreValue, { color: getScoreColor(evalItem.simSC) }]}>
                      %{(evalItem.simSC * 100).toFixed(0)}
                    </Text>
                  </View>
                </View>

                <Text style={styles.label}>🤖 Yapay Zeka Yorumu</Text>
                <Text style={styles.modelResponse}>{evalItem.model_response}</Text>

                <Text style={styles.label}>📊 Puan</Text>
                <Text style={styles.modelResponse}>{evalItem.point}</Text>
              </View>
            ))}
          </View>
        ))
      )}

      {results.length > 0 && (
        <View style={styles.downloadBtnContainer}>
          <Pressable
            style={[styles.downloadBtn, isDownloading && styles.downloadBtnDisabled]}
            onPress={downloadExcel}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <View style={styles.downloadBtnContent}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.downloadBtnText}>  İndiriliyor...</Text>
              </View>
            ) : (
              <Text style={styles.downloadBtnText}>📥 Excel Olarak İndir</Text>
            )}
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0f2f5" },
  content: { padding: 16, paddingBottom: 60 },
  title: { fontSize: 22, fontWeight: "700", color: "#1a1a2e", marginBottom: 20, textAlign: "center" },
  emptyState: { alignItems: "center", marginTop: 50 },
  emptyText: { color: "#888" },

  card: {
    backgroundColor: "#fff", borderRadius: 16, marginBottom: 20,
    overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  cardHeader: { backgroundColor: "#4361ee", paddingHorizontal: 16, paddingVertical: 12 },
  cardHeaderText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  cardBody: { padding: 14, borderBottomWidth: 1, borderBottomColor: "#eee" },

  analysisTitle: {
    fontSize: 13, fontWeight: "700", color: "#555",
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 6,
  },

  studentCard: {
    backgroundColor: "#f8f9ff", marginHorizontal: 12, marginBottom: 12,
    borderRadius: 12, padding: 12, borderLeftWidth: 3, borderLeftColor: "#4361ee",
  },
  studentIndex: { fontWeight: "700", fontSize: 14, color: "#4361ee", marginBottom: 6 },

  label: {
    fontSize: 11, fontWeight: "600", color: "#888",
    marginTop: 8, marginBottom: 2, textTransform: "uppercase", letterSpacing: 0.5,
  },
  content2: { fontSize: 14, color: "#1a1a2e", lineHeight: 20 },
  modelResponse: { fontSize: 13, color: "#333", lineHeight: 20, fontStyle: "italic" },

  scoreRow: { flexDirection: "row", gap: 10, marginTop: 10, marginBottom: 4 },
  scoreBox: {
    flex: 1, backgroundColor: "#fff", borderRadius: 10, padding: 10,
    alignItems: "center", borderWidth: 1, borderColor: "#eee",
  },
  scoreLabel: { fontSize: 11, color: "#888", marginBottom: 4 },
  scoreValue: { fontSize: 20, fontWeight: "700" },
  downloadBtnContainer: {
    width: '100%', alignItems: 'center', marginTop: 24, marginBottom: 20, paddingHorizontal: 16,
  },
  downloadBtn: {
    backgroundColor: "#27ae60", borderRadius: 14, paddingVertical: 16,
    paddingHorizontal: 20, alignItems: "center", justifyContent: "center",
    width: '100%', maxWidth: 350,
  },
  downloadBtnDisabled: { backgroundColor: "#a0aec0" },
  downloadBtnContent: { flexDirection: "row", alignItems: "center" },
  downloadBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
