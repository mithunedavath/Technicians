'use server';

/**
 * @fileOverview Calculates total expenses for each technician based on distance traveled and other factors in their reports.
 *
 * - calculateTechnicianExpenses - A function that calculates the expenses for a technician.
 * - CalculateTechnicianExpensesInput - The input type for the calculateTechnicianExpenses function.
 * - CalculateTechnicianExpensesOutput - The return type for the calculateTechnicianExpenses function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CalculateTechnicianExpensesInputSchema = z.object({
  technicianName: z.string().describe('The name of the technician.'),
  distanceTraveledMiles: z.number().describe('The distance traveled by the technician in miles.'),
  otherExpenses: z.string().describe('A description of other expenses incurred by the technician.'),
  reportDetails: z.string().describe('Additional details from the technician report.'),
});
export type CalculateTechnicianExpensesInput = z.infer<
  typeof CalculateTechnicianExpensesInputSchema
>;

const CalculateTechnicianExpensesOutputSchema = z.object({
  totalExpenses: z
    .number()
    .describe('The calculated total expenses for the technician.'),
  optimizedRouteSuggestion: z
    .string()
    .describe('A suggestion for optimizing the technician route to reduce costs.'),
});
export type CalculateTechnicianExpensesOutput = z.infer<
  typeof CalculateTechnicianExpensesOutputSchema
>;

export async function calculateTechnicianExpenses(
  input: CalculateTechnicianExpensesInput
): Promise<CalculateTechnicianExpensesOutput> {
  return calculateTechnicianExpensesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'calculateTechnicianExpensesPrompt',
  input: {schema: CalculateTechnicianExpensesInputSchema},
  output: {schema: CalculateTechnicianExpensesOutputSchema},
  prompt: `You are an expert expense calculator and route optimizer for field technicians. Given the technician's name, distance traveled, other expenses, and report details, calculate the total expenses and suggest an optimized route.

Technician Name: {{{technicianName}}}
Distance Traveled: {{{distanceTraveledMiles}}} miles
Other Expenses: {{{otherExpenses}}}
Report Details: {{{reportDetails}}}

Consider factors such as fuel costs (assume $4.00/gallon and 20 miles/gallon), maintenance, and any other relevant expenses described in the report details. Also, identify potential inefficiencies in the reported route and suggest improvements to reduce costs.

Output the total calculated expenses as a number and provide a brief suggestion for route optimization.
`,
});

const calculateTechnicianExpensesFlow = ai.defineFlow(
  {
    name: 'calculateTechnicianExpensesFlow',
    inputSchema: CalculateTechnicianExpensesInputSchema,
    outputSchema: CalculateTechnicianExpensesOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
