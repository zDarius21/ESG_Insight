"""Configurazione di gunicorn per il motore AI in Docker."""
import os
import threading

bind = "0.0.0.0:8000"
# Un solo processo: i modelli (embedding + LLM) occupano diversi GB e vanno caricati una volta sola.
# I thread permettono di rispondere all'healthcheck anche durante un'analisi lunga.
workers = 1
threads = int(os.getenv("GUNICORN_THREADS", "4"))
# Le analisi con LLM su CPU possono richiedere minuti
timeout = int(os.getenv("GUNICORN_TIMEOUT", "900"))
accesslog = "-"


def _preload_models():
    from chatbot import views

    views.get_law_index()
    print("[ai-engine] Modello di embedding pronto", flush=True)

    if views.MAX_SEMANTIC_EVALUATIONS <= 0:
        print("[ai-engine] Valutazione LLM disattivata (MAX_SEMANTIC_EVALUATIONS=0)", flush=True)
        return
    try:
        views.get_local_llm()
        print(f"[ai-engine] LLM pronto: {views._llm_loaded_model_name}", flush=True)
    except Exception as exc:
        print(f"[ai-engine] LLM non disponibile, verra usata la valutazione a regole: {exc}", flush=True)


def post_worker_init(worker):
    # Precarica i modelli in background (al primo avvio vengono scaricati da Hugging Face):
    # il server risponde subito e le analisi in arrivo attendono il caricamento tramite i lock dei modelli.
    if os.getenv("AI_PRELOAD_MODELS", "true").lower() in ("1", "true", "yes"):
        threading.Thread(target=_preload_models, name="model-preload", daemon=True).start()
