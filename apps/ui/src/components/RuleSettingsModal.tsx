import { createSignal, Show } from "solid-js";
import { cn } from "utils";
import * as yaml from "js-yaml";

interface RuleSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: string) => void;
  currentConfig: string;
}

export function RuleSettingsModal(props: RuleSettingsModalProps) {
  const [configText, setConfigText] = createSignal(props.currentConfig);
  const [error, setError] = createSignal<string | null>(null);
  const [isSaving, setIsSaving] = createSignal(false);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const config = configText().trim();
      if (!config) {
        throw new Error("Configuration cannot be empty");
      }

      // Validate YAML syntax using js-yaml
      const parsed = yaml.load(config);

      // Basic structure validation
      if (!parsed || typeof parsed !== "object") {
        throw new Error("Configuration must be a valid YAML object");
      }

      const configObj = parsed as Record<string, unknown>;
      if (!configObj.version) {
        throw new Error("Configuration must include a version field");
      }

      if (!configObj.rules || !Array.isArray(configObj.rules)) {
        throw new Error("Configuration must include a rules array");
      }

      if (!configObj.decoders || typeof configObj.decoders !== "object") {
        throw new Error("Configuration must include a decoders object");
      }

      // Validate that each rule references a valid decoder
      for (const rule of configObj.rules) {
        const ruleObj = rule as any;
        const decodersObj = configObj.decoders as any;
        if (!ruleObj.decoder || !decodersObj[ruleObj.decoder]) {
          throw new Error(
            `Rule "${ruleObj.name || "unnamed"}" references unknown decoder: ${ruleObj.decoder}`,
          );
        }
      }

      props.onSave(config);
      props.onClose();
    } catch (err) {
      if (err instanceof yaml.YAMLException) {
        setError(`YAML syntax error: ${err.message}`);
      } else {
        setError(
          err instanceof Error ? err.message : "Invalid configuration format",
        );
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setConfigText(props.currentConfig);
    setError(null);
    props.onClose();
  };

  const resetToDefault = () => {
    setConfigText(`version: 1

rules:
  - name: "High Value Transfer"
    decoder: jetton_transfer
    when:
      body.amount:
        gt: 1000000000
    notify: ["slack"]
    description: "Detects transfers over 1 TON equivalent"

  - name: "Suspicious Text Comment"
    decoder: text_comment
    when:
      body.comment:
        matches: "http|https|airdrop|phishing"
    notify: ["telegram"]
    description: "Detects potentially suspicious text in comments"

default_notify:
  - "slack"

decoders:
  jetton_transfer:
    op: "0x0f8a7ea5"
    fields:
      query_id: uint64
      amount: coins
      destination: MsgAddress
    description: "Standard Jetton token transfer"

  text_comment:
    op: "0x00000000"
    decode_as: utf8_string
    description: "Arbitrary text comment message"

notify:
  slack:
    webhook: "https://hooks.slack.com/services/XXX/YYY/ZZZ"
  telegram:
    bot_token: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
    chat_id: "-1001122334455"`);
    setError(null);
  };

  return (
    <Show when={props.isOpen}>
      <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div class="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
          {/* Header */}
          <div class="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 class="text-xl font-semibold text-gray-900">
              Transaction Monitoring Rules
            </h2>
            <button
              onClick={handleClose}
              class="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg
                class="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div class="flex-1 p-6 overflow-hidden">
            <div class="mb-4">
              <div class="flex items-center justify-between mb-2">
                <label class="block text-sm font-medium text-gray-700">
                  Configuration (YAML format)
                </label>
                <button
                  onClick={resetToDefault}
                  class="text-sm text-blue-600 hover:text-blue-800 transition-colors"
                >
                  Reset to Default
                </button>
              </div>
              <div class="text-sm text-gray-500 mb-3">
                Define rules to monitor multisig transactions. See the{" "}
                <a
                  href="#"
                  class="text-blue-600 hover:text-blue-800"
                  onClick={(e) => {
                    e.preventDefault();
                    // You could open documentation here
                  }}
                >
                  documentation
                </a>{" "}
                for syntax details.
              </div>
            </div>

            <div class="relative flex-1">
              <textarea
                value={configText()}
                onInput={(e) => {
                  setConfigText(e.target.value);
                  setError(null);
                }}
                class={cn(
                  "w-full h-96 p-4 border rounded-lg font-mono text-sm resize-none",
                  "focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
                  error() ? "border-red-300" : "border-gray-300",
                )}
                placeholder="Paste your YAML configuration here..."
                spellcheck={false}
              />

              <Show when={error()}>
                <div class="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div class="flex items-center gap-2">
                    <svg
                      class="w-5 h-5 text-red-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span class="text-sm text-red-700 font-medium">
                      Configuration Error
                    </span>
                  </div>
                  <p class="mt-1 text-sm text-red-600">{error()}</p>
                </div>
              </Show>
            </div>
          </div>

          {/* Footer */}
          <div class="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
            <button
              onClick={handleClose}
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving() || !!error()}
              class={cn(
                "px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors",
                isSaving() || error()
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700",
              )}
            >
              {isSaving() ? (
                <div class="flex items-center gap-2">
                  <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </div>
              ) : (
                "Save Configuration"
              )}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
