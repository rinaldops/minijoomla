import { createMiniJoomlaSiteApplication } from './createMiniJoomlaSiteApplication.js';

export async function mountMiniJoomlaSite({ root, documentRef = globalThis.document, ...options } = {}) {
  if (!root || typeof root.innerHTML !== 'string' || typeof documentRef?.createElement !== 'function') {
    throw new TypeError('O site requer um contêiner dedicado e um documento válido.');
  }
  if (root === documentRef.body || root === documentRef.documentElement) {
    throw new TypeError('O contêiner do site não pode substituir a página do host.');
  }
  const scopedDocument = {
    body: root,
    head: documentRef.head,
    baseURI: documentRef.baseURI,
    createElement: documentRef.createElement.bind(documentRef)
  };
  let composition;
  try {
    composition = await createMiniJoomlaSiteApplication({ ...options, documentRef: scopedDocument, autoStart: false });
    await composition.application.start();
    root.lang = composition.config.language;
    return composition;
  } catch (error) {
    composition?.application.stop();
    root.textContent = 'Não foi possível iniciar o site. Verifique a configuração das listas e os recursos da versão publicada.';
    root.setAttribute?.('role', 'alert');
    console.error('MINIJOOMLA: falha ao montar o site no host.');
    throw error;
  }
}
