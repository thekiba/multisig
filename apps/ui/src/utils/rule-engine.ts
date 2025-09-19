import { Cell } from "@ton/core";
import { parseCell } from "tlb-runtime";
import * as yaml from "js-yaml";

// Types for the monitoring config
export interface ConditionOperator {
  eq?: any;
  neq?: any;
  gt?: number | bigint;
  gte?: number | bigint;
  lt?: number | bigint;
  lte?: number | bigint;
  in?: any[];
  not_in?: any[];
  matches?: string;
  contains?: string;
}

export interface RuleCondition {
  [fieldPath: string]: ConditionOperator;
}

export interface Decoder {
  op?: string;
  tlb?: string;
  fields?: { [key: string]: string };
  decode_as?: string;
  description?: string;
}

export interface Rule {
  name: string;
  decoder: string;
  when: RuleCondition;
  notify: string[];
  description?: string;
}

export interface MonitoringConfig {
  version: number;
  rules: Rule[];
  default_notify?: string[];
  decoders: { [key: string]: Decoder };
  allowlist?: string[];
  notify?: { [key: string]: any };
}

export interface AppliedRule {
  rule: Rule;
  decoder: Decoder;
  decodedData: any;
  matchedConditions: string[];
}

export class RuleEngine {
  private config: MonitoringConfig;

  constructor(configYaml: string) {
    this.config = yaml.load(configYaml) as MonitoringConfig;
  }

  // Parse a multisig order cell and apply rules
  evaluateOrder(orderCell: Cell): AppliedRule[] {
    const appliedRules: AppliedRule[] = [];

    for (const rule of this.config.rules) {
      const decoder = this.config.decoders[rule.decoder];
      if (!decoder) {
        console.warn(`Decoder ${rule.decoder} not found`);
        continue;
      }

      try {
        const decodedData = this.decodeCell(orderCell, decoder);
        const matchedConditions = this.evaluateConditions(
          rule.when,
          decodedData,
        );

        // Check if ALL conditions in the rule are satisfied
        const allConditionsSatisfied = this.areAllConditionsSatisfied(
          rule.when,
          decodedData,
        );

        if (allConditionsSatisfied) {
          appliedRules.push({
            rule,
            decoder,
            decodedData,
            matchedConditions,
          });
        }
      } catch (error) {
        console.warn(`Failed to decode with ${rule.decoder}:`, error);
      }
    }

    return appliedRules;
  }

  // Decode a cell using the specified decoder
  private decodeCell(cell: Cell, decoder: Decoder): any {
    if (decoder.decode_as === "utf8_string") {
      try {
        const slice = cell.beginParse();
        // Skip op code if present
        if (decoder.op) {
          slice.loadUint(32);
        }
        return {
          body: {
            comment: slice.loadStringTail(),
          },
        };
      } catch (error) {
        return { body: { comment: "" } };
      }
    }

    if (decoder.tlb) {
      try {
        const parsed = parseCell(decoder.tlb, cell);
        return { body: parsed };
      } catch (error) {
        console.warn("TLB parsing failed:", error);
        return this.parseBasicStructure(cell, decoder);
      }
    }

    return this.parseBasicStructure(cell, decoder);
  }

  // Basic structure parsing for common patterns
  private parseBasicStructure(cell: Cell, decoder: Decoder): any {
    try {
      const slice = cell.beginParse();
      const result: any = { body: {} };

      // Check if op code matches
      if (decoder.op) {
        const op = slice.loadUint(32);
        const expectedOp = parseInt(decoder.op, 16);
        if (op !== expectedOp) {
          throw new Error(
            `Op code mismatch: expected ${decoder.op}, got 0x${op.toString(16)}`,
          );
        }
      }

      // Parse based on known fields
      if (decoder.fields) {
        for (const [fieldName, fieldType] of Object.entries(decoder.fields)) {
          try {
            switch (fieldType) {
              case "uint64":
                result.body[fieldName] = slice.loadUintBig(64);
                break;
              case "coins":
                result.body[fieldName] = slice.loadCoins();
                break;
              case "MsgAddress":
                result.body[fieldName] = slice.loadAddress();
                break;
              default:
                // Skip unknown field types
                break;
            }
          } catch (error) {
            // Continue parsing other fields
            break;
          }
        }
      }

      return result;
    } catch (error) {
      return { body: {} };
    }
  }

  // Check if ALL conditions in a rule are satisfied
  private areAllConditionsSatisfied(
    conditions: RuleCondition,
    data: any,
  ): boolean {
    for (const [fieldPath, operators] of Object.entries(conditions)) {
      const fieldValue = this.getNestedValue(data, fieldPath);

      // All operators for this field must be satisfied
      for (const [operator, expectedValue] of Object.entries(operators)) {
        if (
          !this.evaluateOperator(
            fieldValue,
            operator as keyof ConditionOperator,
            expectedValue,
          )
        ) {
          return false; // If any condition fails, the rule doesn't pass
        }
      }
    }

    return true; // All conditions passed
  }

