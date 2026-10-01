# Automated-Exam-Scoring-LLM

Automated assessment of open-ended student exams using LLMs (**Qwen3-4B**, **SBERT**, **LoRA**) and **Tesseract OCR**.

This repository contains the code, datasets and thesis of my Computer Engineering graduation project at Karabük University:
**"Automated Assessment of Open-Ended Student Exams Using LLM: A Biology Course Example"** (Turkish: *Açık Uçlu Öğrenci Sınavlarının LLM ile Otomatik Değerlendirilmesi: Biyoloji Dersi Örneği*), supervised by Assoc. Prof. Dr. Yasin Ortakçı.

---

## Overview

Grading open-ended questions is time-consuming and subjective. Most existing work relies on large, closed-source models and focuses on essays rather than short answers. This project shows that **small, open-source LLMs (3B-4B parameters)**, fine-tuned with LoRA and supported by **semantic similarity features from a Turkish SBERT model**, can score short biology answers reliably.

The system is an end-to-end pipeline:

```
Exam paper image ──► Tesseract OCR ──► student answer text
                                              │
              question + reference answer ────┤
                                              ▼
                       SBERT (Turkish) ─► simQS, simSC (cosine similarity)
                                              │
                                              ▼
                     Fine-tuned LLM (LoRA) ─► score + analysis
                                              │
                                              ▼
                        Flask backend ─► React Native (Expo) mobile app
```

## Key Features

- **Hybrid scoring**: LLM reasoning combined with SBERT-based semantic features.
- **Semantic features in the prompt**: two cosine-similarity scores are added to the model input:
  - `simQS`: similarity between the **q**uestion and the **s**tudent answer
  - `simSC`: similarity between the **s**tudent answer and the **c**orrect (reference) answer
  
  They help separate tricky cases such as answers that discuss the topic but never answer the question (high `simQS`, low `simSC`).
- **Three models compared**: Qwen3-4B-Instruct-2507, Qwen2.5-3B-Instruct, OpenLLaMA-3B.
- **Efficient training**: Unsloth + LoRA + 4-bit quantization, trained on Google Colab.
- **OCR input**: Tesseract extracts text from digital images of answer sheets.
- **Mobile client**: React Native (Expo) interface backed by a Flask API (exposed with Ngrok during prototyping).

## Dataset

| Property | Value |
|----------|-------|
| Total records | 1,116 (992 train / 124 validation) |
| Questions | 31 questions, 36 answers each |
| External test set | 199 samples, independent of the training pool |
| Topics | Cell membrane and transport, organelles, energy metabolism (ATP, enzymes), genetic molecules, protein synthesis, cell division |
| Generation | Synthetic, produced with ChatGPT, Gemini and Claude |
| Score scale | 0-1 |

Each question has 12 answer scenarios, so the model learns more than right/wrong: fully correct, mostly correct, superficial, very short or short correct, incomplete, contradictory, mixed correct and incorrect, off-topic but on-subject (evasive), short incorrect, and completely irrelevant answers.

Two versions of the data are provided: **with** and **without** the SBERT similarity features.

## Repository Structure

```
Automated-Exam-Scoring-LLM/
├── app/              # Mobile application
├── docs/             # Thesis (Turkish)
├── src/
│   ├── backend pipeline notebook (.ipynb)     # OCR → SBERT → LLM scoring backend
│   ├── datasets (with / without SBERT features)
│   ├── fine-tuning notebooks (.ipynb)         # one with SBERT features, one without
│   ├── SBERT similarity computation           # adds simQS / simSC to the dataset
│   └── change_to_jsonl.py                     # converts JSON datasets to JSONL
├── important.txt     # Notes about dataset files
├── LICENSE           # Apache-2.0
└── README.md
```

> TODO: replace the descriptive names above with the exact file names in `src/`.

## Getting Started

### Prerequisites

