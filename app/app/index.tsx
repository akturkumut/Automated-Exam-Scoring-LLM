import { CameraView, useCameraPermissions } from "expo-camera";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  View,
} from "react-native";
import { setOcrResult } from "../utils/store";

type PhotoType = {
  uri: string;
  base64?: string;
  width?: number;
  height?: number;
};

type QuestionSet = {
  id: string;
  question: string;
  correctAnswer: string;
  point :number;
  photos: PhotoType[];
};

const generateId = () => Date.now().toString() + Math.random().toString(36).slice(2);
const emptySet = (): QuestionSet => ({
  id: generateId(),
  question: "",
  correctAnswer: "",
  point: 0,
  photos: [],
});

export default function App() {
  const router = useRouter();

  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([emptySet()]);
  const [permission, requestPermission] = useCameraPermissions();
  const [activeCameraSetId, setActiveCameraSetId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [navigateNow, setNavigateNow] = useState(false);
  const ref = useRef<CameraView>(null);

  useEffect(() => {
    if (navigateNow) {
      router.push("/resultsOcr");
      setNavigateNow(false);
    }
  }, [navigateNow]);

  if (!permission) return null;

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.permissionText}>Kamera iznine ihtiyacımız var</Text>
        <Pressable style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionBtnText}>İzin Ver</Text>
        </Pressable>
      </View>
    );
  }

  const addQuestionSet = () => setQuestionSets((prev) => [...prev, emptySet()]);
  const removeQuestionSet = (id: string) => setQuestionSets((prev) => prev.filter((s) => s.id !== id));
  const updateField = (id: string, field: "question" | "correctAnswer" | "point", value: string | number) =>
    setQuestionSets((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));

  const addPhotoToSet = (setId: string, photo: PhotoType) =>
    setQuestionSets((prev) =>
      prev.map((s) => (s.id === setId ? { ...s, photos: [...s.photos, photo] } : s))
    );

  const removePhotoFromSet = (setId: string, photoUri: string) =>
    setQuestionSets((prev) =>
      prev.map((s) =>
        s.id === setId ? { ...s, photos: s.photos.filter((p) => p.uri !== photoUri) } : s
      )
    );

  const pickImageForSet = async (setId: string) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("İzin Gerekli", "Medya kütüphanesi iznine ihtiyaç var.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 1,
      base64: true,
    });
    if (!result.canceled) {
      result.assets.forEach((asset) => {
        addPhotoToSet(setId, {
          uri: asset.uri,
          base64: asset.base64 ?? undefined,
          width: asset.width,
          height: asset.height,
        });
      });
    }
  };

  const takePicture = async () => {
    if (!activeCameraSetId) return;
    const photo = await ref.current?.takePictureAsync({ base64: true, quality: 1 });
    if (photo?.uri) {
      addPhotoToSet(activeCameraSetId, {
        uri: photo.uri,
        base64: photo.base64 ?? undefined,
        width: photo.width,
        height: photo.height,
      });
      setActiveCameraSetId(null);
    }
  };

  const sendToServer = async () => {
    if (isLoading) return;

    for (const s of questionSets) {
      if (!s.question.trim()) {
        Alert.alert("Eksik Alan", "Lütfen tüm soruları doldurun.");
        return;
      }
      if (!s.correctAnswer.trim()) {
        Alert.alert("Eksik Alan", "Lütfen tüm doğru cevapları doldurun.");
        return;
      }
      if(s.point == 0){
        Alert.alert("Eksik Alan", "Lütfen tüm sorulara puan değeri atayın.");
        return;
      }
      if (s.photos.length === 0) {
        Alert.alert("Eksik Fotoğraf", `"${s.question.slice(0, 30)}..." sorusuna en az 1 fotoğraf ekleyin.`);
        return;
      }
    }

    const payload = {
      question_sets: questionSets.map((s) => ({
        question: s.question,
        correct_answer: s.correctAnswer,
        point: s.point,
        images: s.photos.filter((p) => p.base64).map((p) => p.base64 as string),
      })),
    };

    setIsLoading(true);
    try {
      const url = "https://stoicheiometrically-uncognizant-marcos.ngrok-free.dev";
      const headers = {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "69420",
      };

      const response = await fetch(`${url}/ocr`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Sunucu Hatası (${response.status}): ${errorText}`);
      }

      const resultData = await response.json();

      // Veriyi store'a yaz, params'a değil
      setOcrResult(resultData);

      if (Platform.OS === "android") {
        ToastAndroid.show("Değerlendirmeler tamamlandı!", ToastAndroid.SHORT);
      }

      setNavigateNow(true);
    } catch (error) {
      console.error("API Hatası:", error);
      Alert.alert("Hata", "İşlem sırasında bir sorun oluştu.");
    } finally {
      setIsLoading(false);
    }
  };

  if (activeCameraSetId) {
    return (
      <View style={StyleSheet.absoluteFill}>
        <CameraView style={StyleSheet.absoluteFill} ref={ref} mute={false} />
        <View style={styles.shutterContainer}>
          <Pressable onPress={takePicture}>
            {({ pressed }) => (
              <View style={[styles.shutterBtn, { opacity: pressed ? 0.5 : 1 }]}>
                <View style={[styles.shutterBtnInner, { backgroundColor: "white" }]} />
              </View>
            )}
          </Pressable>
          <Pressable style={styles.cancelBtn} onPress={() => setActiveCameraSetId(null)}>
            <Text style={styles.cancelBtnText}>İptal</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.screenTitle}>📝 Soru Setleri</Text>

      {questionSets.map((set, index) => (
        <View key={set.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Soru {index + 1}</Text>
            {questionSets.length > 1 && (
              <Pressable onPress={() => removeQuestionSet(set.id)}>
                <Text style={styles.deleteSetText}>✕ Seti Sil</Text>
              </Pressable>
            )}
          </View>

          <Text style={styles.label}>Soru</Text>
          <TextInput
            style={styles.input}
            placeholder="Soru metnini girin..."
            value={set.question}
            onChangeText={(v) => updateField(set.id, "question", v)}
            multiline
          />

          <Text style={styles.label}>Doğru Cevap</Text>
          <TextInput
            style={styles.input}
            placeholder="Doğru cevabı girin..."
            value={set.correctAnswer}
            onChangeText={(v) => updateField(set.id, "correctAnswer", v)}
            multiline
          />

          <Text style={styles.label}>Puan</Text>
          <TextInput
            style={styles.input}
            placeholder="Puanı girin..."
            value={set.point.toString()}
            onChangeText={(v) => updateField(set.id, "point", parseFloat(v) || 0)}
            keyboardType="numeric"
          />

          <View style={styles.photoActions}>
            <Pressable style={styles.photoBtn} onPress={() => pickImageForSet(set.id)}>
              <Text style={styles.photoBtnText}>🖼 Galeriden Seç</Text>
            </Pressable>
            <Pressable style={styles.photoBtn} onPress={() => setActiveCameraSetId(set.id)}>
              <Text style={styles.photoBtnText}>📷 Fotoğraf Çek</Text>
            </Pressable>
          </View>

          {set.photos.length > 0 && (
            <FlatList
              data={set.photos}
              horizontal
              keyExtractor={(item) => item.uri}
              style={styles.photoList}
              renderItem={({ item }) => (
                <View style={styles.photoThumb}>
                  <Image source={{ uri: item.uri }} contentFit="cover" style={styles.thumbImage} />
                  <Pressable
                    style={styles.deletePhotoBtn}
                    onPress={() => removePhotoFromSet(set.id, item.uri)}
                  >
                    <Text style={styles.deletePhotoText}>✕</Text>
                  </Pressable>
                </View>
              )}
            />
          )}
          <Text style={styles.photoCount}>{set.photos.length} fotoğraf eklendi</Text>
        </View>
      ))}

      <Pressable style={styles.addSetBtn} onPress={addQuestionSet}>
        <Text style={styles.addSetBtnText}>＋ Yeni Soru Seti Ekle</Text>
      </Pressable>

      <Pressable
        style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
        onPress={sendToServer}
        disabled={isLoading}
      >
        {isLoading ? (
          <View style={styles.submitBtnInner}>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={styles.submitBtnText}>  Analiz yapılıyor...</Text>
          </View>
        ) : (
          <Text style={styles.submitBtnText}>🧠 OCR Başlat ve Gönder</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#f0f2f5" },
  scrollContent: { padding: 16, paddingBottom: 60 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  permissionText: { textAlign: "center", marginBottom: 12 },
  permissionBtn: { backgroundColor: "#4361ee", borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  permissionBtnText: { color: "#fff", fontWeight: "700" },
  screenTitle: { fontSize: 24, fontWeight: "700", marginBottom: 16, color: "#1a1a2e" },
  card: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 16,
    shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#1a1a2e" },
  deleteSetText: { fontSize: 13, color: "#e74c3c" },
  label: { fontSize: 13, fontWeight: "600", color: "#555", marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: "#dde1e7", borderRadius: 10, padding: 10,
    fontSize: 14, color: "#1a1a2e", backgroundColor: "#fafafa", marginBottom: 12, minHeight: 44,
  },
  photoActions: { flexDirection: "row", gap: 8, marginBottom: 12 },
  photoBtn: { flex: 1, backgroundColor: "#eef2ff", borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  photoBtnText: { fontSize: 13, fontWeight: "600", color: "#4361ee" },
  photoList: { marginBottom: 8 },
  photoThumb: { position: "relative", marginRight: 8 },
  thumbImage: { width: 80, height: 80, borderRadius: 8 },
  deletePhotoBtn: {
    position: "absolute", top: 2, right: 2, backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 10, width: 20, height: 20, alignItems: "center", justifyContent: "center",
  },
  deletePhotoText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  photoCount: { fontSize: 12, color: "#888", marginTop: 2 },
  addSetBtn: {
    borderWidth: 2, borderColor: "#4361ee", borderStyle: "dashed",
    borderRadius: 14, paddingVertical: 14, alignItems: "center", marginBottom: 16,
  },
  addSetBtnText: { fontSize: 15, fontWeight: "700", color: "#4361ee" },
  submitBtn: { backgroundColor: "#4361ee", borderRadius: 14, paddingVertical: 16, alignItems: "center", marginBottom: 20 },
  submitBtnDisabled: { backgroundColor: "#a0aec0" },
  submitBtnInner: { flexDirection: "row", alignItems: "center" },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  shutterContainer: {
    position: "absolute", bottom: 44, width: "100%",
    alignItems: "center", flexDirection: "row",
    justifyContent: "center", paddingHorizontal: 30, gap: 24,
  },
  shutterBtn: {
    backgroundColor: "transparent", borderWidth: 5, borderColor: "white",
    width: 85, height: 85, borderRadius: 45, alignItems: "center", justifyContent: "center",
  },
  shutterBtnInner: { width: 70, height: 70, borderRadius: 50 },
  cancelBtn: { backgroundColor: "rgba(255,255,255,0.25)", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  cancelBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
