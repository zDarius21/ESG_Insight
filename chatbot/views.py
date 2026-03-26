import json
import re
import time
import numpy as np
import faiss
import fitz  # PyMuPDF
import pdfplumber
from google import genai
from google.genai import types as genai_types

from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from sentence_transformers import SentenceTransformer

# ── Modello embedding (caricato una volta sola all'avvio) ──────────────────────
EMBEDDING_MODEL = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
_embedder = None

def get_embedder():
    global _embedder
    if _embedder is None:
        _embedder = SentenceTransformer(EMBEDDING_MODEL, device="cpu")
    return _embedder


# ── Database normative ─────────────────────────────────────────────────────────
LAW_DATABASE = [
    {"id": "CSRD", "title": "CSRD - Corporate Sustainability Reporting Directive",
     "text": "La Direttiva CSRD (2022/2464/UE) obbliga le grandi imprese a pubblicare informazioni sulla sostenibilità secondo gli standard ESRS. Le aziende devono rendicontare impatti ambientali (clima, biodiversità, uso delle risorse), sociali (forza lavoro, comunità) e di governance. Obbligo di doppia materialità."},
    {"id": "EU_TAXONOMY", "title": "EU Taxonomy Regulation (2020/852)",
     "text": "Il Regolamento UE sulla Tassonomia classifica le attività economiche sostenibili. I 6 obiettivi: mitigazione cambiamenti climatici, adattamento, uso sostenibile acqua, economia circolare, prevenzione inquinamento, biodiversità. Principio DNSH (Do No Significant Harm)."},
    {"id": "ISO_14001", "title": "ISO 14001:2015 - Sistemi di Gestione Ambientale",
     "text": "La norma ISO 14001 specifica i requisiti per un sistema di gestione ambientale (SGA). Requisiti: identificazione aspetti ambientali significativi, conformità requisiti legali, obiettivi ambientali misurabili, audit interni, miglioramento continuo."},
    {"id": "ISO_9001", "title": "ISO 9001:2015 - Sistemi di Gestione per la Qualità",
     "text": "La norma ISO 9001 definisce i requisiti per un SGQ. Punti chiave: approccio per processi, pensiero basato sul rischio, leadership del top management, gestione non conformità e azioni correttive, audit interni."},
    {"id": "ISO_45001", "title": "ISO 45001:2018 - Salute e Sicurezza sul Lavoro",
     "text": "ISO 45001 specifica i requisiti per un sistema di gestione SSL. Obblighi: identificazione pericoli, valutazione rischi, obiettivi SSL misurabili, consultazione lavoratori, indagine su incidenti e infortuni. Indice di frequenza infortuni (IFR)."},
    {"id": "ISO_27001", "title": "ISO 27001:2022 - Sicurezza delle Informazioni",
     "text": "ISO 27001 specifica i requisiti per un ISMS. Controlli: valutazione rischio informatico, politiche sicurezza, gestione data breach, Business Continuity, conformità GDPR."},
    {"id": "GRI_2021", "title": "GRI Standards 2021 - Global Reporting Initiative",
     "text": "I GRI Standards sono i più utilizzati per il reporting di sostenibilità. GRI 300: Environmental (energia, emissioni, acqua, rifiuti). GRI 400: Social (occupazione, salute, diritti umani). Obbligo di disclosure sulla doppia materialità."},
    {"id": "DLGS_254", "title": "D.Lgs 254/2016 - Dichiarazione Non Finanziaria (DNF)",
     "text": "Il D.Lgs 254/2016 recepisce la Direttiva 2014/95/UE. Obbligo per enti di interesse pubblico con >500 dipendenti. La DNF deve coprire: ambiente, emissioni GHG, sociale, anticorruzione, diversità nei CdA."},
    {"id": "ESRS_E1", "title": "ESRS E1 - Cambiamenti Climatici",
     "text": "ESRS E1 riguarda la rendicontazione sui cambiamenti climatici. Disclosure obbligatorie: emissioni GHG Scope 1, 2 e 3, target di riduzione allineati a 1.5°C (SBTi), intensità carbonica, investimenti green taxonomy-aligned."},
    {"id": "DLGS_231", "title": "D.Lgs 231/2001 - Responsabilità Amministrativa Enti",
     "text": "Il D.Lgs 231/2001 disciplina la responsabilità amministrativa delle persone giuridiche. Esimente: adozione di un Modello di Organizzazione e Gestione (MOG). Il MOG deve includere mappatura aree a rischio, protocolli di controllo, Organismo di Vigilanza (OdV)."},
]

