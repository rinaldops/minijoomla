export default {
  name: 'demo-content',
  events: {
    onContentPrepare: (html, { field }) => field === 'fulltext'
      ? `${html ?? ''}<p><em>Nota acrescentada pelo plugin demonstrativo.</em></p>`
      : html
  }
};
