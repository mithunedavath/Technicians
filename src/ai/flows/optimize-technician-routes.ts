'use server';

/**
 * @fileOverview A flow that optimizes technician routes based on historical data and real-time conditions.
 *
 * - optimizeTechnicianRoutes - A function that handles the route optimization process.
 * - OptimizeTechnicianRoutesInput - The input type for the optimizeTechnicianRoutes function.
 * - OptimizeTechnicianRoutesOutput - The return type for the optimizeTechnicianRoutes function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const OptimizeTechnicianRoutesInputSchema = z.object({
  technicianId: z.string().describe('The ID of the technician.'),
  historicalData: z.string().describe('Historical route and expense data for the technician in JSON format.'),
  realTimeConditions: z.string().describe('Real-time traffic and weather conditions in JSON format.'),
  optimizationGoals: z
    .string()
    .describe(
      'Specific optimization goals, such as minimizing travel time, minimizing fuel consumption, or balancing workload, in JSON format.'
    ),
});
export type OptimizeTechnicianRoutesInput = z.infer<typeof OptimizeTechnicianRoutesInputSchema>;

const OptimizeTechnicianRoutesOutputSchema = z.object({
  optimizedRoutes: z.string().describe('Optimized routes for the technician in JSON format.'),
  estimatedCostSavings: z
    .number()
    .describe('Estimated cost savings resulting from the optimized routes.'),
  estimatedTimeSavings: z
    .number()
    .number()
    .describe('Estimated time savings resulting from the optimized routes.'),
  suggestedImprovements: z
    .string()
    .describe('Suggested improvements to technician workflow and route planning.'),
});
export type OptimizeTechnicianRoutesOutput = z.infer<typeof OptimizeTechnicianRoutesOutputSchema>;

export async function optimizeTechnicianRoutes(
  input: OptimizeTechnicianRoutesInput
): Promise<OptimizeTechnicianRoutesOutput> {
  return optimizeTechnicianRoutesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'optimizeTechnicianRoutesPrompt',
  input: {schema: OptimizeTechnicianRoutesInputSchema},
  output: {schema: OptimizeTechnicianRoutesOutputSchema},
  prompt: `You are an expert in route optimization and logistics.

Analyze the technician's historical data, real-time conditions, and optimization goals to suggest optimized routes, estimate cost and time savings, and provide workflow improvements.

Technician ID: {{{technicianId}}}
Historical Data: {{{historicalData}}}
Real-time Conditions: {{{realTimeConditions}}}
Optimization Goals: {{{optimizationGoals}}}

Provide the optimized routes, estimated cost and time savings, and suggested improvements in JSON format.

Ensure that all outputs conform to JSON schemas defined in the types.
`,
});

const optimizeTechnicianRoutesFlow = ai.defineFlow(
  {
    name: 'optimizeTechnicianRoutesFlow',
    inputSchema: OptimizeTechnicianRoutesInputSchema,
    outputSchema: OptimizeTechnicianRoutesOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
