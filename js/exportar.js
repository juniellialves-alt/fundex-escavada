// Exportação para Excel e compartilhamento (WhatsApp, e-mail...).
import { h, modal, toast } from './ui.js';
import { gerarXlsx, XLSX_MIME } from './xlsx.js';
import * as R from './rows.js';

export async function exportarArquivo({ estacas, ocorrencias, nome }) {
  const ordE = [...estacas].sort((a, b) => a.inicio - b.inicio);
  const ordO = [...ocorrencias].sort((a, b) => (a.data + (a.inicio || '')).localeCompare(b.data + (b.inicio || '')));
  const blob = gerarXlsx([
    { nome: 'Estacas', linhas: [R.COLS_ESTACA, ...ordE.map(R.linhaEstaca)] },
    { nome: 'Ocorrências', linhas: [R.COLS_OCORRENCIA, ...ordO.map(R.linhaOcorrencia)] },
  ]);
  const nomeArq = `${nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.\-]+/g, '_')}.xlsx`;
  const arquivo = new File([blob], nomeArq, { type: XLSX_MIME });
  const podeCompartilhar = !!(navigator.canShare && navigator.canShare({ files: [arquivo] }));

  const baixar = () => {
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: nomeArq });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    toast('Arquivo salvo em Downloads');
  };

  // O compartilhamento precisa acontecer no toque do botão (exigência do celular).
  await modal({
    titulo: 'Arquivo Excel pronto',
    corpo: h('div', null,
      h('p', { class: 'modal-texto' }, `${estacas.length} estaca(s) e ${ocorrencias.length} ocorrência(s).`),
      h('p', { style: { margin: '4px 0 0', fontWeight: 600, wordBreak: 'break-all' } }, nomeArq)),
    botoes: [
      ...(podeCompartilhar ? [{ texto: '📤 Compartilhar (WhatsApp / e-mail)', classe: 'btn-verde', valor: 'share' }] : []),
      { texto: '⬇ Baixar arquivo', classe: 'btn-escuro', valor: 'baixar' },
      { texto: 'Fechar', valor: null },
    ],
    antesDeFechar: async v => {
      if (v === 'share') {
        try { await navigator.share({ files: [arquivo], title: nomeArq }); }
        catch (e) { if (e.name !== 'AbortError') { toast('Não foi possível compartilhar. Use "Baixar arquivo".'); return false; } }
      } else if (v === 'baixar') baixar();
      return true;
    },
  });
}
