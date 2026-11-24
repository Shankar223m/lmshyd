import html2pdf from 'html2pdf.js';

export async function exportResumeToPdf(elementId: string, filename: string = 'Resume.pdf'): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element #${elementId} not found for PDF generation`);
    return;
  }

  const opt = {
    margin: 0,
    filename: filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
  };

  try {
    await (html2pdf() as any).set(opt).from(element).save();
  } catch (err) {
    console.error('Client-side PDF export failed, falling back to print dialog:', err);
    window.print();
  }
}

export async function generateResumePdfBlob(element: HTMLElement, filename: string = 'Resume.pdf'): Promise<Blob> {
  const opt = {
    margin: 0,
    filename: filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
  };

  try {
    const pdfBlob = await (html2pdf() as any).set(opt).from(element).outputPdf('blob');
    if (pdfBlob instanceof Blob) {
      return pdfBlob;
    }
  } catch (err) {
    console.warn('html2pdf outputPdf failed, creating fallback text blob:', err);
  }

  // Fallback text/pdf blob if canvas rendering fails in certain headless environments
  return new Blob([element.innerText || 'Resume'], { type: 'application/pdf' });
}
