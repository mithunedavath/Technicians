
"use server";

import { z } from "zod";
import * as XLSX from 'xlsx';
import { Buffer } from 'buffer';

const masterReportActionSchema = z.object({
    allReports: z.any().array(),
    columnConfig: z.record(z.string()),
});

type CsvRow = { [key: string]: string };

const findMostFrequent = (arr: string[]): string => {
    if (arr.length === 0) return '';
    const counts = arr.reduce((acc, value) => {
        if(!value) return acc;
        acc[value] = (acc[value] || 0) + 1;
        return acc;
    }, {} as { [key: string]: number });
    return Object.keys(counts).length > 0 ? Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b) : '';
};

const delhiNcrRates: { [key: string]: number } = { 'LC': 250, 'UC-L': 250, 'UC-1': 350, 'UC-2': 450, 'PC-1': 250, 'PC-2': 350, 'PC-3': 450, 'SC': 500 };
const restOfIndiaRates: { [key: string]: number } = { 'LC': 300, 'UC-L': 300, 'UC-1': 450, 'UC-2': 600, 'PC-1': 450, 'PC-2': 600, 'PC-3': 750, 'SC': 600 };

const calculateTechnicianPayout = (reports: CsvRow[], columnConfig: any) => {
    const { statusColumn, timeColumn, locationColumn, additionalKmColumn, deductionsColumn, vendorTypeColumn, coordinatorColumn } = columnConfig;
    
    const coordinator = findMostFrequent(reports.map(r => r[coordinatorColumn]));
    const isDelhiNcr = coordinator === 'Vihaan Jha';
    
    const callTypeRates = isDelhiNcr ? delhiNcrRates : restOfIndiaRates;
    const vendorType = reports[0]?.[vendorTypeColumn] || '';

    let closedWithin24 = 0, closedWithin48 = 0, closedAbove48 = 0, nonMsl = 0;
    const callTypeCounts: { [key: string]: number } = {};
    let totalAdditionalKm = 0, totalDeductionSum = 0;

    reports.forEach(row => {
        if (row[statusColumn]?.toLowerCase().includes('close')) {
            if (row[locationColumn]?.toUpperCase() === 'SC') {
                nonMsl++;
            } else {
                if (row[timeColumn]) {
                    const hours = parseFloat(row[timeColumn]);
                    if (!isNaN(hours)) {
                        if (hours <= 24) closedWithin24++;
                        else if (hours <= 48) closedWithin48++;
                        else closedAbove48++;
                    }
                }
            }
            if (row[locationColumn]) {
                callTypeCounts[row[locationColumn]] = (callTypeCounts[row[locationColumn]] || 0) + 1;
            }
        }
        totalAdditionalKm += parseFloat(row[additionalKmColumn] || '0');
        const deductionVal = parseFloat(row[deductionsColumn] || '0');
        if (!isNaN(deductionVal)) {
            totalDeductionSum += deductionVal;
        }
    });

    const totalComplaintsForTat = closedWithin24 + closedWithin48 + closedAbove48;
    const totalCalls = totalComplaintsForTat + nonMsl;
    const tat24Percentage = totalComplaintsForTat > 0 ? (closedWithin24 / totalComplaintsForTat) * 100 : 0;
    const tat48Percentage = totalComplaintsForTat > 0 ? ((closedWithin24 + closedWithin48) / totalComplaintsForTat) * 100 : 0;
    
    let incentiveAchievement = "NA";
    if (tat24Percentage >= 75) incentiveAchievement = "50/call";
    else if (tat48Percentage >= 85) incentiveAchievement = "25/call";
    
    const incentiveRate = incentiveAchievement === "50/call" ? 50 : (incentiveAchievement === "25/call" ? 25 : 0);
    const incentiveAmount = totalCalls * incentiveRate;

    const payoutAmount = Object.entries(callTypeRates).reduce((sum, [type, rate]) => sum + (callTypeCounts[type] || 0) * rate, 0);
    const additionalKmAmount = totalAdditionalKm * 4;
    
    const totalAmount = payoutAmount + additionalKmAmount + incentiveAmount;
    const totalDeductions = totalDeductionSum;
    const gstAmount = vendorType.toUpperCase() === 'ASP' ? (totalAmount - totalDeductions) * 0.18 : 0;
    const totalAmountPayable = totalAmount - totalDeductions + gstAmount;

    return {
        callsAttended: reports.length,
        totalPayable: totalAmountPayable,
        basePayout: payoutAmount,
        additionalKm: totalAdditionalKm,
        additionalKmAmount: additionalKmAmount,
        incentiveAmount: incentiveAmount,
        totalAmountClaimed: totalAmount,
        deductions: totalDeductions,
    };
};

const createStyledWorksheet = (data: any[][]) => {
    const ws = XLSX.utils.aoa_to_sheet(data);
    const colWidths = data[0].map((_, i) => ({
        wch: data.reduce((w, r) => Math.max(w, String(r[i] || "").length), 10)
    }));
    ws['!cols'] = colWidths;
    return ws;
};

