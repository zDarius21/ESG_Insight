import json
import re
import hashlib
from textwrap import wrap
from datetime import datetime
import numpy as np
import faiss
import fitz  # PyMuPDF
import pdfplumber
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, pipeline

from django.conf import settings
from django.http import JsonResponse, HttpResponse
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

LAW_COMPLIANCE_RULES = {
    "CSRD - Corporate Sustainability Reporting Directive": {
        "must_groups": [
            ["csrd", "corporate sustainability reporting directive"],
            ["doppia materialita", "double materiality", "materialita"],
            ["esrs", "european sustainability reporting standards"],
            ["scope 1", "scope 2"],
        ],
        "actions": [
            "Documentare metodologia di doppia materialita con stakeholder engagement tracciato.",
            "Allineare il report ai requisiti ESRS con evidenze per ogni disclosure.",
        ],
    },
    "EU Taxonomy Regulation (2020/852)": {
        "must_groups": [
            ["taxonomy", "tassonomia"],
            ["dnsh", "do no significant harm"],
            ["social safeguards", "garanzie sociali"],
            ["quota", "allineati", "capex", "opex", "ricavi allineati"],
        ],
        "actions": [
            "Aggiungere evidenze DNSH per le attivita dichiarate allineate alla tassonomia.",
            "Documentare social safeguards e metodo di calcolo KPI taxonomy (ricavi/capex/opex).",
        ],
    },
    "ISO 14001:2015 - Sistemi di Gestione Ambientale": {
        "must_groups": [
            ["iso 14001"],
            ["audit interno", "audit ambientale"],
            ["non conformita", "azioni correttive"],
            ["obiettivi ambientali", "aspetti ambientali"],
        ],
        "actions": [
            "Esplicitare obiettivi ambientali misurabili, audit e chiusura non conformita.",
        ],
    },
    "ISO 45001:2018 - Salute e Sicurezza sul Lavoro": {
        "must_groups": [
            ["iso 45001"],
            ["infortuni", "ifr", "indice frequenza"],
            ["rischi", "valutazione rischi"],
            ["audit interno", "azioni correttive"],
        ],
        "actions": [
            "Integrare indicatori SSL (IFR/gravita) con trend, target e piani correttivi.",
        ],
    },
    "ISO 27001:2022 - Sicurezza delle Informazioni": {
        "must_groups": [
            ["iso 27001", "isms"],
            ["risk assessment", "valutazione rischio", "rischio informatico"],
            ["data breach", "incidenti"],
            ["business continuity", "disaster recovery"],
        ],
        "actions": [
            "Completare certificazione ISO 27001 e formalizzare gestione incidenti/data breach.",
        ],
    },
    "GRI Standards 2021 - Global Reporting Initiative": {
        "must_groups": [
            ["gri"],
            ["gri 2", "general disclosures"],
            ["gri 3", "material topics"],
            ["gri 300", "environmental"],
            ["gri 400", "social"],
        ],
        "actions": [
            "Completare disclosure GRI 300 e GRI 400 con KPI e perimetro metodologico.",
        ],
    },
    "D.Lgs 254/2016 - Dichiarazione Non Finanziaria (DNF)": {
        "must_groups": [
            ["dnf", "dichiarazione non finanziaria", "d.lgs 254"],
            ["ambiente", "emissioni"],
            ["sociale", "lavoratori", "diritti umani"],
            ["anticorruzione"],
        ],
        "actions": [
            "Integrare sezione DNF su anticorruzione, diritti umani e metriche sociali complete.",
        ],
    },
    "ESRS E1 - Cambiamenti Climatici": {
        "must_groups": [
            ["esrs e1", "cambiamenti climatici"],
            ["scope 1", "scope 2", "scope 3"],
            ["target", "1.5", "riduzione emissioni"],
            ["rischi fisici", "transizione"],
        ],
        "actions": [
            "Rendere completa la rendicontazione Scope 3 e piano di transizione climatica con milestone.",
        ],
    },
}

DOC_TYPE_TO_LAWS = {
    "Bilancio ESG": [
        "CSRD - Corporate Sustainability Reporting Directive",
        "EU Taxonomy Regulation (2020/852)",
        "GRI Standards 2021 - Global Reporting Initiative",
        "D.Lgs 254/2016 - Dichiarazione Non Finanziaria (DNF)",
        "ESRS E1 - Cambiamenti Climatici",
    ],
    "DNF": ["D.Lgs 254/2016 - Dichiarazione Non Finanziaria (DNF)"],
    "ISO 14001": ["ISO 14001:2015 - Sistemi di Gestione Ambientale"],
    "ISO 45001": ["ISO 45001:2018 - Salute e Sicurezza sul Lavoro"],
    "ISO 27001": ["ISO 27001:2022 - Sicurezza delle Informazioni"],
}

LAW_ALIASES = {
    "CSRD - Corporate Sustainability Reporting Directive": [
        "csrd",
        "corporate sustainability reporting directive",
        "direttiva 2022/2464",
        "direttiva (ue) 2022/2464",
    ],
    "EU Taxonomy Regulation (2020/852)": [
        "eu taxonomy",
        "tassonomia",
        "regolamento (ue) 2020/852",
        "taxonomy regulation",
    ],
    "GRI Standards 2021 - Global Reporting Initiative": [
        "gri standards",
        "global reporting initiative",
        "gri",
    ],
    "D.Lgs 254/2016 - Dichiarazione Non Finanziaria (DNF)": [
        "d.lgs 254/2016",
        "dichiarazione non finanziaria",
        "dnf",
        "direttiva 2014/95/ue",
    ],
    "ESRS E1 - Cambiamenti Climatici": [
        "esrs e1",
        "e1 cambiamenti climatici",
        "european sustainability reporting standards e1",
    ],
}

FORMAL_COMPLIANCE_MARKERS = [
    "conforme",
    "in conformita",
    "redatto ai sensi",
    "ai sensi",
    "in ottemperanza",
    "compliant",
    "si certifica",
]

