# Motore AI (Django): estrazione testo, anonimizzazione e analisi di conformità ESG
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    # Cache dei modelli Hugging Face, montata su un volume per non riscaricarli a ogni avvio
    HF_HOME=/models

WORKDIR /app

# PyTorch solo CPU: evita di scaricare diversi GB di librerie CUDA non utilizzabili nel container
RUN pip install --index-url https://download.pytorch.org/whl/cpu torch

COPY requirements.txt ./
RUN pip install -r requirements.txt

COPY . .

RUN useradd --create-home appuser && mkdir -p /models && chown -R appuser /app /models
USER appuser

EXPOSE 8000

CMD ["gunicorn", "Hack_AI_Thon.wsgi:application", "-c", "gunicorn.conf.py"]
