import { searchQuickbooksCreditMemos } from "../handlers/search-quickbooks-credit-memos.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { z } from "zod";

const toolName = "search_credit_memos";
const toolDescription = "Search credit memos in QuickBooks Online that match given criteria.";

// A subset of commonly-used CreditMemo fields that can be filtered on.
const creditMemoFieldEnum = z.enum([
  "Id",
  "SyncToken",
  "MetaData.CreateTime",
  "MetaData.LastUpdatedTime",
  "TxnDate",
  "TotalAmt",
  "Balance",
  "RemainingCredit",
  "CustomerRef",
  "DocNumber",
  "PrivateNote",
  "DepartmentRef",
  "CurrencyRef"
]).describe(
  "Field to filter on – must be a property of the QuickBooks Online CreditMemo entity."
);

const criterionSchema = z.object({
  key: z.string().describe("Simple key (legacy) – any CreditMemo property name."),
  value: z.union([z.string(), z.boolean()]),
});

// Advanced criterion schema with operator support.
const advancedCriterionSchema = z.object({
  field: creditMemoFieldEnum,
  value: z.union([z.string(), z.boolean()]),
  operator: z
    .enum(["=", "<", ">", "<=", ">=", "LIKE", "IN"])
    .optional()
    .describe("Comparison operator. Defaults to '=' if omitted."),
});

const toolSchema = z.object({
  // Allow advanced criteria array like [{field,value,operator}]
  criteria: z
    .array(advancedCriterionSchema.or(criterionSchema))
    .optional()
    .describe(
      "Filters to apply. Use the advanced form {field,value,operator?} for operators or the simple {key,value} pairs."
    ),

  limit: z.number().optional(),
  offset: z.number().optional(),
  asc: z.string().optional(),
  desc: z.string().optional(),
  fetchAll: z.boolean().optional(),
  count: z.boolean().optional(),
});

export const SearchCreditMemosTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: async (args) => {
    const { criteria = [], ...options } = (args.params ?? {}) as z.infer<typeof toolSchema>;

    // build criteria to pass to SDK, supporting advanced operator syntax
    let criteriaToSend: any;
    if (Array.isArray(criteria) && criteria.length > 0) {
      const first = criteria[0] as any;
      if (typeof first === "object" && "field" in first) {
        criteriaToSend = [...criteria, ...Object.entries(options).map(([key, value]) => ({ field: key, value }))];
      } else {
        criteriaToSend = (criteria as Array<{ key: string; value: any }>).reduce<Record<string, any>>((acc, { key, value }) => {
          if (value !== undefined && value !== null) acc[key] = value;
          return acc;
        }, { ...options });
      }
    } else {
      criteriaToSend = { ...options };
    }

    const response = await searchQuickbooksCreditMemos(criteriaToSend);
    if (response.isError) {
      return {
        content: [{ type: "text" as const, text: `Error searching credit memos: ${response.error}` }],
      };
    }
    return {
      content: [
        { type: "text" as const, text: Array.isArray(response.result) ? `Found ${response.result.length} credit memos:` : `Count: ${response.result}` },
        ...(Array.isArray(response.result)
          ? response.result.map((c) => ({ type: "text" as const, text: JSON.stringify(c) }))
          : []),
      ],
    };
  },
};
