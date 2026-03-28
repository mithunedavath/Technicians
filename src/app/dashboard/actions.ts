
"use server";

import { z } from "zod";

const reportActionSchema = z.object({
    filteredReports: z.any().array(),
    columnConfig: z.record(z.string()),
    payoutType: z.string(),
    fixedSalary: z.number().optional(),
    gstType: z.string().optional(),
});

type CsvRow = { [key: string]: string };

export async function generateReportData(input: { 
    filteredReports: CsvRow[], 
    columnConfig: any, 
    payoutType: string,
    fixedSalary?: number,
    gstType?: string,
}): Promise<{ data?: any; error?: string }> {
    const parsed = reportActionSchema.safeParse(input);
    if (!parsed.success) {
        return { error: 'Invalid input for payout calculation.' };
    }

    const { filteredReports, columnConfig, payoutType, fixedSalary, gstType } = parsed.data;
    const { statusColumn, timeColumn, locationColumn, additionalKmColumn, deductionsColumn, vendorTypeColumn } = columnConfig;

    const firstReport = filteredReports.length > 0 ? filteredReports[0] : {};
    const vendorType = vendorTypeColumn && firstReport[vendorTypeColumn] ? firstReport[vendorTypeColumn] : '';

    const delhiNcrRates: { [key: string]: number } = {
        'LC': 250, 'UC-L': 250, 'UC-1': 350, 'UC-2': 450,
        'PC-1': 250, 'PC-2': 350, 'PC-3': 450, 'SC': 500,
    };
    
    const restOfIndiaRates: { [key: string]: number } = {
        'LC': 300, 'UC-L': 300, 'UC-1': 450, 'UC-2': 600,
        'PC-1': 450, 'PC-2': 600, 'PC-3': 750, 'SC': 600,
    };

    const isOffRoll = payoutType === 'OFF_ROLL';
    const baseRates = payoutType === 'DELHI/NCR' ? delhiNcrRates : restOfIndiaRates;

    let closedWithin24 = 0, closedWithin48 = 0, closedAbove48 = 0, nonMsl = 0;
    const callTypeCounts: { [key: string]: number } = {};
    let totalAdditionalKm = 0;
    let totalDeductionSum = 0;

    filteredReports.forEach(row => {
        const status = row[statusColumn];
        const location = row[locationColumn];
        const isClosed = status && status.toLowerCase().includes('close');
        
        if (isClosed) {
            if (location && location.toUpperCase() === 'SC') {
                nonMsl++;
            } else {
                 if (timeColumn && row[timeColumn]) {
                    const hours = parseFloat(row[timeColumn]);
                    if(!isNaN(hours)) {
                        if (hours <= 24) closedWithin24++;
                        else if (hours <= 48) closedWithin48++;
                        else closedAbove48++;
                    }
                }
            }
            if (location) {
                callTypeCounts[location] = (callTypeCounts[location] || 0) + 1;
            }
        }

        const additionalKmValue = parseFloat(row[additionalKmColumn] || '0');
        if(!isNaN(additionalKmValue)) {
            totalAdditionalKm += additionalKmValue;
        }

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

    const payoutData = [];
    if (isOffRoll && fixedSalary !== undefined) {
        payoutData.push({ name: 'Fixed Salary', count: 1, rate: fixedSalary, amount: fixedSalary });
    }

    Object.keys(baseRates).forEach(type => {
        const count = callTypeCounts[type] || 0;
        const rate = isOffRoll ? 0 : baseRates[type];
        payoutData.push({ name: type, count, rate, amount: count * rate });
    });

    const additionalKmAmount = totalAdditionalKm * 4;
    payoutData.push({ name: 'Additional KM', count: totalAdditionalKm, rate: 4, amount: additionalKmAmount });

    const incentiveRate = isOffRoll ? 0 : (incentiveAchievement === "50/call" ? 50 : (incentiveAchievement === "25/call" ? 25 : 0));
    const incentiveAmount = totalCalls * incentiveRate;
    payoutData.push({ name: 'Incentive', count: totalCalls, rate: incentiveRate, amount: incentiveAmount });

    const totalAmount = payoutData.reduce((sum, item) => sum + item.amount, 0);
    const totalDeductions = totalDeductionSum;

    let gstAmount = 0;
    // GST is calculated at 18% if vendor is ASP AND GST type is NOT "NON GST"
    if (vendorType && vendorType.toUpperCase() === 'ASP' && gstType !== 'NON GST') {
        gstAmount = (totalAmount - totalDeductions) * 0.18;
    }

    const totalAmountPayable = totalAmount - totalDeductions + gstAmount;

    return {
        data: {
            closedWithin24, closedWithin48, closedAbove48,
            totalComplaintsForTat, totalCalls, nonMsl, 
            tat24: `${tat24Percentage.toFixed(2)}%`,
            tat48: `${tat48Percentage.toFixed(2)}%`,
            incentiveAchievement,
            payouts: payoutData,
            totalAmount,
            totalDeductions,
            gstAmount,
            totalAmountPayable
        }
    };
}
