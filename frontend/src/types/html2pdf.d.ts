declare module 'html2pdf.js' {
  interface Html2PdfOptions {
    margin?: any;
    filename?: string;
    image?: any;
    html2canvas?: any;
    jsPDF?: any;
  }

  interface Html2PdfInstance {
    set: (opt: any) => Html2PdfInstance;
    from: (element: HTMLElement) => Html2PdfInstance;
    save: () => Promise<void>;
    outputPdf: (type: string) => Promise<any>;
  }

  function html2pdf(): Html2PdfInstance;
  function html2pdf(element: HTMLElement, opt?: any): Promise<void>;

  export default html2pdf;
}