# ── Indice FAISS per normative (costruito una volta sola) ─────────────────────
_law_index = None
_law_embeddings = None

def get_law_index():
    global _law_index, _law_embeddings
    if _law_index is None:
        embedder = get_embedder()
        texts = [f"passage: {law['text']}" for law in LAW_DATABASE]
        _law_embeddings = embedder.encode(texts, normalize_embeddings=True).astype(np.float32)
        _law_index = faiss.IndexFlatIP(_law_embeddings.shape[1])
        _law_index.add(_law_embeddings)
    return _law_index


def retrieve_relevant_laws(query: str, k: int = 3) -> list:
    embedder = get_embedder()
    index = get_law_index()
    q_emb = embedder.encode([f"query: {query}"], normalize_embeddings=True).astype(np.float32)
    scores, indices = index.search(q_emb, k)
    return [
        {"title": LAW_DATABASE[i]["title"], "text": LAW_DATABASE[i]["text"], "score": float(s)}
        for s, i in zip(scores[0], indices[0]) if i != -1
    ]


# ── Estrazione testo da PDF ────────────────────────────────────────────────────
def extract_text_from_pdf(file) -> str:
    try:
        doc = fitz.open(stream=file.read(), filetype="pdf")
        pages = []
        for page_num, page in enumerate(doc):
            text = page.get_text("text")
            if text.strip():
                pages.append(f"[Pagina {page_num + 1}]\n{text}")
        doc.close()
        return "\n\n".join(pages)
    except Exception:
        file.seek(0)
        full_text = ""
        with pdfplumber.open(file) as pdf:
            for i, page in enumerate(pdf.pages):
                text = page.extract_text()
                if text:
                    full_text += f"\n\n--- PAGINA {i+1} ---\n{text}"
        return full_text


# ── Chunking ──────────────────────────────────────────────────────────────────
def chunk_text(text: str, chunk_size: int = 400, overlap: int = 40) -> list:
    article_pattern = re.compile(r'(Articolo\s+\d+[a-z]?\s*[-–])', re.IGNORECASE)
    parts = article_pattern.split(text)
    chunks = []
    if len(parts) > 3:
        i = 1
        while i < len(parts) - 1:
            content = f"{parts[i].strip()}\n{parts[i+1].strip()}" if i+1 < len(parts) else parts[i].strip()
            if content.strip():
                chunks.append(content)
            i += 2
    else:
        words = text.split()
        for i in range(0, len(words), chunk_size - overlap):
            chunk = " ".join(words[i:i + chunk_size])
            if chunk.strip():
                chunks.append(chunk)
    return chunks


# ── Rilevamento tipo documento ─────────────────────────────────────────────────
DOCUMENT_KEYWORDS = {
    "ISO 9001": ["iso 9001", "sistema di gestione qualità", "sgq", "non conformità"],
    "ISO 14001": ["iso 14001", "sistema di gestione ambientale", "impatto ambientale"],
    "ISO 45001": ["iso 45001", "salute e sicurezza", "rischio occupazionale"],
    "ISO 27001": ["iso 27001", "sicurezza informazioni", "data breach"],
    "Bilancio ESG": ["esg", "sostenibilità", "scope 1", "scope 2", "emissioni co2", "gri", "esrs", "csrd"],
    "DNF": ["dichiarazione non finanziaria", "dnf"],
    "Bilancio": ["stato patrimoniale", "conto economico", "ebitda", "ricavi"],
}

def detect_document_type(text: str) -> list:
    tl = text.lower()
    return [t for t, kws in DOCUMENT_KEYWORDS.items() if any(k in tl for k in kws)] or ["Documento Generico"]


