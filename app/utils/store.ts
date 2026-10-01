// Expo Router params büyük JSON'ları bozabiliyor.
// OCR sonuçlarını params yerine burada saklıyoruz.

let ocrResult: any = null;

export const setOcrResult = (data: any) => {
  ocrResult = data;
};

export const getOcrResult = () => ocrResult;
