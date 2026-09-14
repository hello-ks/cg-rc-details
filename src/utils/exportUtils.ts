import * as XLSX from 'xlsx';
import { ExtractedRationCardDetails, BatchJobItem } from '../types';

export function exportToExcel(items: BatchJobItem[], filenamePrefix = 'CG_Ration_Cards') {
  const successfulItems = items
    .filter(i => i.status === 'success' && i.result)
    .map(i => i.result!);

  if (successfulItems.length === 0) {
    alert('No successfully extracted ration cards available to export.');
    return;
  }

  const wb = XLSX.utils.book_new();

  // 1. Summary Sheet
  const summaryData = successfulItems.map((card, idx) => ({
    'S.No.': idx + 1,
    'Ration Card No (राशन कार्ड क्र.)': card.rcNo,
    'FPS ID (उचित मूल्य दुकान क्र.)': card.fpsId,
    'Head of Family Name (मुखिया का नाम)': card.headName,
    'Father/Husband Name (पिता/पति का नाम)': card.guardianName,
    'Card Type / Scheme (कार्ड का प्रकार)': card.cardType,
    'District (जिला)': card.district,
    'Block/ULB (विकासखंड)': card.block,
    'Gram Panchayat / Ward (ग्राम पंचायत/वार्ड)': card.gramPanchayat,
    'Village/Locality (ग्राम/मोहल्ला)': card.village,
    'Total Members (कुल सदस्य)': card.totalMembers,
    'Gas Connection (गैस कनेक्शन)': card.gasConnection,
    'Aadhaar/Bank Seeded (आधार सींडिग)': card.bankAadhaarSeeded,
    'FPS Shop Name (दुकान नाम)': card.fpsName,
    'Extracted At (दिनांक)': card.extractedAt,
    'Extraction Source': card.source
  }));

  const summarySheet = XLSX.utils.json_to_sheet(summaryData);

  // Set column widths for sheet 1
  summarySheet['!cols'] = [
    { wch: 6 },  // S.No
    { wch: 18 }, // RC No
    { wch: 14 }, // FPS ID
    { wch: 24 }, // Head Name
    { wch: 24 }, // Guardian Name
    { wch: 20 }, // Card Type
    { wch: 18 }, // District
    { wch: 18 }, // Block
    { wch: 22 }, // GP
    { wch: 18 }, // Village
    { wch: 14 }, // Total Members
    { wch: 14 }, // Gas
    { wch: 16 }, // Bank/Aadhaar
    { wch: 28 }, // FPS Name
    { wch: 22 }, // Extracted At
    { wch: 14 }  // Source
  ];

  XLSX.utils.book_append_sheet(wb, summarySheet, 'Ration Cards Summary');

  // 2. Members Sheet
  const membersData: any[] = [];
  let memberGlobalCounter = 1;

  successfulItems.forEach(card => {
    card.members.forEach(m => {
      membersData.push({
        'Global S.No.': memberGlobalCounter++,
        'Ration Card No': card.rcNo,
        'Member S.No.': m.sNo,
        'Member Name (सदस्य का नाम)': m.name,
        'Gender (लिंग)': m.gender,
        'Age (आयु)': m.age,
        'Relation (मुखिया से संबंध)': m.relation,
        'Aadhaar eKYC Status (ई-केवाईसी स्थिति)': m.aadhaarStatus,
        'Member ID': m.memberId || '',
        'Head of Family': card.headName,
        'District': card.district
      });
    });
  });

  if (membersData.length > 0) {
    const membersSheet = XLSX.utils.json_to_sheet(membersData);
    membersSheet['!cols'] = [
      { wch: 8 },  // Global SNo
      { wch: 18 }, // RC No
      { wch: 10 }, // Member SNo
      { wch: 24 }, // Member Name
      { wch: 16 }, // Gender
      { wch: 8 },  // Age
      { wch: 18 }, // Relation
      { wch: 20 }, // Aadhaar Status
      { wch: 16 }, // Member ID
      { wch: 24 }, // Head
      { wch: 18 }  // District
    ];
    XLSX.utils.book_append_sheet(wb, membersSheet, 'Family Members Breakdown');
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  XLSX.writeFile(wb, `${filenamePrefix}_${timestamp}.xlsx`);
}

export function exportToCSV(items: BatchJobItem[], mode: 'summary' | 'detailed_members' = 'summary') {
  const successfulItems = items
    .filter(i => i.status === 'success' && i.result)
    .map(i => i.result!);

  if (successfulItems.length === 0) {
    alert('No successfully extracted ration cards available to export.');
    return;
  }

  let csvRows: string[] = [];

  if (mode === 'summary') {
    const headers = [
      'S.No',
      'Ration Card No',
      'FPS ID',
      'Head Name',
      'Guardian Name',
      'Card Type',
      'District',
      'Block',
      'Gram Panchayat',
      'Village',
      'Total Members',
      'Gas Connection',
      'Aadhaar Seeded',
      'FPS Name',
      'Extracted At'
    ];
    csvRows.push(headers.map(h => `"${h}"`).join(','));

    successfulItems.forEach((card, idx) => {
      const row = [
        idx + 1,
        card.rcNo,
        card.fpsId,
        card.headName,
        card.guardianName,
        card.cardType,
        card.district,
        card.block,
        card.gramPanchayat,
        card.village,
        card.totalMembers,
        card.gasConnection,
        card.bankAadhaarSeeded,
        card.fpsName,
        card.extractedAt
      ].map(val => `"${String(val ?? '').replace(/"/g, '""')}"`);
      csvRows.push(row.join(','));
    });
  } else {
    // Detailed Members
    const headers = [
      'Ration Card No',
      'Head Name',
      'Member SNo',
      'Member Name',
      'Gender',
      'Age',
      'Relation',
      'Aadhaar eKYC Status',
      'District',
      'FPS ID'
    ];
    csvRows.push(headers.map(h => `"${h}"`).join(','));

    successfulItems.forEach(card => {
      card.members.forEach(m => {
        const row = [
          card.rcNo,
          card.headName,
          m.sNo,
          m.name,
          m.gender,
          m.age,
          m.relation,
          m.aadhaarStatus,
          card.district,
          card.fpsId
        ].map(val => `"${String(val ?? '').replace(/"/g, '""')}"`);
        csvRows.push(row.join(','));
      });
    });
  }

  const csvContent = '\uFEFF' + csvRows.join('\n'); // Add UTF-8 BOM for Hindi character encoding support in Excel
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  link.setAttribute('href', url);
  link.setAttribute('download', `CG_Ration_Cards_${mode}_${timestamp}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function parseUploadedFileContent(fileText: string): { rcNo: string; fpsId: string }[] {
  const lines = fileText.split(/\r?\n/);
  const items: { rcNo: string; fpsId: string }[] = [];

  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('#') || line.toLowerCase().includes('ration card')) continue;

    // Split by comma, tab, or whitespace
    const parts = line.split(/[,;\t\s]+/).filter(Boolean);
    if (parts.length >= 1) {
      // Clean digits
      const firstPart = parts[0].replace(/[^0-9]/g, '');
      const secondPart = parts.length > 1 ? parts[1].replace(/[^0-9]/g, '') : '';
      const thirdPart = parts.length > 2 ? parts[2].replace(/[^0-9]/g, '') : '';

      // If line is: "1, 223860008007, 412001080"
      if (firstPart.length <= 4 && secondPart.length >= 10) {
        items.push({
          rcNo: secondPart,
          fpsId: thirdPart || '412001080'
        });
      } else if (firstPart.length >= 10) {
        items.push({
          rcNo: firstPart,
          fpsId: secondPart || '412001080'
        });
      }
    }
  }

  return items;
}
