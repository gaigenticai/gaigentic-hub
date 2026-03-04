import type { ToolDefinition } from "./types";

export const amortizationRestructurerTool: ToolDefinition = {
    name: "amortization_restructurer",
    description:
        "Calculates a new loan amortization schedule based on a hardship forbearance or modification request. Extends the term, adjusts the interest rate, and returns the new Equated Monthly Installment (EMI) and total long-term cost.",
    category: "calculation",
    stepType: "tool_call",
    parameters: {
        current_principal_balance: {
            type: "number",
            description: "Remaining principal balance on the loan.",
            required: true,
        },
        current_annual_interest_rate: {
            type: "number",
            description: "Current annual interest rate as a percentage (e.g. 5.5).",
            required: true,
        },
        remaining_months: {
            type: "number",
            description: "Current number of months remaining on the loan before modification.",
            required: true,
        },
        approved_term_extension_months: {
            type: "number",
            description: "Number of months to add to the remaining term.",
            required: true,
        },
        approved_interest_rate_reduction: {
            type: "number",
            description: "Percentage points to reduce the interest rate (e.g. 1.0 reduces 5.5% to 4.5%).",
            required: true,
        },
    },
    async execute(params) {
        const p = Number(params.current_principal_balance);
        const rCurrent = Number(params.current_annual_interest_rate);
        const mCurrent = Number(params.remaining_months);
        const mExt = Number(params.approved_term_extension_months);
        const rReduct = Number(params.approved_interest_rate_reduction);

        if (p <= 0 || mCurrent <= 0 || rCurrent <= 0) {
            return {
                success: false,
                data: null,
                summary: "Invalid current loan terms provided.",
            };
        }

        try {
            // 1. Calculate Original EMI
            const r_month_orig = (rCurrent / 100) / 12;
            const emi_orig = p * r_month_orig * Math.pow(1 + r_month_orig, mCurrent) / (Math.pow(1 + r_month_orig, mCurrent) - 1);
            const total_orig = emi_orig * mCurrent;

            // 2. Calculate New Terms
            const new_rate = Math.max(0, rCurrent - rReduct);
            const new_months = mCurrent + mExt;
            const r_month_new = (new_rate / 100) / 12;

            let emi_new = 0;
            let total_new = 0;

            if (r_month_new > 0) {
                emi_new = p * r_month_new * Math.pow(1 + r_month_new, new_months) / (Math.pow(1 + r_month_new, new_months) - 1);
            } else {
                emi_new = p / new_months; // Zero percent interest edge case
            }

            total_new = emi_new * new_months;

            const monthly_savings = emi_orig - emi_new;
            const total_cost_difference = total_new - total_orig; // Usually positive (costs more long term)

            return {
                success: true,
                data: {
                    original_terms: {
                        principal: p,
                        rate: rCurrent,
                        months_remaining: mCurrent,
                        emi: Math.round(emi_orig * 100) / 100,
                        total_remaining_cost: Math.round(total_orig * 100) / 100,
                    },
                    modified_terms: {
                        principal: p,
                        rate: new_rate,
                        months_remaining: new_months,
                        emi: Math.round(emi_new * 100) / 100,
                        total_remaining_cost: Math.round(total_new * 100) / 100,
                    },
                    impact: {
                        monthly_payment_reduction: Math.round(monthly_savings * 100) / 100,
                        percent_payment_reduction: Math.round((monthly_savings / emi_orig) * 100 * 100) / 100,
                        long_term_cost_increase: Math.round(total_cost_difference * 100) / 100,
                        is_viable_forbearance: monthly_savings > 0,
                    }
                },
                summary: `Calculated hardship restructure. Payment reduced from $${emi_orig.toFixed(2)} to $${emi_new.toFixed(2)}. Long term cost increases by $${total_cost_difference.toFixed(2)}.`,
            };

        } catch (err) {
            return {
                success: false,
                data: null,
                summary: `Amortization calculation failed: ${(err as Error).message}`,
            };
        }
    },
};