def extract_kpis(text: str) -> list:
    patterns = [r'\b\d+[\.,]?\d*\s*%', r'\b\d+[\.,]?\d*\s*(ton|kg|kwh|mwh|tco2)', r'€\s*\d+[\.,]?\d*']
    kpis = []
    for p in patterns:
        kpis.extend(re.findall(p, text.lower()))
    return list(set([k if isinstance(k, str) else k[0] for k in kpis]))[:10]


GEMINI_MODEL = 'gemini-2.5-flash'


def get_gemini_client():
    return genai.Client(api_key=settings.GEMINI_API_KEY)


def gemini_generate(prompt, retries=3):
    """Chiama Gemini con retry automatico in caso di rate limit (429)."""
    for attempt in range(retries):
        try:
            client = get_gemini_client()
            return client.models.generate_content(model=GEMINI_MODEL, contents=prompt)
        except Exception as e:
            if '429' in str(e) and attempt < retries - 1:
                wait = 30 * (attempt + 1)
                time.sleep(wait)
            else:
                raise


# ── VIEW: Chat semplice ────────────────────────────────────────────────────────
@csrf_exempt
@require_http_methods(["POST"])
def chat(request):
    try:
        data = json.loads(request.body)
        messages = data.get('messages', [])
        if not messages:
            return JsonResponse({'error': 'Nessun messaggio fornito'}, status=400)

        client = get_gemini_client()
        history = [
            genai_types.Content(
                role='user' if m['role'] == 'user' else 'model',
                parts=[genai_types.Part(text=m['content'])]
            )
            for m in messages[:-1]
        ]
        session = client.chats.create(model=GEMINI_MODEL, history=history)
        response = session.send_message(messages[-1]['content'])
        return JsonResponse({'reply': response.text})

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


# ── VIEW: Analisi documento ────────────────────────────────────────────────────
@csrf_exempt
@require_http_methods(["POST"])
def analyze_document(request):
    try:
        # Estrai testo
        if request.FILES.get('file'):
            f = request.FILES['file']
            if f.name.endswith('.pdf'):
                text = extract_text_from_pdf(f)
            else:
                text = f.read().decode('utf-8', errors='ignore')
        elif request.content_type == 'application/json':
            data = json.loads(request.body)
            text = data.get('text', '')
        else:
            return JsonResponse({'error': 'Invia un file PDF/TXT o testo JSON'}, status=400)

        if not text.strip():
            return JsonResponse({'error': 'Documento vuoto o non leggibile'}, status=400)

        # Metadati
        doc_types = detect_document_type(text)
        kpis = extract_kpis(text)
        chunks = chunk_text(text)[:5]  # max 5 sezioni per velocità

        # Analisi per chunk
        section_results = []
        all_laws_cited = []

        for i, chunk in enumerate(chunks):
            laws = retrieve_relevant_laws(chunk, k=3)
            all_laws_cited.extend([l['title'] for l in laws])

            laws_context = "\n\n".join([f"[{l['title']}]\n{l['text']}" for l in laws])
            prompt = f"""Sei un esperto di normative ESG, ISO e compliance aziendale.
Analizza il seguente estratto di documento rispetto alle normative indicate.

ESTRATTO:
{chunk[:800]}

NORMATIVE RILEVANTI:
{laws_context}

Rispondi in italiano con:
1. ✅ Elementi conformi
2. ⚠️ Gap di conformità
3. 🔧 Azioni correttive raccomandate

Sii conciso e specifico."""

            resp = gemini_generate(prompt)
            section_results.append({
                "sezione": i + 1,
                "testo_estratto": chunk[:200] + "...",
                "normative_correlate": [l['title'] for l in laws],
                "analisi": resp.text,
            })

        report = {
            "tipo_documento": doc_types,
            "kpi_rilevati": kpis,
            "normative_analizzate": list(set(all_laws_cited)),
            "totale_sezioni": len(section_results),
            "sezioni": section_results,
        }

        return JsonResponse(report)

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