NEGATION_MARKERS = [
    "non conforme",
    "non in conformita",
    "non compliant",
    "assenza di conformita",
    "mancata conformita",
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


def _stable_pseudonym(value: str, label: str) -> str:
    return f"[{label}]"


def run_file_etl_anonymization(raw_text: str) -> str:
    # ETL applicata solo ai file utente:
    # Extract: testo estratto dal file
    # Transform: anonimizzazione dati sensibili
    # Load: testo anonimizzato in-memory verso il modello
    if not raw_text:
        return ""

    text = raw_text.replace("\r\n", "\n").replace("\r", "\n")

    patterns = [
        (r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", "EMAIL"),
        (r"\bIT\d{2}[A-Z0-9]{11,30}\b", "IBAN"),
        (r"\b[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]\b", "FISCAL_CODE"),
        (r"\b(?:P\.?\s*IVA|Partita\s*IVA)\s*[:\-]?\s*\d{11}\b", "VAT"),
        (r"\b\d{11}\b", "ID_NUMBER"),
        (r"\b(?:via|viale|piazza|corso|largo)\s+[A-Za-zÀ-ÿ'\-\s]{3,80},?\s*\d{1,5}\b", "ADDRESS"),
        (r"\bhttps?://[^\s]+\b", "URL"),
        # Ragioni sociali aziendali tipiche italiane
        (r"\b[A-Za-zÀ-ÿ0-9&'\-\s]{3,140}\s+(?:S\.p\.A\.|S\.r\.l\.|S\.a\.s\.|S\.n\.c\.|SRL|SPA)", "COMPANY"),
    ]

    for pattern, label in patterns:
        def _replace(match):
            return _stable_pseudonym(match.group(0), label)

        text = re.sub(pattern, _replace, text, flags=re.IGNORECASE)

    # Citta con sigla provincia, es: "Vimercate (MB)", "Roma (RM)"
    city_with_province_pattern = r"\b([A-Z][A-Za-zÀ-ÿ'’\-]+(?:\s[A-Z][A-Za-zÀ-ÿ'’\-]+){0,2})\s*\(([A-Z]{2})\)(?=[\s,.;:]|$)"
    text = re.sub(
        city_with_province_pattern,
        lambda m: _stable_pseudonym(m.group(0), "CITY"),
        text,
    )

    person_blocklist = {
        "Direttiva", "Regolamento", "Standard", "Standards", "Corporate", "Sustainability",
        "Reporting", "Global", "Initiative", "Taxonomy", "Bilancio", "Scope", "ESRS",
        "CSRD", "DNF", "ISO", "UE", "EU", "Output", "ETL", "Pagina", "Input",
    }

    city_standalone_pattern = r"\b(?:a|ad|in|da|di|nel|nella|presso)\s+([A-Z][a-zà-ÿ'’\-]{2,}(?:\s[A-Z][a-zà-ÿ'’\-]{2,}){0,2})\b"

    def _replace_city_standalone(match):
        city = match.group(1)
        tokens = re.split(r"\s+", city)
        if any(token in person_blocklist for token in tokens):
            return match.group(0)
        prefix = match.group(0)[:match.group(0).find(city)]
        return f"{prefix}{_stable_pseudonym(city, 'CITY')}"

    text = re.sub(city_standalone_pattern, _replace_city_standalone, text)

    # Nomi persona (2-3 parole capitalizzate), con esclusione di termini normativi/compliance.
    person_pattern = r"\b([A-Z][a-zà-ÿ'’\-]{2,}\s+[A-Z][a-zà-ÿ'’\-]{2,}(?:\s+[A-Z][a-zà-ÿ'’\-]{2,})?)\b"

    def _replace_person(match):
        candidate = match.group(1)
        tokens = re.split(r"\s+", candidate)
        if any(token in person_blocklist for token in tokens):
            return candidate
        return _stable_pseudonym(candidate, "PERSON")

    text = re.sub(person_pattern, _replace_person, text)

    # Telefono con validazione: evita falsi positivi su valori numerici tecnici (es. 120.000 m3)
    phone_pattern = r"(?<!\d)(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?(?:\d[\s.-]?){7,13}(?!\d)"

    def _replace_phone(match):
        value = match.group(0)
        digits = re.sub(r"\D", "", value)
        # Un telefono reale ha normalmente almeno 8 cifre
        if len(digits) < 8:
            return value

        # Evita masking di numeri seguiti da unita di misura comuni
        tail = text[match.end():match.end() + 6].lower()
        if re.match(r"\s*(m3|kg|tco2|co2|kwh|mwh)\b", tail):
            return value

        return _stable_pseudonym(value, "PHONE")

    text = re.sub(phone_pattern, _replace_phone, text, flags=re.IGNORECASE)

    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _render_anonymized_pdf_bytes(text: str, title: str = "Output ETL - Dati Anonimizzati") -> bytes:
    doc = fitz.open()

    lines = [title, ""]
    for row in text.split("\n"):
        clean = row.strip()
        if not clean:
            lines.append("")
            continue
        lines.extend(wrap(clean, width=95))

    page_width, page_height = 595, 842  # A4
    margin_x = 44
    top_y = 54
    bottom_y = 800
    line_height = 13
    lines_per_page = max(1, int((bottom_y - top_y) / line_height))

    for start in range(0, len(lines), lines_per_page):
        page = doc.new_page(width=page_width, height=page_height)
        y = top_y
        for line in lines[start:start + lines_per_page]:
            page.insert_text((margin_x, y), line, fontsize=10, fontname="helv")
            y += line_height

    payload = doc.tobytes(garbage=4, deflate=True)
    doc.close()
    return payload


def _hex_to_rgb(hex_color: str) -> tuple:
    color = hex_color.strip().lstrip("#")
    if len(color) != 6:
        return 0.0, 0.0, 0.0
    return tuple(int(color[i:i + 2], 16) / 255.0 for i in (0, 2, 4))


def _safe_item_list(values):
    if not isinstance(values, list):
        return []
    return values


def _safe_text(value, fallback="-"):
    if value is None:
        return fallback
    text = str(value).strip()
    return text if text else fallback


def _norm_name(item):
    if isinstance(item, dict):
        return _safe_text(item.get("norma"), "Norma")
    return _safe_text(item, "Norma")


def _norm_reason(item):
    if isinstance(item, dict):
        return _safe_text(item.get("motivo"), "Nessuna motivazione disponibile")
    return "Nessuna motivazione disponibile"


def _render_analysis_report_pdf_bytes(report: dict, title: str = "Report Analisi ESG") -> bytes:
    doc = fitz.open()

    page_width, page_height = 595, 842  # A4
    margin_x = 42
    margin_bottom = 42

    c_navy = _hex_to_rgb("0B1F3A")
    c_blue = _hex_to_rgb("1E6FD9")
    c_bg = _hex_to_rgb("F4F8FF")
    c_text = _hex_to_rgb("142033")
    c_ok = _hex_to_rgb("0A8F5B")
    c_fail = _hex_to_rgb("D63D3D")
    c_warn = _hex_to_rgb("D48806")
    c_card = _hex_to_rgb("FFFFFF")
    c_border = _hex_to_rgb("DAE6F7")

    norme_rispettate = _safe_item_list(report.get("norme_rispettate", []))
    norme_non_rispettate = _safe_item_list(report.get("norme_non_rispettate", []))
    norme_borderline = _safe_item_list(report.get("norme_borderline", []))
    azioni = _safe_item_list(report.get("azioni_correttive", []))
    files_analizzati = _safe_item_list(report.get("files_analizzati", []))

    normative = _safe_item_list(report.get("normative_analizzate", []))
    metadata = report.get("metadata", {}) if isinstance(report.get("metadata", {}), dict) else {}
    doc_types = _safe_item_list(report.get("tipo_documento", metadata.get("tipo_documento", [])))

    total = len(norme_rispettate) + len(norme_non_rispettate) + len(norme_borderline)
    score = round((len(norme_rispettate) / total) * 100) if total > 0 else 0
    date_label = _safe_text(metadata.get("data_analisi", datetime.now().strftime("%Y-%m-%d %H:%M:%S")))

    page = doc.new_page(width=page_width, height=page_height)

    # Hero header
    page.draw_rect(fitz.Rect(0, 0, page_width, 170), color=c_navy, fill=c_navy)
    page.draw_rect(fitz.Rect(0, 170, page_width, 220), color=c_blue, fill=c_blue)
    page.draw_circle((page_width - 70, 85), 52, color=c_blue, fill=c_blue)
    page.draw_circle((page_width - 42, 142), 24, color=c_blue, fill=c_blue)

    page.insert_text((margin_x, 60), "ESG Compliance Report", fontsize=22, fontname="hebo", color=(1, 1, 1))
    page.insert_text((margin_x, 88), _safe_text(title, "Report Analisi ESG"), fontsize=12, fontname="helv", color=(0.88, 0.93, 1.0))
    page.insert_text((margin_x, 112), f"Data analisi: {date_label}", fontsize=10, fontname="helv", color=(0.85, 0.9, 0.98))
    page.insert_text((margin_x, 134), f"File analizzati: {len(files_analizzati)}", fontsize=10, fontname="helv", color=(0.85, 0.9, 0.98))

    y = 195

    def draw_metric_card(x, y0, w, h, label, value, accent):
        page.draw_rect(fitz.Rect(x, y0, x + w, y0 + h), color=c_border, fill=c_card, width=1)
        page.draw_rect(fitz.Rect(x, y0, x + 6, y0 + h), color=accent, fill=accent)
        page.insert_text((x + 16, y0 + 24), _safe_text(label), fontsize=9, fontname="helv", color=(0.35, 0.43, 0.55))
        page.insert_text((x + 16, y0 + 52), _safe_text(value), fontsize=18, fontname="hebo", color=c_text)

    card_gap = 10
    card_w = (page_width - (margin_x * 2) - (card_gap * 3)) / 4
    draw_metric_card(margin_x + 0 * (card_w + card_gap), y, card_w, 68, "Score conformita", f"{score}%", c_blue)
    draw_metric_card(margin_x + 1 * (card_w + card_gap), y, card_w, 68, "Conformi", str(len(norme_rispettate)), c_ok)
    draw_metric_card(margin_x + 2 * (card_w + card_gap), y, card_w, 68, "Non conformi", str(len(norme_non_rispettate)), c_fail)
    draw_metric_card(margin_x + 3 * (card_w + card_gap), y, card_w, 68, "Borderline", str(len(norme_borderline)), c_warn)

    y += 86
    page.draw_rect(fitz.Rect(margin_x, y, page_width - margin_x, y + 32), color=c_border, fill=c_bg, width=1)
    page.insert_text((margin_x + 12, y + 23), "Panoramica analisi", fontsize=12, fontname="hebo", color=c_text)
    y += 42

    row_1 = f"Normative verificate: {len(normative)}"
    row_2 = f"Tipologia documento: {', '.join([_safe_text(x) for x in doc_types[:4]]) or '-'}"

    for row in [row_1, row_2]:
        page.insert_textbox(
            fitz.Rect(margin_x + 12, y, page_width - margin_x - 12, y + 24),
            row,
            fontsize=10,
            fontname="helv",
            color=c_text,
            align=fitz.TEXT_ALIGN_LEFT,
        )
        y += 20

    y += 6

    def new_page_with_title(section_title):
        p = doc.new_page(width=page_width, height=page_height)
        p.draw_rect(fitz.Rect(0, 0, page_width, 62), color=c_navy, fill=c_navy)
        p.insert_text((margin_x, 40), section_title, fontsize=15, fontname="hebo", color=(1, 1, 1))
        return p, 84

    def ensure_space(current_page, current_y, min_space, section_title):
        if current_y + min_space <= page_height - margin_bottom:
            return current_page, current_y
        return new_page_with_title(section_title)

    def draw_section_header(current_page, current_y, text, color):
        current_page.draw_rect(
            fitz.Rect(margin_x, current_y, page_width - margin_x, current_y + 30),
            color=color,
            fill=color,
        )
        current_page.insert_text((margin_x + 10, current_y + 20), text, fontsize=11, fontname="hebo", color=(1, 1, 1))
        return current_y + 38

    def draw_norm_blocks(current_page, current_y, items, section_label, accent_color):
        current_page, current_y = ensure_space(current_page, current_y, 60, "Dettaglio Conformita")
        current_y = draw_section_header(current_page, current_y, section_label, accent_color)
        if not items:
            current_page.insert_text((margin_x + 4, current_y + 12), "Nessun elemento disponibile", fontsize=10, fontname="helv", color=c_text)
            return current_page, current_y + 30

        for item in items:
            current_page, current_y = ensure_space(current_page, current_y, 82, "Dettaglio Conformita")
            block_top = current_y
            block_h = 74
            current_page.draw_rect(
                fitz.Rect(margin_x, block_top, page_width - margin_x, block_top + block_h),
                color=c_border,
                fill=c_card,
                width=1,
            )
            current_page.draw_rect(
                fitz.Rect(margin_x, block_top, margin_x + 5, block_top + block_h),
                color=accent_color,
                fill=accent_color,
                width=0,
            )

            norm_title = _norm_name(item)
            reason = _norm_reason(item)
            current_page.insert_textbox(
                fitz.Rect(margin_x + 12, block_top + 10, page_width - margin_x - 12, block_top + 35),
                norm_title,
                fontsize=10,
                fontname="hebo",
                color=c_text,
                align=fitz.TEXT_ALIGN_LEFT,
            )
            current_page.insert_textbox(
                fitz.Rect(margin_x + 12, block_top + 35, page_width - margin_x - 16, block_top + block_h - 10),
                reason,
                fontsize=9,
                fontname="helv",
                color=(0.27, 0.34, 0.45),
                align=fitz.TEXT_ALIGN_LEFT,
            )
            current_y += block_h + 6
        return current_page, current_y

    page, y = ensure_space(page, y, 120, "Dettaglio Conformita")
    page, y = draw_norm_blocks(page, y, norme_rispettate, "Norme Conformi", c_ok)
    page, y = draw_norm_blocks(page, y, norme_non_rispettate, "Norme Non Conformi", c_fail)
    page, y = draw_norm_blocks(page, y, norme_borderline, "Norme Borderline", c_warn)

    page, y = ensure_space(page, y, 160, "Azioni Correttive e Allegati")
    y = draw_section_header(page, y, "Azioni Correttive Prioritarie", c_blue)

    if azioni:
        for idx, action in enumerate(azioni, start=1):
            page, y = ensure_space(page, y, 30, "Azioni Correttive e Allegati")
            page.draw_circle((margin_x + 10, y + 9), 7, color=c_blue, fill=c_blue)
            page.insert_text((margin_x + 6.5, y + 12), str(idx), fontsize=8, fontname="hebo", color=(1, 1, 1))
            page.insert_textbox(
                fitz.Rect(margin_x + 24, y, page_width - margin_x - 10, y + 24),
                _safe_text(action),
                fontsize=10,
                fontname="helv",
                color=c_text,
                align=fitz.TEXT_ALIGN_LEFT,
            )
            y += 24
    else:
        page.insert_text((margin_x + 4, y + 12), "Nessuna azione correttiva suggerita", fontsize=10, fontname="helv", color=c_text)
        y += 24

    y += 12
    y = draw_section_header(page, y, "File Analizzati", c_navy)
    if files_analizzati:
        for name in files_analizzati:
            page, y = ensure_space(page, y, 24, "Azioni Correttive e Allegati")
            page.insert_text((margin_x + 4, y + 14), f"- {_safe_text(name)}", fontsize=10, fontname="helv", color=c_text)
            y += 20
    else:
        page.insert_text((margin_x + 4, y + 12), "Nessun file disponibile in metadata", fontsize=10, fontname="helv", color=c_text)

    payload = doc.tobytes(garbage=4, deflate=True)
    doc.close()
    return payload


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
    patterns = [
        r'\b\d+[\.,]?\d*\s*%',
        r'\b\d+[\.,]?\d*\s*(?:ton|kg|kwh|mwh|co2|tco2)',
        r'€\s*\d+[\.,]?\d*',
        r'\b\d+[\.,]?\d*\s*(?:milioni|miliardi)',
    ]
    kpis = []
    for p in patterns:
        matches = re.findall(p, text.lower())
        for m in matches:
            kpis.append(m[0] if isinstance(m, tuple) else m)
    return list(set(kpis))[:10]


LOCAL_LLM_MODEL = getattr(settings, "LOCAL_LLM_MODEL", "meta-llama/Llama-3.2-3B-Instruct")
LOCAL_LLM_FALLBACK_MODEL = getattr(settings, "LOCAL_LLM_FALLBACK_MODEL", "TinyLlama/TinyLlama-1.1B-Chat-v1.0")
LOCAL_LLM_MAX_NEW_TOKENS = int(getattr(settings, "LOCAL_LLM_MAX_NEW_TOKENS", 512))
MAX_SEMANTIC_EVALUATIONS = int(getattr(settings, "MAX_SEMANTIC_EVALUATIONS", 2))

_llm_generator = None
_llm_tokenizer = None
_llm_loaded_model_name = None


def _build_text_generation_pipeline(model_name: str):
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    dtype = torch.float16 if torch.cuda.is_available() else torch.float32
    model = AutoModelForCausalLM.from_pretrained(model_name, torch_dtype=dtype)
    device = 0 if torch.cuda.is_available() else -1
    text_generator = pipeline(
        "text-generation",
        model=model,
        tokenizer=tokenizer,
        device=device,
    )
    return text_generator, tokenizer


def get_local_llm():
    global _llm_generator, _llm_tokenizer, _llm_loaded_model_name
    if _llm_generator is not None:
        return _llm_generator

    errors = []
    for candidate in [LOCAL_LLM_MODEL, LOCAL_LLM_FALLBACK_MODEL]:
        if not candidate:
            continue
        try:
            _llm_generator, _llm_tokenizer = _build_text_generation_pipeline(candidate)
            _llm_loaded_model_name = candidate
            return _llm_generator
        except Exception as exc:
            errors.append(f"{candidate}: {exc}")

    raise RuntimeError(
        "Impossibile caricare un modello Llama locale. "
        f"Dettagli: {' | '.join(errors)}"
    )


def local_llama_generate(
    prompt: str,
    max_new_tokens: int = None,
    temperature: float = 0.2,
    do_sample: bool = True,
) -> str:
    generator = get_local_llm()
    max_tokens = max_new_tokens or LOCAL_LLM_MAX_NEW_TOKENS
    generation_kwargs = {
        "max_new_tokens": max_tokens,
        "do_sample": do_sample,
        "repetition_penalty": 1.1,
        "return_full_text": False,
    }
    if do_sample:
        generation_kwargs["temperature"] = temperature
        generation_kwargs["top_p"] = 0.9

    output = generator(prompt, **generation_kwargs)
    return output[0]["generated_text"].strip()


def _extract_json_from_text(raw_text: str):
    if not raw_text:
        return None

    try:
        return json.loads(raw_text)
    except Exception:
        pass

    start = raw_text.find("{")
    end = raw_text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None

    candidate = raw_text[start:end + 1]
    try:
        return json.loads(candidate)
    except Exception:
        return None


def _normalize_summary_item(item):
    if isinstance(item, str):
        return {"norma": item, "motivo": ""}
    if isinstance(item, dict):
        norma = str(item.get("norma", "")).strip()
        motivo = str(item.get("motivo", "")).strip()
        return {"norma": norma, "motivo": motivo}
    return {"norma": str(item), "motivo": ""}


def _coerce_summary_list(payload: dict, key: str) -> list:
    values = payload.get(key, [])
    if not isinstance(values, list):
        return []

    out = []
    seen = set()
    for item in values:
        norm_item = _normalize_summary_item(item)
        norm_name = norm_item["norma"].strip()
        if not norm_name:
            continue
        normalized_key = norm_name.lower()
        if normalized_key in seen:
            continue
        seen.add(normalized_key)
        out.append(norm_item)
    return out


def _iso_code_from_law_title(law_title: str) -> str:
    if "ISO 14001" in law_title:
        return "iso 14001"
    if "ISO 45001" in law_title:
        return "iso 45001"
    if "ISO 27001" in law_title:
        return "iso 27001"
    if "ISO 9001" in law_title:
        return "iso 9001"
    return ""


def _has_iso_certification_evidence(text_lower: str, iso_code: str) -> bool:
    if not iso_code:
        return False

    certification_markers = [
        "conforme allo standard",
        "e conforme allo standard",
        "certificato",
        "certificazione",
        "validita",
    ]

    # Cerca frasi tipiche dei certificati, anche con interruzioni di riga tra marker e codice ISO.
    for marker in certification_markers:
        pattern = rf"{re.escape(marker)}[\s\S]{{0,160}}{re.escape(iso_code)}"
        m = re.search(pattern, text_lower, flags=re.IGNORECASE)
        if m:
            window = text_lower[max(0, m.start() - 50): min(len(text_lower), m.end() + 50)]
            if not any(neg in window for neg in NEGATION_MARKERS):
                return True

    # Fallback: presenza del codice ISO insieme a parole tipiche di attestazione.
    if iso_code in text_lower and ("si certifica" in text_lower or "certificazione" in text_lower):
        for neg in NEGATION_MARKERS:
            if neg in text_lower:
                return False
        return True

    return False


def _has_formal_law_attestation(text_lower: str, law_title: str) -> bool:
    aliases = LAW_ALIASES.get(law_title, [])
    if not aliases:
        return False

    for alias in aliases:
        for marker in FORMAL_COMPLIANCE_MARKERS:
            # Cerca attestazioni formali dove marker e riferimento normativo sono vicini.
            p1 = rf"{re.escape(marker)}[\s\S]{{0,120}}{re.escape(alias)}"
            p2 = rf"{re.escape(alias)}[\s\S]{{0,120}}{re.escape(marker)}"
            m1 = re.search(p1, text_lower, flags=re.IGNORECASE)
            if m1:
                window = text_lower[max(0, m1.start() - 50): min(len(text_lower), m1.end() + 50)]
                if not any(neg in window for neg in NEGATION_MARKERS):
                    return True

            m2 = re.search(p2, text_lower, flags=re.IGNORECASE)
            if m2:
                window = text_lower[max(0, m2.start() - 50): min(len(text_lower), m2.end() + 50)]
                if not any(neg in window for neg in NEGATION_MARKERS):
                    return True

    return False


def _evaluate_law_compliance(text_lower: str, law_title: str) -> tuple:
    rules = LAW_COMPLIANCE_RULES.get(law_title)
    if not rules:
        return "non_rispettata", "Regole di valutazione non disponibili per questa norma.", []

    must_groups = rules.get("must_groups", [])
    if not must_groups:
        return "non_rispettata", "Regole incomplete per la norma.", rules.get("actions", [])

    iso_code = _iso_code_from_law_title(law_title)
    if iso_code and _has_iso_certification_evidence(text_lower, iso_code):
        return "rispettata", "Certificazione esplicita rilevata nel documento.", []

    if _has_formal_law_attestation(text_lower, law_title):
        return "rispettata", "Attestazione formale di conformita rilevata nel documento.", []

    unmet_requirements = []
    missing_groups = []
    for group in must_groups:
        if any(token in text_lower for token in group):
            continue
        else:
            missing_groups.append(group[0])
            unmet_requirements.append(group[0])

    # Classificazione binaria: una norma e rispettata solo se tutti i requisiti chiave sono presenti.
    if not unmet_requirements:
        return "rispettata", "Requisiti chiave della norma presenti nel documento.", []

    missing_preview = ", ".join(missing_groups[:3])
    return "non_rispettata", f"Requisiti mancanti: {missing_preview}.", rules.get("actions", [])


def _find_law_by_title(law_title: str):
    for law in LAW_DATABASE:
        if law["title"] == law_title:
            return law
    return None


def _normalize_judgement(value: str) -> str:
    v = str(value or "").strip().lower()
    if v in {"rispettata", "compliant", "conforme", "yes", "true"}:
        return "rispettata"
    if v in {"non_rispettata", "non rispettata", "non-compliant", "non conforme", "no", "false"}:
        return "non_rispettata"
    return ""


def _judge_law_with_semantic_llm(law: dict, evidence_chunks: list) -> tuple:
    if not evidence_chunks:
        fallback_actions = LAW_COMPLIANCE_RULES.get(law["title"], {}).get("actions", [])
        return "non_rispettata", "Nessuna evidenza documentale rilevante trovata per la norma.", fallback_actions

    evidence_text = "\n\n".join([
        f"[Evidenza {i+1}]\n{chunk['text'][:1000]}"
        for i, chunk in enumerate(evidence_chunks[:2])
    ])

    prompt = f"""
Sei un auditor legale/compliance.
Valuta se il documento RISULTA CONFORME o NON CONFORME alla norma indicata.

Norma:
{law['title']}

Requisiti norma (riassunto):
{law['text']}

Evidenze dal documento:
{evidence_text}

Regole obbligatorie:
- Basati solo sulle evidenze fornite.
- Non usare supposizioni.
- Se le evidenze sono incomplete, classifica NON_RISPETTATA.
- Rispondi solo con JSON valido nel formato:
{{
  "verdetto": "RISPETTATA" | "NON_RISPETTATA",
  "motivazione": "breve motivazione specifica",
  "azioni": ["azione 1", "azione 2"]
}}
"""

    try:
        raw = local_llama_generate(
            prompt,
            max_new_tokens=140,
            temperature=0.0,
            do_sample=False,
        )
    except Exception:
        fallback_actions = LAW_COMPLIANCE_RULES.get(law["title"], {}).get("actions", [])
        return "", "", fallback_actions
    parsed = _extract_json_from_text(raw) or {}

    verdict = _normalize_judgement(parsed.get("verdetto", ""))
    reason = str(parsed.get("motivazione", "")).strip()
    actions = parsed.get("azioni", [])
    if not isinstance(actions, list):
        actions = []
    actions = [str(a).strip() for a in actions if str(a).strip()]

    if verdict not in {"rispettata", "non_rispettata"}:
        fallback_actions = LAW_COMPLIANCE_RULES.get(law["title"], {}).get("actions", [])
        return "", "", fallback_actions

    if not reason:
        reason = "Valutazione semantica effettuata sulle evidenze disponibili del documento."

    return verdict, reason, actions


def _select_candidate_laws(text: str, chunks: list) -> list:
    scored_candidates = {}

    def _push_score(title: str, score: float):
        current = scored_candidates.get(title, -1.0)
        if score > current:
            scored_candidates[title] = score

    for chunk in chunks:
        for law in retrieve_relevant_laws(chunk, k=4):
            _push_score(law["title"], float(law.get("score", 0.0)))

    for doc_type in detect_document_type(text):
        for law_title in DOC_TYPE_TO_LAWS.get(doc_type, []):
            _push_score(law_title, 1.5)

    if not scored_candidates:
        for law in LAW_DATABASE:
            _push_score(law["title"], 0.1)

    valid_titles = {l["title"] for l in LAW_DATABASE}
    ranked = sorted(scored_candidates.items(), key=lambda x: x[1], reverse=True)
    return [title for title, _ in ranked if title in valid_titles]


def summarize_compliance(text: str, max_chunks: int = 8) -> dict:
    chunks = chunk_text(text)[:max_chunks]
    if not chunks:
        return {
            "norme_rispettate": [],
            "norme_non_rispettate": [],
            "norme_borderline": [],
            "azioni_correttive": ["Documento troppo corto o vuoto: fornire un contenuto piu completo."],
            "raw_output": "",
        }

    text_lower = text.lower()
    candidate_titles = _select_candidate_laws(text, chunks)
    chunk_index, _ = _build_chunk_index(chunks)

    norme_rispettate = []
    norme_non_rispettate = []
    norme_borderline = []
    azioni_correttive = []
    non_conform_laws = []

    for idx, law_title in enumerate(candidate_titles):
        law = _find_law_by_title(law_title)
        if law is None:
            continue

        law_query = f"{law_title}. {law['text']}"
        evidence_chunks = retrieve_relevant_chunks(law_query, chunks, chunk_index, top_k=4)

        # Primo livello: semantico (LLM su evidenze rilevanti), limitato per stabilita runtime.
        if idx < MAX_SEMANTIC_EVALUATIONS:
            status, motivo, suggested_actions = _judge_law_with_semantic_llm(law, evidence_chunks)
        else:
            status, motivo, suggested_actions = "", "", []

        # Fallback robusto: regole deterministiche (in caso output LLM non valido)
        if status not in {"rispettata", "non_rispettata"}:
            status, motivo, suggested_actions = _evaluate_law_compliance(text_lower, law_title)

        item = {"norma": law_title, "motivo": motivo}

        if status == "rispettata":
            norme_rispettate.append(item)
        else:
            norme_non_rispettate.append(item)
            non_conform_laws.append(law_title)

        azioni_correttive.extend(suggested_actions)

    def _is_placeholder_action(value: str) -> bool:
        s = value.strip().lower()
        if not s:
            return True
        if re.match(r"^azione\s*\d+\b", s):
            return True
        if re.match(r"^azione\b", s) and len(s) <= 18:
            return True
        return False

    dedup_actions = []
    seen_actions = set()
    for action in azioni_correttive:
        normalized = action.lower().strip()
        if _is_placeholder_action(action):
            continue
        if normalized and normalized not in seen_actions:
            dedup_actions.append(action)
            seen_actions.add(normalized)

    if not dedup_actions and non_conform_laws:
        for law_title in non_conform_laws:
            for action in LAW_COMPLIANCE_RULES.get(law_title, {}).get("actions", []):
                normalized = action.lower().strip()
                if normalized and normalized not in seen_actions:
                    dedup_actions.append(action)
                    seen_actions.add(normalized)

    if not dedup_actions:
        dedup_actions = [
            "Mappare ogni requisito normativo a evidenze documentali esplicite.",
            "Inserire KPI misurabili (GHG Scope 1/2/3, target, metriche sociali e governance).",
            "Definire piano di audit interno con responsabilita, scadenze e azioni correttive tracciate.",
        ]

    return {
        "norme_rispettate": norme_rispettate,
        "norme_non_rispettate": norme_non_rispettate,
        "norme_borderline": norme_borderline,
        "azioni_correttive": dedup_actions,
        "raw_output": "rule_based_evaluation",
    }


def build_chat_prompt(messages: list) -> str:
    system_prompt = (
        "Sei un assistente esperto in ESG, compliance normativa e rendicontazione aziendale. "
        "Rispondi in italiano in modo chiaro, pratico e conciso."
    )
    prompt_lines = [f"[SYSTEM]\n{system_prompt}"]

    for m in messages:
        role = "USER" if m.get("role") == "user" else "ASSISTANT"
        content = m.get("content", "").strip()
        if content:
            prompt_lines.append(f"[{role}]\n{content}")

    prompt_lines.append("[ASSISTANT]")
    return "\n\n".join(prompt_lines)


def build_compliance_prompt(doc_chunk: str, laws: list) -> str:
    laws_text = "\n\n".join([f"[{law['title']}]\n{law['text']}" for law in laws])
    return (
        "Analizza la conformita del seguente estratto di documento tecnico rispetto alle normative indicate.\n\n"
        f"ESTRATTO DOCUMENTO:\n{doc_chunk}\n\n"
        f"NORMATIVE RILEVANTI:\n{laws_text}\n\n"
        "Identifica:\n"
        "1. Elementi conformi alle normative\n"
        "2. Gap di conformita presenti\n"
        "3. Rischi normativi\n"
        "4. Azioni correttive raccomandate\n\n"
        "Scrivi in italiano, in modo pratico e sintetico.\n\n"
        "ANALISI:"
    )


def analyze_compliance_chunk(doc_chunk: str, k_laws: int = 3) -> dict:
    relevant_laws = retrieve_relevant_laws(doc_chunk, k=k_laws)
    prompt = build_compliance_prompt(doc_chunk[:1200], relevant_laws)
    response_text = local_llama_generate(prompt, max_new_tokens=600, temperature=0.1)

    return {
        "normative_correlate": [law["title"] for law in relevant_laws],
        "analisi": response_text,
    }


def aggregate_by_law(section_results: list) -> dict:
    law_data = {}

    for result in section_results:
        for law_title in result["normative_correlate"]:
            if law_title not in law_data:
                law_data[law_title] = {
                    "conformita": [],
                    "gap": [],
                    "azioni": [],
                    "rischi": [],
                }

            analisi = result["analisi"]
            lines = analisi.split("\n")
            current_section = None

            for line in lines:
                row = line.strip()
                if not row:
                    continue
                row_lower = row.lower()

                if "elementi conformi" in row_lower or "conforme" in row_lower:
                    current_section = "conformita"
                elif "gap" in row_lower or "non conforme" in row_lower:
                    current_section = "gap"
                elif "azioni correttive" in row_lower or "raccomand" in row_lower:
                    current_section = "azioni"
                elif "rischi" in row_lower:
                    current_section = "rischi"
                elif row.startswith("-") or (len(row) > 2 and row[0].isdigit() and row[1] == "."):
                    content = row.lstrip("-").lstrip("0123456789.").strip()
                    if content and current_section:
                        law_data[law_title][current_section].append(content)

    for law_title, sections in law_data.items():
        for section_name, values in sections.items():
            deduped = []
            seen = set()
            for v in values:
                normalized = v.lower()
                if normalized not in seen:
                    deduped.append(v)
                    seen.add(normalized)
            law_data[law_title][section_name] = deduped

    return law_data


def _build_chunk_index(chunks: list) -> tuple:
    if not chunks:
        return None, np.zeros((0, 1), dtype=np.float32)

    embedder = get_embedder()
    texts = [f"passage: {chunk}" for chunk in chunks]
    embeddings = embedder.encode(texts, normalize_embeddings=True).astype(np.float32)
    idx = faiss.IndexFlatIP(embeddings.shape[1])
    idx.add(embeddings)
    return idx, embeddings


def retrieve_relevant_chunks(question: str, chunks: list, index, top_k: int = 4) -> list:
    if index is None or not chunks:
        return []

    embedder = get_embedder()
    query_embedding = embedder.encode([f"query: {question}"], normalize_embeddings=True).astype(np.float32)
    limit = min(max(top_k, 1), len(chunks))
    scores, indices = index.search(query_embedding, limit)

    results = []
    for score, idx in zip(scores[0], indices[0]):
        if idx != -1:
            results.append({
                "text": chunks[idx],
                "score": float(score),
            })
    return results


def ask_esg(text: str, question: str, top_k: int = 4) -> dict:
    chunks = chunk_text(text)
    if not chunks:
        return {"risposta": "Non ho trovato testo utile nel documento.", "fonti": []}

    index, _ = _build_chunk_index(chunks)
    relevant_chunks = retrieve_relevant_chunks(question, chunks, index, top_k=top_k)
    context = "\n\n".join([f"[Chunk {i+1}]\n{item['text']}" for i, item in enumerate(relevant_chunks)])

    prompt = (
        "Sei un esperto di normative ESG europee. Rispondi alla domanda basandoti esclusivamente sul contesto. "
        "Se l'informazione non e presente nel contesto, dichiaralo esplicitamente.\n\n"
        f"CONTESTO:\n{context}\n\n"
        f"DOMANDA: {question}\n\n"
        "RISPOSTA:"
    )
    response_text = local_llama_generate(prompt, max_new_tokens=450, temperature=0.1)

    return {
        "risposta": response_text,
        "fonti": [item["text"][:240] + "..." for item in relevant_chunks],
    }


def generate_compliance_report(text: str, max_sections: int = 5) -> dict:
    doc_types = detect_document_type(text)
    chunks = chunk_text(text)[:max_sections]

    section_results = []
    all_laws_cited = []

    for i, chunk in enumerate(chunks):
        analysis = analyze_compliance_chunk(chunk)
        all_laws_cited.extend(analysis["normative_correlate"])

        section_results.append({
            "sezione": i + 1,
            "testo_estratto": chunk[:200] + "...",
            "normative_correlate": analysis["normative_correlate"],
            "analisi": analysis["analisi"],
        })

    law_summary = aggregate_by_law(section_results)

    return {
        "metadata": {
            "data_analisi": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "tipo_documento": doc_types,
            "normative_analizzate": list(set(all_laws_cited)),
            "sezioni_analizzate": len(section_results),
        },
        "riepilogo_per_norma": law_summary,
        "analisi_sezioni": section_results,
    }


def _extract_text_from_request(request):
    uploaded_files = []
    if request.FILES.getlist('files'):
        uploaded_files = request.FILES.getlist('files')
    elif request.FILES.get('file'):
        uploaded_files = [request.FILES['file']]

    if uploaded_files:
        anonymized_documents = []
        analyzed_file_names = []

        for f in uploaded_files:
            file_name = f.name
            lower_name = file_name.lower()
            if lower_name.endswith('.pdf'):
                extracted_text = extract_text_from_pdf(f)
            elif lower_name.endswith('.txt'):
                extracted_text = f.read().decode('utf-8', errors='ignore')
            else:
                continue

            try:
                f.close()
            except Exception:
                pass

            anonymized_text = run_file_etl_anonymization(extracted_text)
            extracted_text = None
            if anonymized_text.strip():
                anonymized_documents.append(f"[DOCUMENTO: {file_name}]\n{anonymized_text}")
                analyzed_file_names.append(file_name)

        return "\n\n".join(anonymized_documents), True, analyzed_file_names

    if request.content_type == 'application/json':
        data = json.loads(request.body)
        return data.get('text', ''), False, []

    return '', False, []


# ── VIEW: Chat semplice ────────────────────────────────────────────────────────
@csrf_exempt
@require_http_methods(["POST"])
def chat(request):
    try:
        data = json.loads(request.body)
        messages = data.get('messages', [])
        if not messages:
            return JsonResponse({'error': 'Nessun messaggio fornito'}, status=400)

        prompt = build_chat_prompt(messages)
        reply = local_llama_generate(prompt, max_new_tokens=350, temperature=0.4)
        return JsonResponse({'reply': reply, 'model': _llm_loaded_model_name})

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


# ── VIEW: Analisi documento ────────────────────────────────────────────────────
@csrf_exempt
@require_http_methods(["POST"])
def analyze_document(request):
    try:
        text, from_file, analyzed_files = _extract_text_from_request(request)
        has_uploaded_files = bool(request.FILES.getlist('files') or request.FILES.get('file'))
        if request.content_type != 'application/json' and not has_uploaded_files:
            return JsonResponse({'error': 'Invia un file PDF/TXT o testo JSON'}, status=400)

        if has_uploaded_files and not analyzed_files:
            return JsonResponse({'error': 'Nessun file valido. Carica PDF o TXT leggibili.'}, status=400)

        if not text.strip():
            return JsonResponse({'error': 'Documento vuoto o non leggibile'}, status=400)

        summary = summarize_compliance(text=text)
        doc_types = detect_document_type(text)

        normative_analizzate = []
        for item in summary["norme_rispettate"] + summary["norme_non_rispettate"] + summary["norme_borderline"]:
            normative_analizzate.append(item["norma"])

        unique_normative = list(dict.fromkeys(normative_analizzate))

        # La risposta principale e senza sezioni, come richiesto.
        # Manteniamo i campi legacy per non rompere il frontend esistente.
        response_payload = {
            "tipo_documento": doc_types,
            "normative_analizzate": unique_normative,
            "totale_sezioni": 0,
            "sezioni": [],
            "metadata": {
                "data_analisi": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "tipo_documento": doc_types,
                "normative_analizzate": unique_normative,
                "sezioni_analizzate": 0,
            },
            "riepilogo_per_norma": {},
            "analisi_sezioni": [],
            "norme_rispettate": summary["norme_rispettate"],
            "norme_non_rispettate": summary["norme_non_rispettate"],
            "norme_borderline": summary["norme_borderline"],
            "azioni_correttive": summary["azioni_correttive"],
            "privacy": {
                "etl_anonymization_applied": from_file,
                "raw_file_persisted": False,
            },
            "files_analizzati": analyzed_files,
            "totale_file": len(analyzed_files),
        }

        return JsonResponse(response_payload)

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def ask_document(request):
    try:
        if request.content_type == 'application/json':
            data = json.loads(request.body)
            text = data.get('text', '')
            question = data.get('question', '')
        else:
            text, _, _ = _extract_text_from_request(request)
            question = request.POST.get('question', '')

        if not text.strip():
            return JsonResponse({'error': 'Documento vuoto o non leggibile'}, status=400)
        if not question.strip():
            return JsonResponse({'error': 'Domanda mancante'}, status=400)

        answer = ask_esg(text=text, question=question, top_k=4)
        return JsonResponse(answer)

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def anonymize_pdf(request):
    try:
        uploaded = request.FILES.get('file')
        if not uploaded:
            return JsonResponse({'error': 'Carica un file PDF nel campo file.'}, status=400)

        if not uploaded.name.lower().endswith('.pdf'):
            return JsonResponse({'error': 'Formato non supportato. Carica un file .pdf'}, status=400)

        extracted_text = extract_text_from_pdf(uploaded)
        try:
            uploaded.close()
        except Exception:
            pass

        anonymized_text = run_file_etl_anonymization(extracted_text)
        extracted_text = None

        if not anonymized_text.strip():
            return JsonResponse({'error': 'Impossibile estrarre testo dal PDF fornito.'}, status=400)

        base_name = re.sub(r'\.pdf$', '', uploaded.name, flags=re.IGNORECASE)
        output_name = f"{base_name}_anonymized.pdf"
        pdf_bytes = _render_anonymized_pdf_bytes(anonymized_text)

        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{output_name}"'
        response['X-ETL-Anonymized'] = 'true'
        return response

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def anonymize_preview(request):
    try:
        uploaded_files = request.FILES.getlist('files')
        if not uploaded_files and request.FILES.get('file'):
            uploaded_files = [request.FILES.get('file')]

        if not uploaded_files:
            return JsonResponse({'error': 'Carica almeno un file PDF per la preview.'}, status=400)

        previews = []
        placeholder_regex = re.compile(r"\[(EMAIL|IBAN|FISCAL_CODE|VAT|ID_NUMBER|ADDRESS|URL|COMPANY|CITY|PERSON|PHONE)\]")

        for uploaded in uploaded_files:
            file_name = uploaded.name
            if not file_name.lower().endswith('.pdf'):
                continue

            extracted_text = extract_text_from_pdf(uploaded)
            try:
                uploaded.close()
            except Exception:
                pass

            anonymized_text = run_file_etl_anonymization(extracted_text)
            if not anonymized_text.strip():
                continue

            placeholder_counts = {}
            for match in placeholder_regex.findall(anonymized_text):
                placeholder_counts[match] = placeholder_counts.get(match, 0) + 1

            preview_lines = [ln.strip() for ln in anonymized_text.splitlines() if ln.strip()]
            preview_text = "\n".join(preview_lines[:26])[:1800]

            previews.append({
                'file_name': file_name,
                'original_characters': len(extracted_text or ''),
                'anonymized_characters': len(anonymized_text),
                'placeholder_counts': placeholder_counts,
                'preview_text': preview_text,
            })

        if not previews:
            return JsonResponse({'error': 'Nessun file PDF valido trovato per la preview.'}, status=400)

        return JsonResponse({
            'preview_files': previews,
            'storage_policy': {
                'raw_file_persisted': False,
                'anonymized_content_persisted': False,
                'processing_scope': 'in-memory durante la richiesta API',
                'download_destination': 'download locale sul dispositivo utente',
            },
            'transparency_note': (
                'Il sistema non salva il file originale ne il testo anonimizzato su database. '
                'I dati vengono processati in memoria per generare l anteprima e il PDF scaricabile.'
            ),
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def report_pdf(request):
    try:
        if request.content_type != 'application/json':
            return JsonResponse({'error': 'Invia il report in formato JSON.'}, status=400)

        payload = json.loads(request.body or '{}')
        report = payload.get('report', payload)
        if not isinstance(report, dict):
            return JsonResponse({'error': 'Payload report non valido.'}, status=400)

        report_title = _safe_text(payload.get('title'), 'Report Analisi ESG')
        pdf_bytes = _render_analysis_report_pdf_bytes(report, title=report_title)

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_name = f"esg_report_{timestamp}.pdf"

        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{output_name}"'
        response['X-Report-Generated'] = 'true'
        return response
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

