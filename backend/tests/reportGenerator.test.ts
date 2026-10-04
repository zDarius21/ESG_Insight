import Document from '../typescript/models/Document';
import { generateReport } from '../typescript/controllers/documentController';
import { AnalysisResult } from '../typescript/singleton/aiEngine';

/**
 * Smoke test della generazione del report PDF a partire dai risultati del motore AI:
 * testi lunghi (più pagine) e caratteri fuori dalla codifica dei font standard non devono causare errori.
 */
describe('generateReport', () => {
  const document = { id: 1, title: 'Bilancio di Sostenibilità 2023 – Gruppo Alfa' } as Document;
  const motivo = 'Emissioni ≥ 1.5°C → servono target CO₂ Scope 3 documentati. '.repeat(4);

  const analysis: AnalysisResult = {
    tipo_documento: ['Bilancio ESG'],
    normative_analizzate: ['CSRD', 'GRI'],
    norme_rispettate: [{ norma: 'GRI Standards 2021', motivo: 'Requisiti presenti.' }],
    norme_non_rispettate: Array.from({ length: 8 }, (_, i) => ({ norma: `CSRD ${i + 1}`, motivo })),
    norme_borderline: [],
    azioni_correttive: Array.from({ length: 15 }, (_, i) => `Azione correttiva ${i + 1} → ${motivo}`),
    data_analisi: new Date().toISOString(),
  };

  it('produce un PDF valido su più pagine', async () => {
    const pdf = await generateReport(document, analysis);

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.toString('latin1').match(/\/Type \/Page\b/g)?.length).toBeGreaterThan(1);
  });

  it('gestisce un\'analisi senza risultati', async () => {
    const empty: AnalysisResult = { ...analysis, norme_rispettate: [], norme_non_rispettate: [], azioni_correttive: [] };

    await expect(generateReport(document, empty)).resolves.toBeInstanceOf(Buffer);
  });
});
