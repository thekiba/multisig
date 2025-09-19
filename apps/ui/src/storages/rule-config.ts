import { createSignal } from "solid-js";
import { DEFAULT_MULTISIG_CONFIG } from "@/utils/rule-engine";

// Local storage key for rule configuration
const RULE_CONFIG_KEY = "multisig_rule_config";

// Create a reactive signal for the rule configuration
const [ruleConfig, setRuleConfig] = createSignal<string>(
  localStorage.getItem(RULE_CONFIG_KEY) || DEFAULT_MULTISIG_CONFIG
);

// Function to update and persist the rule configuration
export function updateRuleConfig(config: string) {
  setRuleConfig(config);
  localStorage.setItem(RULE_CONFIG_KEY, config);
}

// Export the reactive signal
export { ruleConfig };