  // Evaluate conditions against decoded data (for display purposes)
  private evaluateConditions(conditions: RuleCondition, data: any): string[] {
    const matchedConditions: string[] = [];

    for (const [fieldPath, operators] of Object.entries(conditions)) {
      const fieldValue = this.getNestedValue(data, fieldPath);

      for (const [operator, expectedValue] of Object.entries(operators)) {
        if (
          this.evaluateOperator(
            fieldValue,
            operator as keyof ConditionOperator,
            expectedValue,
          )
        ) {
          matchedConditions.push(
            `${fieldPath} ${operator} ${JSON.stringify(expectedValue)}`,
          );
        }
      }
    }

    return matchedConditions;
  }

  // Get nested value from object using dot notation
  private getNestedValue(obj: any, path: string): any {
    return path.split(".").reduce((current, key) => {
      return current?.[key];
    }, obj);
  }

  // Evaluate a single operator condition
  private evaluateOperator(
    value: any,
    operator: keyof ConditionOperator,
    expected: any,
  ): boolean {
    switch (operator) {
      case "eq":
        return value === expected;
      case "neq":
        return value !== expected;
      case "gt":
        return this.compareNumbers(value, expected) > 0;
      case "gte":
        return this.compareNumbers(value, expected) >= 0;
      case "lt":
        return this.compareNumbers(value, expected) < 0;
      case "lte":
        return this.compareNumbers(value, expected) <= 0;
      case "in":
        return (
          Array.isArray(expected) &&
          expected.includes(value?.toString?.() || value)
        );
      case "not_in":
        return (
          Array.isArray(expected) &&
          !expected.includes(value?.toString?.() || value)
        );
      case "matches":
        if (typeof value === "string" && typeof expected === "string") {
          try {
            return new RegExp(expected).test(value);
          } catch {
            return false;
          }
        }
        return false;
      case "contains":
        if (typeof value === "string" && typeof expected === "string") {
          return value.includes(expected);
        }
        return false;
      default:
        return false;
    }
  }

  // Compare numbers, handling both regular numbers and bigints
  private compareNumbers(a: any, b: any): number {
    const numA = typeof a === "bigint" ? a : BigInt(a || 0);
    const numB = typeof b === "bigint" ? b : BigInt(b || 0);

    if (numA < numB) return -1;
    if (numA > numB) return 1;
    return 0;
  }

  // Get the current config
  getConfig(): MonitoringConfig {
    return this.config;
  }

  // Update config from YAML string
  updateConfig(configYaml: string): void {
    this.config = yaml.load(configYaml) as MonitoringConfig;
  }
}

// Default configuration for multisig orders
export const DEFAULT_MULTISIG_CONFIG = `
version: 1

rules:
  - name: "Any Jetton Transfer"
    decoder: jetton_transfer
    when:
      body.amount:
        gt: 0
    notify: ["slack"]
    description: "Detects any Jetton token transfer"

  - name: "Text Comment Present"
    decoder: text_comment
    when:
      body.comment:
        contains: ""
    notify: ["telegram"]
    description: "Matches transactions with any text comment"

  - name: "High Value Jetton Transfer"
    decoder: jetton_transfer
    when:
      body.amount:
        gt: 1000000000
    notify: ["slack", "email"]
    description: "Detects transfers over 1 TON equivalent"

  - name: "Suspicious Text Pattern"
    decoder: text_comment
    when:
      body.comment:
        matches: "http|https|airdrop|phishing|scam"
    notify: ["telegram", "email"]
    description: "Detects potentially suspicious text in comments"

  - name: "NFT Transfer"
    decoder: nft_transfer
    when:
      body.forward_amount:
        gte: 0
    notify: ["email"]
    description: "Monitors any NFT transfer"

default_notify:
  - "slack"

decoders:
  jetton_transfer:
    op: "0x0f8a7ea5"
    tlb: >
      transfer#0f8a7ea5 query_id:uint64 amount:coins destination:MsgAddress
      response_destination:MsgAddress custom_payload:Maybe<Cell>
      forward_ton_amount:coins forward_payload:Either<Cell ^Cell>
      = InternalMsgBody;
    description: "Standard Jetton token transfer"

  jetton_notify:
    op: "0x7362d09c"
    tlb: >
      transfer#0f8a7ea5 query_id:uint64 amount:coins destination:MsgAddress
        response_destination:MsgAddress custom_payload:Maybe<Cell>
        forward_ton_amount:coins forward_payload:Either<Cell ^Cell>
        = TransferMessage;
      transfer_notification#7362d09c query_id:uint64 amount:coins
      sender:MsgAddress forward_payload:TransferMessage
      = InternalMsgBody;
    description: "Jetton transfer notification"

  nft_transfer:
    op: "0x5fcc3d14"
    tlb: >
      transfer#5fcc3d14 query_id:uint64 new_owner:MsgAddress
      response_destination:MsgAddress custom_payload:Maybe<Cell>
      forward_amount:coins forward_payload:Either<Cell ^Cell>
      = InternalMsgBody;
    description: "NFT ownership transfer"

  text_comment:
    op: "0x00000000"
    decode_as: utf8_string
    description: "Arbitrary text comment message"

allowlist: []

notify:
  slack:
    webhook: "https://hooks.slack.com/services/XXX/YYY/ZZZ"
  telegram:
    bot_token: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
    chat_id: "-1001122334455"
  email:
    smtp_server: "smtp.mailgun.org"
    smtp_user: "alerts@yourdomain.com"
    smtp_pass: "supersecret"
    recipients:
      - "you@domain.com"
      - "secops@domain.com"
`;