export async function generateMasterReport(input: { allReports: CsvRow[], columnConfig: any }): Promise<{ data?: string; error?: string }> {
    const parsed = masterReportActionSchema.safeParse(input);
    if (!parsed.success) return { error: 'Invalid input.' };

    const { allReports, columnConfig } = parsed.data;
    const { technicianColumn, vendorTypeColumn, stateColumn, billingCycleColumn, dateColumn, coordinatorColumn } = columnConfig;

    const technicianReportsMap = allReports.reduce((acc, row) => {
        const techName = row[technicianColumn];
        if (techName) {
            if (!acc.has(techName)) acc.set(techName, []);
            acc.get(techName)!.push(row);
        }
        return acc;
    }, new Map<string, CsvRow[]>());

    const masterSheetData: any[][] = [
        ["S NO", "Technician", "Vendor Type", "State", "Coordinator", "Month", "Billing Cycle", "No of Calls Attended", "Base Payout", "Additional KM", "F/C", "B/L", "Mis. Expense", "Incentive", "Total Amount Claimed", "Deductions", "Total Payable after Deduction"]
    ];

    let sno = 1;
    for (const [technicianName, reports] of technicianReportsMap.entries()) {
        const { callsAttended, totalAmountClaimed, deductions, totalPayable, basePayout, additionalKm, additionalKmAmount, incentiveAmount } = calculateTechnicianPayout(reports, columnConfig);
        
        const months = reports.map(r => {
            try { 
                const date = new Date(r[dateColumn]);
                if (isNaN(date.getTime())) return null;
                return date.toLocaleString('default', { month: 'long' }); 
            } catch { return null; }
        }).filter(Boolean) as string[];

        masterSheetData.push([
            sno++,
            technicianName.trim(),
            reports[0][vendorTypeColumn] || '',
            reports[0][stateColumn] || '',
            findMostFrequent(reports.map(r => r[coordinatorColumn])),
            findMostFrequent(months),
            findMostFrequent(reports.map(r => r[billingCycleColumn])),
            callsAttended,
            basePayout.toFixed(2),
            additionalKm.toFixed(2),
            additionalKmAmount.toFixed(2),
            0, 0,
            incentiveAmount.toFixed(2),
            totalAmountClaimed.toFixed(2),
            deductions.toFixed(2),
            totalPayable.toFixed(2),
        ]);
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, createStyledWorksheet(masterSheetData), "Master Sheet");
    
    const coordinatorReportsMap = allReports.reduce((acc, row) => {
        const coordinatorName = row[coordinatorColumn];
        if (coordinatorName) {
            if (!acc.has(coordinatorName)) acc.set(coordinatorName, []);
            acc.get(coordinatorName)!.push(row);
        }
        return acc;
    }, new Map<string, CsvRow[]>());

    for (const [coordinatorName, coordinatorReports] of coordinatorReportsMap.entries()) {
        const coordinatorTechnicianMap = coordinatorReports.reduce((acc, row) => {
            const techName = row[technicianColumn];
            if (techName) {
                if (!acc.has(techName)) acc.set(techName, []);
                acc.get(techName)!.push(row);
            }
            return acc;
        }, new Map<string, CsvRow[]>());

        const coordinatorSheetData: any[][] = [
            ["S NO", "Technician", "Vendor Type", "State", "Month", "Billing Cycle", "No of Calls Attended", "Base Payout", "Additional KM", "F/C", "B/L", "Mis. Expense", "Incentive", "Total Amount Claimed", "Deductions", "Total Payable after Deduction"]
        ];

        let coordSno = 1;
        for (const [technicianName, reports] of coordinatorTechnicianMap.entries()) {
             const { callsAttended, totalAmountClaimed, deductions, totalPayable, basePayout, additionalKm, additionalKmAmount, incentiveAmount } = calculateTechnicianPayout(reports, columnConfig);
             const months = reports.map(r => {
                try { 
                    const d = new Date(r[dateColumn]);
                    return isNaN(d.getTime()) ? null : d.toLocaleString('default', { month: 'long' }); 
                } catch { return null; }
            }).filter(Boolean) as string[];

            coordinatorSheetData.push([
                coordSno++,
                technicianName.trim(),
                reports[0][vendorTypeColumn] || '',
                reports[0][stateColumn] || '',
                findMostFrequent(months),
                findMostFrequent(reports.map(r => r[billingCycleColumn])),
                callsAttended,
                basePayout.toFixed(2),
                additionalKm.toFixed(2),
                additionalKmAmount.toFixed(2),
                0, 0,
                incentiveAmount.toFixed(2),
                totalAmountClaimed.toFixed(2),
                deductions.toFixed(2),
                totalPayable.toFixed(2),
            ]);
        }
        const safeName = coordinatorName.replace(/[\/\\?*\[\]]/g, '').substring(0, 31);
        XLSX.utils.book_append_sheet(wb, createStyledWorksheet(coordinatorSheetData), safeName);
    }
    
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
    return { data: Buffer.from(wbout).toString('base64') };
}
