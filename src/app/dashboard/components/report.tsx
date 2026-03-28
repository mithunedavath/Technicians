"use client";

import { useEffect, useState } from 'react';
import { generateReportData } from '../actions';
import { Download, Loader2, FileText, PieChart, Printer, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { collection, query, where } from 'firebase/firestore';
import { useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { cn } from '@/lib/utils';

type CsvRow = { [key: string]: string };

interface ReportProps {
  filteredReports: CsvRow[];
  filters: {
    state: string;
    month: string;
    technician: string;
    billingCycle: string;
  };
  payoutType: string;
  fixedSalary?: number;
  address?: string;
  pan?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  columnConfig: Record<string, string>;
}

function numberToWords(num: number): string {
    const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
    const teens = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
    const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

    function convert(n: number): string {
        if (n === 0) return '';
        let words = '';
        if (n >= 100) { words += ones[Math.floor(n / 100)] + ' hundred'; n %= 100; if (n > 0) words += ' '; }
        if (n > 0) {
            if (n < 10) words += ones[n];
            else if (n < 20) words += teens[n - 10];
            else { words += tens[Math.floor(n / 10)]; if (n % 10 > 0) words += ' ' + ones[n % 10]; }
        }
        return words;
    }

    if (num === 0) return 'Zero Only.';
    const integerPart = Math.floor(num);
    const numStr = integerPart.toString();
    let words = '';
    
    if (numStr.length > 7) { const crores = parseInt(numStr.slice(0, -7)); if(crores) words += `${convert(crores)} crore `; }
    if (numStr.length > 5) { const lakhsStr = numStr.length > 7 ? numStr.slice(-7, -5) : numStr.slice(0, -5); const lakhs = parseInt(lakhsStr); if (lakhs) words += `${convert(lakhs)} lakh `; }
    if (numStr.length > 3) { const thousandsStr = numStr.length > 5 ? numStr.slice(-5, -3) : numStr.slice(0, -3); const thousands = parseInt(thousandsStr); if (thousands) words += `${convert(thousands)} thousand `; }
    const hundredsStr = numStr.length > 3 ? numStr.slice(-3) : numStr;
    const hundreds = parseInt(hundredsStr);
    if (hundreds) words += `${convert(hundreds)}`;
    
    let finalStr = words.trim().replace(/\s+/g, ' ');
    if (!finalStr) return 'Zero Only.';
    finalStr = finalStr.charAt(0).toUpperCase() + finalStr.slice(1);
    
    const decimalPart = Math.round((num - integerPart) * 100);
    if(decimalPart > 0) {
        const decimalWords = convert(decimalPart);
        if (decimalWords) finalStr += ` and ${decimalWords.charAt(0).toUpperCase() + decimalWords.slice(1)} paise`;
    }
    return `${finalStr} Only.`;
}

const findMostFrequent = (arr: (string | undefined)[]): string => {
    if (!arr || arr.length === 0) return '';
    const counts = arr.reduce((acc, value) => { if (!value) return acc; acc[value] = (acc[value] || 0) + 1; return acc; }, {} as { [key: string]: number });
    const keys = Object.keys(counts);
    return keys.length > 0 ? keys.reduce((a, b) => counts[a] > counts[b] ? a : b) : '';
};

const formatDisplayDate = (dateStr: string | undefined) => {
    if (!dateStr) return 'N/A';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    // Converts yyyy-mm-dd to dd-mm-yyyy
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
};

const cleanTechnicianName = (name: string) => {
    if (!name) return "";
    return name.split('(')[0].trim();
};

export function Report({ 
    filteredReports, filters, payoutType, fixedSalary, 
    address: propAddress, pan: propPan, 
    invoiceNumber: propInvoiceNo, invoiceDate: propInvoiceDate,
    columnConfig
}: ReportProps) {
  const [reportData, setReportData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const db = useFirestore();

  const formattedInvoiceDate = formatDisplayDate(propInvoiceDate);

  const technicianNameRaw = (filters.technician || findMostFrequent(filteredReports.map(r => r[columnConfig.technicianColumn])) || 'N/A').trim();
  const displayTechnicianName = cleanTechnicianName(technicianNameRaw);
  
  const vendorCode = columnConfig.vendorCodeColumn ? findMostFrequent(filteredReports.map(r => r[columnConfig.vendorCodeColumn])) : null;

  const vendorQuery = useMemoFirebase(() => {
    if (!db) return null;
    if (vendorCode) {
        return query(collection(db, "vendors"), where("vendorCode", "==", vendorCode));
    }
    if (technicianNameRaw) {
        return query(collection(db, "vendors"), where("companyName", "==", technicianNameRaw));
    }
    return null;
  }, [db, vendorCode, technicianNameRaw]);
  
  const { data: matchedVendors } = useCollection(vendorQuery);
  const vendor = matchedVendors?.[0];

  const gstType = vendor?.billingGstType || "NON GST";

  useEffect(() => {
    async function fetchData() {
      try {
        const result = await generateReportData({ 
            filteredReports, 
            columnConfig, 
            payoutType, 
            fixedSalary,
            gstType
        });
        if (result.error) setError(result.error); else setReportData(result.data);
      } catch (e: any) {
        setError(e.message || 'Error loading payout data.');
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [filteredReports, filters.state, payoutType, fixedSalary, columnConfig, gstType]);
  
  const displayAddress = vendor?.establishmentAddress || propAddress || "";
  const displayPan = vendor?.panNumber || propPan || "N/A";
  const billingAddress = vendor?.billingAddress || "";
  const billingGstin = vendor?.billingGstin || "";
  
  const bankName = vendor?.bankName || "";
  const accountNo = vendor?.bankAccountNumber || "";
  const ifsc = vendor?.ifscCode || "";

  const getGstRows = (totalAmount: number, deductions: number) => {
    const rows = [];
    const taxable = totalAmount - deductions;
    
    if (gstType === 'NON GST') return rows;

    if (reportData?.gstAmount > 0) {
        if (gstType?.toLowerCase() === 'sgst+cgst' || gstType === 'SGST+CGST') {
            rows.push({ name: 'SGST @ 9%', amount: taxable * 0.09 });
            rows.push({ name: 'CGST @ 9%', amount: taxable * 0.09 });
        } else {
            rows.push({ name: gstType?.toUpperCase() === 'IGST' ? 'IGST @ 18%' : 'GST @ 18%', amount: reportData.gstAmount });
        }
    }
    return rows;
  };

  const handleDownloadSummaryPdf = () => {
    if (!reportData) return;
    const doc = new jsPDF();
    const margin = 20;

    doc.setFontSize(18); doc.setFont("helvetica", 'bold');
    doc.text('Performance Summary', margin, 25);
    
    doc.setFontSize(12); doc.setFont("helvetica", 'normal');
    doc.text(`Technician: ${displayTechnicianName}`, margin, 35);
    doc.text(`Period: ${filters.billingCycle || 'N/A'}`, margin, 42);
    
    const summaryBody = [
        ['Total Calls Attended', reportData.totalCalls],
        ['Closed Within 24 HRS', reportData.closedWithin24],
        ['Closed Within 48 HRS', reportData.closedWithin48],
        ['Closed Above 48 HRS', reportData.closedAbove48],
        ['TAT 24 HRS (%)', reportData.tat24],
        ['TAT 48 HRS (%)', reportData.tat48],
        ['Incentive Eligibility', reportData.incentiveAchievement]
    ];

    (doc as any).autoTable({
        startY: 50,
        head: [['Metric', 'Value']],
        body: summaryBody,
        theme: 'grid',
        headStyles: { fillColor: [221, 230, 245], textColor: [0, 0, 0] },
        styles: { fontSize: 10, cellPadding: 5 }
    });

    doc.save(`summary_${displayTechnicianName}.pdf`);
  };

  const handleDownloadInvoicePdf = () => {
    if (!reportData) return;
    const doc = new jsPDF();
    const margin = 14;
    const pageWidth = doc.internal.pageSize.width;
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(22); doc.setFont("helvetica", 'bold');
    doc.text('INVOICE', pageWidth - margin - 50, 25);
    
    doc.setFontSize(10); doc.setFont("helvetica", 'normal');
    doc.text(`INV No: ${propInvoiceNo}`, pageWidth - margin - 50, 32);
    doc.text(`Date: ${formattedInvoiceDate}`, pageWidth - margin - 50, 37);

    doc.setFontSize(12); doc.setFont("helvetica", 'bold');
    doc.text(displayTechnicianName, margin, 25);
    
    doc.setFontSize(9); doc.setFont("helvetica", 'normal');
    let fromY = 30;
    if (displayAddress) {
        const splitFrom = doc.splitTextToSize(displayAddress, 85);
        doc.text(splitFrom, margin, fromY);
        fromY += (splitFrom.length * 4.5);
    }
    doc.text(`PAN: ${displayPan}`, margin, fromY);

    let currentY = fromY + 10;
    doc.setFontSize(10); doc.setFont("helvetica", 'bold');
    doc.text('BILL TO:', margin, currentY);
    doc.setFontSize(10);
    doc.text('Kajaria Bathware Pvt. Ltd.', margin, currentY + 6);
    
    doc.setFontSize(9); doc.setFont("helvetica", 'normal');
    let toY = currentY + 11;
    if (billingAddress) {
        const splitTo = doc.splitTextToSize(billingAddress, 85);
        doc.text(splitTo, margin, toY);
        toY += (splitTo.length * 4.5);
    }
    if (billingGstin) doc.text(`GSTIN: ${billingGstin}`, margin, toY);

    currentY = toY + 10;

    const invoiceBody = reportData.payouts.map((p: any, i: number) => [
        i + 1, p.name, p.name === 'Additional KM' ? p.count.toFixed(2) : p.count, p.rate, p.amount.toFixed(2)
    ]);
    
    (doc as any).autoTable({
        startY: currentY,
        head: [['S.No', 'Description', 'Qty', 'Rate', 'Amount']],
        body: invoiceBody,
        theme: 'grid',
        headStyles: { fillColor: [221, 230, 245], textColor: 0, lineWidth: 0.1 },
        styles: { fontSize: 8.5, cellPadding: 3 },
        columnStyles: {
            0: { cellWidth: 12 },
            1: { cellWidth: 90 },
            2: { halign: 'right' },
            3: { halign: 'right' },
            4: { halign: 'right' }
        }
    });

    const gstRows = getGstRows(reportData.totalAmount, reportData.totalDeductions);
    const totalsBody: any[] = [[{ content: 'Gross Amount', styles: { halign: 'right', fontStyle: 'bold' } }, reportData.totalAmount.toFixed(2)]];
    totalsBody.push([{ content: 'Deductions (-)', styles: { halign: 'right' } }, reportData.totalDeductions.toFixed(2)]);
    gstRows.forEach(row => totalsBody.push([{ content: row.name, styles: { halign: 'right' } }, row.amount.toFixed(2)]));
    totalsBody.push([{ content: 'NET PAYABLE', styles: { halign: 'right', fontStyle: 'bold', fontSize: 11, textColor: [37, 99, 235] } }, `INR ${reportData.totalAmountPayable.toFixed(2)}`]);
    
    (doc as any).autoTable({
        startY: (doc as any).lastAutoTable.finalY + 5,
        margin: { left: pageWidth - 100 },
        body: totalsBody,
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 2 }
    });

    const finalY = (doc as any).lastAutoTable.finalY;

    doc.setFontSize(8.5); doc.setFont("helvetica", 'bold');
    doc.text('Amount in Words:', margin, finalY - 5);
    doc.setFont("helvetica", 'normal');
    doc.text(numberToWords(reportData.totalAmountPayable), margin, finalY);

    doc.setFontSize(9); doc.setFont("helvetica", 'bold');
    doc.text('BANK DETAILS:', margin, finalY + 15);
    doc.setFontSize(8.5); doc.setFont("helvetica", 'normal');
    doc.text(`Bank: ${bankName || 'N/A'}`, margin, finalY + 21);
    doc.text(`Account: ${accountNo || 'N/A'}`, margin, finalY + 26);
    doc.text(`IFSC: ${ifsc || 'N/A'}`, margin, finalY + 31);

    doc.save(`invoice_${displayTechnicianName}_${propInvoiceNo}.pdf`);
  };

  const handleDownloadExcel = () => {
    if (!reportData) return;
    const wb = XLSX.utils.book_new();

    const invoice_data: any[][] = [
        ["INVOICE"],
        [`INV No: ${propInvoiceNo}`, `Date: ${formattedInvoiceDate}`],
        [],
        [displayTechnicianName],
        ["Address:", displayAddress || ""],
        ["PAN:", displayPan || ""],
        [],
        ["BILL TO:", "Kajaria Bathware Pvt. Ltd."],
        ["Address:", billingAddress || ""],
        ["GSTIN:", billingGstin || ""],
        [],
        ["S.No", "Description", "Qty", "Rate", "Amount"]
    ];
    reportData.payouts.forEach((p: any, i: number) => invoice_data.push([i + 1, p.name, p.name === 'Additional KM' ? p.count.toFixed(2) : p.count, p.rate, p.amount.toFixed(2)]));
    invoice_data.push(["Gross Total", "", "", "", reportData.totalAmount.toFixed(2)]);
    invoice_data.push(["Deductions", "", "", "", (-reportData.totalDeductions).toFixed(2)]);
    const gstRows = getGstRows(reportData.totalAmount, reportData.totalDeductions);
    gstRows.forEach(r => invoice_data.push([r.name, "", "", "", r.amount.toFixed(2)]));
    invoice_data.push(["Net Payable", "", "", "", reportData.totalAmountPayable.toFixed(2)]);
    invoice_data.push(["Amount in Words", numberToWords(reportData.totalAmountPayable)]);
    
    const wsInvoice = XLSX.utils.aoa_to_sheet(invoice_data);
    XLSX.utils.book_append_sheet(wb, wsInvoice, "Invoice");

    if (filteredReports && filteredReports.length > 0) {
        const wsData = XLSX.utils.json_to_sheet(filteredReports);
        XLSX.utils.book_append_sheet(wb, wsData, "Filtered Data");
    }
    
    XLSX.writeFile(wb, `payout_report_${displayTechnicianName}.xlsx`);
  }

  if (isLoading) return <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (error) return <div className="text-destructive p-4 bg-destructive/10 rounded-lg">Error: {error}</div>;

  const gstRows = getGstRows(reportData.totalAmount, reportData.totalDeductions);
  const tat24Num = parseFloat(reportData.tat24);
  const tat48Num = parseFloat(reportData.tat48);

  return (
    <div className="space-y-6">
        <Tabs defaultValue="invoice" className="w-full">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 px-4">
                <TabsList className="bg-muted p-1 rounded-xl">
                    <TabsTrigger value="summary" className="gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white"><PieChart className="h-4 w-4" />Efficiency</TabsTrigger>
                    <TabsTrigger value="invoice" className="gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white"><FileText className="h-4 w-4" />Invoice Preview</TabsTrigger>
                </TabsList>
                <div className="flex flex-wrap gap-2">
                    <Button onClick={handleDownloadSummaryPdf} variant="outline" size="sm" className="border-primary/20 hover:bg-primary/5"><Download className="mr-2 h-4 w-4" />Summary PDF</Button>
                    <Button onClick={handleDownloadInvoicePdf} variant="outline" size="sm" className="border-accent/20 hover:bg-accent/5"><Printer className="mr-2 h-4 w-4" />Invoice PDF</Button>
                    <Button onClick={handleDownloadExcel} variant="secondary" size="sm" className="bg-green-600 hover:bg-green-700 text-white"><Download className="mr-2 h-4 w-4" />XLSX Package</Button>
                </div>
            </div>

            <TabsContent value="summary" className="animate-in fade-in zoom-in-95 duration-300">
                <div className="grid md:grid-cols-2 gap-6">
                    <Card className="shadow-md border-primary/10 overflow-hidden">
                        <CardHeader className="bg-primary/5"><CardTitle className="text-primary flex items-center gap-2"><CheckCircle2 className="h-5 w-5" />Technician Workload</CardTitle></CardHeader>
                        <CardContent className="pt-6">
                            <Table>
                                <TableBody>
                                    <TableRow className="hover:bg-transparent"><TableCell className="font-semibold text-muted-foreground">Total Calls Attended</TableCell><TableCell className="text-right font-black text-lg">{reportData.totalCalls}</TableCell></TableRow>
                                    <TableRow className="hover:bg-transparent"><TableCell className="font-medium text-muted-foreground">Closed Within 24 HRS</TableCell><TableCell className="text-right font-bold text-green-600">{reportData.closedWithin24}</TableCell></TableRow>
                                    <TableRow className="hover:bg-transparent"><TableCell className="font-medium text-muted-foreground">Closed Within 48 HRS</TableCell><TableCell className="text-right font-bold text-blue-600">{reportData.closedWithin48}</TableCell></TableRow>
                                    <TableRow className="hover:bg-transparent"><TableCell className="font-medium text-muted-foreground">Closed Above 48 HRS</TableCell><TableCell className="text-right font-bold text-amber-600">{reportData.closedAbove48}</TableCell></TableRow>
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                    <Card className="shadow-md border-primary/10 overflow-hidden">
                        <CardHeader className="bg-primary/5"><CardTitle className="text-primary flex items-center gap-2"><Clock className="h-5 w-5" />TAT Performance</CardTitle></CardHeader>
                        <CardContent className="pt-6">
                            <Table>
                                <TableBody>
                                    <TableRow className="hover:bg-transparent">
                                        <TableCell className="font-semibold text-muted-foreground">TAT 24 HRS (%)</TableCell>
                                        <TableCell className={cn("text-right font-black text-xl", tat24Num >= 75 ? "text-green-600" : "text-amber-500")}>
                                            {reportData.tat24}
                                        </TableCell>
                                    </TableRow>
                                    <TableRow className="hover:bg-transparent">
                                        <TableCell className="font-semibold text-muted-foreground">TAT 48 HRS (%)</TableCell>
                                        <TableCell className={cn("text-right font-black text-xl", tat48Num >= 85 ? "text-green-600" : "text-amber-500")}>
                                            {reportData.tat48}
                                        </TableCell>
                                    </TableRow>
                                    <TableRow className="hover:bg-transparent">
                                        <TableCell className="font-semibold text-muted-foreground">Incentive Eligibility</TableCell>
                                        <TableCell className="text-right font-bold flex items-center justify-end gap-2">
                                            {reportData.incentiveAchievement === "NA" ? <AlertCircle className="h-4 w-4 text-muted-foreground" /> : <CheckCircle2 className="h-4 w-4 text-green-600" />}
                                            {reportData.incentiveAchievement}
                                        </TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            </TabsContent>

            <TabsContent value="invoice" className="animate-in fade-in zoom-in-95 duration-300">
                <Card className="overflow-hidden border-2 border-primary/5 shadow-2xl bg-white rounded-2xl">
                    <div className="p-10">
                        <div className="flex justify-between items-start mb-12">
                            <div className="space-y-1">
                                <h2 className="text-2xl font-black text-primary tracking-tight">{displayTechnicianName}</h2>
                                <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">{displayAddress}</p>
                                <div className="inline-block bg-primary/10 text-primary text-xs font-black px-3 py-1 rounded-full mt-3 uppercase tracking-wider">PAN: {displayPan}</div>
                                
                                <div className="pt-10 space-y-1">
                                    <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-2">BILLING RECIPIENT</p>
                                    <p className="font-black text-lg text-slate-800">Kajaria Bathware Pvt. Ltd.</p>
                                    <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">{billingAddress}</p>
                                    {billingGstin && <p className="text-xs mt-2 font-bold text-slate-700 bg-slate-100 px-2 py-1 inline-block rounded">GSTIN: {billingGstin}</p>}
                                </div>
                            </div>
                            <div className="text-right">
                                <h1 className="text-5xl font-black tracking-tighter text-slate-200 mb-4">INVOICE</h1>
                                <div className="space-y-1">
                                    <p className="text-sm"><span className="text-muted-foreground font-medium">Serial No:</span> <span className="font-black text-primary">{propInvoiceNo}</span></p>
                                    <p className="text-sm"><span className="text-muted-foreground font-medium">Issue Date:</span> <span className="font-black">{formattedInvoiceDate}</span></p>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-xl border-2 border-slate-200 overflow-hidden shadow-sm">
                            <Table className="border-collapse">
                                <TableHeader>
                                    <TableRow className="border-b-2 border-slate-200 bg-slate-50 hover:bg-slate-50">
                                        <TableHead className="w-16 border-r-2 border-slate-200 text-[11px] font-black uppercase text-slate-600 text-center h-12">S.No</TableHead>
                                        <TableHead className="border-r-2 border-slate-200 text-[11px] font-black uppercase text-slate-600 h-12 px-6">Description</TableHead>
                                        <TableHead className="w-24 border-r-2 border-slate-200 text-[11px] font-black uppercase text-slate-600 text-center h-12">Qty</TableHead>
                                        <TableHead className="w-24 border-r-2 border-slate-200 text-[11px] font-black uppercase text-slate-600 text-center h-12">Rate</TableHead>
                                        <TableHead className="w-32 text-[11px] font-black uppercase text-slate-600 text-right h-12 px-6">Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {reportData.payouts.map((p: any, i: number) => (
                                        <TableRow key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                                            <TableCell className="border-r-2 border-slate-200 text-center text-sm py-4 font-bold text-slate-400">{i + 1}</TableCell>
                                            <TableCell className="border-r-2 border-slate-200 text-sm py-4 px-6 font-semibold text-slate-700">{p.name}</TableCell>
                                            <TableCell className="border-r-2 border-slate-200 text-center text-sm py-4 font-bold">{p.name === 'Additional KM' ? p.count.toFixed(2) : p.count}</TableCell>
                                            <TableCell className="border-r-2 border-slate-200 text-center text-sm py-4 text-slate-500">{p.rate}</TableCell>
                                            <TableCell className="text-right text-sm py-4 px-6 font-black text-slate-800">₹{p.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        <div className="mt-12 flex flex-col md:flex-row justify-between items-start md:items-end gap-12">
                            <div className="flex-1 space-y-8">
                                <div className="bg-slate-50 p-6 rounded-2xl border-2 border-dashed border-slate-200">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">GRAND TOTAL IN WORDS:</p>
                                    <p className="text-sm font-black text-primary leading-tight max-w-lg italic">" {numberToWords(reportData.totalAmountPayable)} "</p>
                                </div>
                                
                                <div className="space-y-3">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">REMITTANCE BANK DETAILS:</p>
                                    <div className="grid grid-cols-1 gap-2">
                                        <p className="text-xs font-bold text-slate-600"><span className="text-muted-foreground font-medium uppercase tracking-tighter">Bank:</span> {bankName || 'N/A'}</p>
                                        <p className="text-xs font-bold text-slate-600"><span className="text-muted-foreground font-medium uppercase tracking-tighter">Account:</span> {accountNo || 'N/A'}</p>
                                        <p className="text-xs font-bold text-slate-600"><span className="text-muted-foreground font-medium uppercase tracking-tighter">IFSC:</span> {ifsc || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="w-80 space-y-3 bg-primary/5 p-8 rounded-3xl border border-primary/10">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground font-bold">Subtotal</span>
                                    <span className="font-bold text-slate-700">₹{reportData.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between text-sm text-destructive">
                                    <span className="font-bold">Deductions (-)</span>
                                    <span className="font-black">-₹{reportData.totalDeductions.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                                {gstRows.map((row, i) => (
                                    <div key={i} className="flex justify-between text-sm border-t border-primary/10 pt-2 mt-2">
                                        <span className="text-muted-foreground font-bold">{row.name}</span>
                                        <span className="font-bold text-slate-700">₹{row.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    </div>
                                ))}
                                <div className="pt-4 mt-4 border-t-4 border-primary">
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-xs font-black text-primary uppercase tracking-tighter">NET PAYABLE</span>
                                        <span className="text-3xl font-black text-primary tracking-tighter">₹{reportData.totalAmountPayable.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </Card>
            </TabsContent>
        </Tabs>
    </div>
  );
}
