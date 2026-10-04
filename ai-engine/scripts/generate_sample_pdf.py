from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from textwrap import wrap

OUTPUT_PATH = "sample_input_esg.pdf"

TEXT = """
Bilancio di Sostenibilita 2024 - Alfa Energia S.p.A.

Contesto aziendale:
Alfa Energia S.p.A. opera nel settore servizi energetici e infrastrutture digitali.
Il presente documento copre l esercizio 2024 ed e redatto ai fini DNF e avvio percorso CSRD.

Governance e compliance:
Il CdA ha approvato una Policy ESG il 12/02/2024.
E presente un Comitato Sostenibilita con riunioni trimestrali.
Non e ancora stata formalizzata una procedura di assurance esterna sui dati ESG.
Non e presente un piano anticorruzione aggiornato al 2024.

Ambiente:
Emissioni GHG Scope 1: 12.500 tCO2e
Emissioni GHG Scope 2 (market-based): 8.200 tCO2e
Emissioni GHG Scope 3: non rendicontate in modo completo (solo categoria viaggi di lavoro).
Riduzione emissioni Scope 1+2 rispetto al 2023: 25%
Energia da fonti rinnovabili: 75%
Consumo idrico: 120.000 m3
Rifiuti avviati a recupero: 68%
Obiettivo climatico dichiarato: -30% Scope 1+2 al 2030 (baseline 2022)
Non e presente un piano di transizione climatica dettagliato con milestone annuali.
Non e stata effettuata analisi completa dei rischi fisici climatici su tutti i siti.

Sociale:
Indice frequenza infortuni: 1,3
Tasso di formazione sicurezza: 96%
Ore medie di formazione pro-capite: 24
Gender pay gap: 13%
Non e ancora disponibile una valutazione completa sui diritti umani nella catena fornitori.

Qualita e sistemi di gestione:
Sistema ISO 14001 certificato, audit interno eseguito a settembre 2024, 2 non conformita minori chiuse entro 60 giorni.
Sistema ISO 45001 certificato, audit interno eseguito a ottobre 2024.
Sistema ISO 27001 in fase di implementazione, gap assessment completato ma certificazione non ottenuta.
Registro non conformita presente, azioni correttive tracciate con responsabile e scadenza.

Reporting:
Il report include riferimenti a GRI 2, GRI 3 e disclosure ambientali GRI 300.
Manca la copertura completa delle disclosure sociali GRI 400.
La doppia materialita e stata avviata ma senza metodologia formalmente documentata e senza coinvolgimento strutturato di tutti gli stakeholder.
Per EU Taxonomy e indicata quota ricavi allineati al 35%, ma manca evidenza completa DNSH per alcune attivita e mancano controlli social safeguards documentati.

Conclusione interna:
L azienda ha una base solida su sistemi di gestione ambientale e sicurezza.
Permangono gap su Scope 3, assurance dati ESG, anticorruzione aggiornata, metodologia doppia materialita e completezza GRI social.
""".strip()


def write_paragraph(c, text, x, y, max_width, line_height):
    words = text.split("\n")
    for row in words:
        if not row.strip():
            y -= line_height
            continue
        for line in wrap(row, width=95):
            c.drawString(x, y, line)
            y -= line_height
            if y < 60:
                c.showPage()
                c.setFont("Helvetica", 10)
                y = 800
    return y


def main():
    c = canvas.Canvas(OUTPUT_PATH, pagesize=A4)
    c.setTitle("Sample ESG Input")
    c.setAuthor("Hack AI Thon")
    c.setFont("Helvetica-Bold", 14)
    c.drawString(50, 820, "Sample ESG Compliance Input")
    c.setFont("Helvetica", 10)
    write_paragraph(c, TEXT, 50, 790, 500, 14)
    c.save()
    print(f"Created: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