- Python 3.10+
- A GPU runtime for fine-tuning (the experiments were run on Google Colab)
- [Tesseract OCR](https://github.com/tesseract-ocr/tesseract) installed and on your `PATH`
- Node.js and Expo CLI (only for the mobile app)

### Installation

```bash
git clone https://github.com/akturkumut/Automated-Exam-Scoring-LLM.git
cd Automated-Exam-Scoring-LLM
```

Main Python dependencies used in the notebooks: `unsloth`, `transformers`, `trl`, `peft`, `sentence-transformers`, `bert-score`, `pytesseract`, `flask`.

### Data Preparation

The datasets are included as JSON files. File names used inside the code may differ slightly from the actual names; please ignore these naming inconsistencies.

JSONL files are **not** included. Convert the JSON files with:

```bash
python src/change_to_jsonl.py
```

### Workflow

1. **Compute SBERT features**: run the similarity script to add `simQS` and `simSC` to the dataset (model: [`emrecan/bert-base-turkish-cased-mean-nli`](https://huggingface.co/emrecan/bert-base-turkish-cased-mean-nli)).
2. **Convert to JSONL**: `python src/change_to_jsonl.py`.
3. **Fine-tune**: open the fine-tuning notebook (with or without SBERT features) in Colab and run it.
4. **Serve**: run the backend pipeline notebook to start the Flask API, then connect the mobile app in `app/`.

## Training Setup

| Setting | Value |
|---------|-------|
| Method | Supervised fine-tuning (SFT) with LoRA, via Unsloth |
| Quantization | 4-bit |
| Max sequence length | 2048 |
| LoRA r / alpha / dropout | 16 / 32 / 0.05 |
| Target modules | q, k, v, o, gate, up, down projections |
| Max steps | 500 (about 3.58 epochs) |
| Batch size | 2 per device × 4 gradient accumulation = 8 |
| Learning rate | 2e-4 |
| Optimizer | AdamW 8-bit |
| Validation | every 50 steps; best checkpoint by lowest `eval_loss` |

All models use identical hyperparameters for a fair comparison.

## Results

Fine-tuned models on the 199-sample external test set (**with** SBERT features):

| Model | Test Loss | Perplexity | MAE ↓ | BERTScore F1 | Format compliance |
|-------|-----------|------------|-------|--------------|-------------------|
| **Qwen3-4B-Instruct** | **1.2657** | **3.55** | **0.1635** | 0.5198 | **199/199** |
| Qwen2.5-3B-Instruct | 1.5921 | 4.91 | 0.1959 | 0.5138 | 199/199 |
| OpenLLaMA-3B | 1.4023 | 4.06 | 0.1928 | 0.5035 | 181/199 |

Effect of SBERT features on the fine-tuned models:

| Model | MAE without SBERT | MAE with SBERT | Format without → with |
|-------|-------------------|----------------|-----------------------|
| Qwen3-4B-Instruct | 0.2395 | 0.1635 | 199 → 199 |
| Qwen2.5-3B-Instruct | 0.2116 | 0.1959 | 199 → 199 |
| OpenLLaMA-3B | 0.3074 | 0.1928 | 47 → 181 |

**Takeaways**

- LoRA fine-tuning sharply reduced loss and perplexity for all models and taught them the required output format (raw OpenLLaMA-3B produced **0/199** valid outputs).
- SBERT features lowered MAE and improved format compliance for the fine-tuned models, and lowered validation loss for all three.
- Qwen3-4B-Instruct performed best overall. Its BERTScore F1 was slightly lower with SBERT features (0.5285 → 0.5198), while recall increased.
- MAE is computed only on outputs in the expected format, so it should be read together with format compliance.

## Limitations

- The dataset is **synthetic** and limited to biology; results may not transfer to real student answers or other subjects.
- OCR was evaluated on clean, digitally created images; **handwriting is not supported**.
- Possible overfitting due to the small dataset.
- Statistical significance tests were not performed.

## Future Work

- Extend the dataset to other disciplines and real student answers
- Reduce overfitting
- Compare with larger models
- Add handwriting recognition to the OCR component

## Citation

```bibtex
@thesis{akturk2026examscoring,
  author = {Aktürk, Umut Toprak},
  title  = {Açık Uçlu Öğrenci Sınavlarının LLM ile Otomatik Değerlendirilmesi: Biyoloji Dersi Örneği},
  school = {Karabük Üniversitesi},
  year   = {2026},
  type   = {Bitirme Projesi Tezi}
}
```

## License

Distributed under the Apache-2.0 License. See [`LICENSE`](LICENSE).

## Author

**Umut Toprak Aktürk**, Computer Engineering, Karabük University ([@akturkumut](https://github.com/akturkumut)).
