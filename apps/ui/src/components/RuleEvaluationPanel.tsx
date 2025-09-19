import { For, Show, createSignal } from "solid-js";
import { cn } from "utils";
import { AppliedRule } from "@/utils/rule-engine";

interface RuleEvaluationPanelProps {
  appliedRules: AppliedRule[];
  isLoading?: boolean;
}

export function RuleEvaluationPanel(props: RuleEvaluationPanelProps) {
  const [expanded, setExpanded] = createSignal<{ [key: string]: boolean }>({});

  const toggleExpanded = (ruleName: string) => {
    setExpanded((prev) => ({
      ...prev,
      [ruleName]: !prev[ruleName],
    }));
  };

  const getRuleStatusColor = () => {
    // Since we only show rules that pass, they're all successful
    return "text-green-600 bg-green-50 border-green-200";
  };

  const getRuleStatusIcon = () => {
    // Since we only show rules that pass, they all get a success icon
    return "✅";
  };

  return (
    <div class="bg-white rounded-lg shadow-sm p-6 mb-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-900">Matching Rules</h3>
        <Show when={props.isLoading}>
          <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
        </Show>
      </div>

      <Show
        when={!props.isLoading && props.appliedRules.length === 0}
        fallback={
          <div class="space-y-3">
            <For each={props.appliedRules}>
              {(appliedRule) => (
                <div
                  class={cn(
                    "border rounded-lg p-4 transition-all duration-200",
                    getRuleStatusColor(),
                  )}
                >
                  <div class="flex items-start justify-between">
                    <div class="flex-1">
                      <div class="flex items-center gap-2 mb-2">
                        <span class="text-lg">{getRuleStatusIcon()}</span>
                        <h4 class="font-medium text-gray-900">
                          {appliedRule.rule.name}
                        </h4>
                        <span class="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">
                          Rule Passed
                        </span>
                      </div>

                      <Show
                        when={
                          appliedRule.rule.description ||
                          appliedRule.decoder.description
                        }
                      >
                        <p class="text-sm text-gray-600 mb-2">
                          {appliedRule.rule.description ||
                            appliedRule.decoder.description}
                        </p>
                      </Show>

                      <div class="text-sm text-gray-500 mb-2">
                        <span class="font-medium">Decoder:</span>{" "}
                        {appliedRule.rule.decoder}
                      </div>

                      <Show when={appliedRule.matchedConditions.length > 0}>
                        <div class="mb-2">
                          <div class="text-sm font-medium text-gray-700 mb-1">
                            Satisfied Conditions:
                          </div>
                          <ul class="text-sm text-gray-600 space-y-1">
                            <For each={appliedRule.matchedConditions}>
                              {(condition) => (
                                <li class="flex items-center gap-2">
                                  <span class="w-2 h-2 bg-green-400 rounded-full"></span>
                                  <code class="bg-gray-100 px-2 py-1 rounded text-xs">
                                    {condition}
                                  </code>
                                </li>
                              )}
                            </For>
                          </ul>
                        </div>
                      </Show>

                      <Show when={appliedRule.rule.notify?.length > 0}>
                        <div class="flex items-center gap-2 text-sm">
                          <span class="text-gray-500">Notifications:</span>
                          <div class="flex gap-1">
                            <For each={appliedRule.rule.notify}>
                              {(channel) => (
                                <span class="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded">
                                  {channel}
                                </span>
                              )}
                            </For>
                          </div>
                        </div>
                      </Show>
                    </div>

                    <button
                      onClick={() => toggleExpanded(appliedRule.rule.name)}
                      class="ml-4 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                      title="Toggle details"
                    >
                      <svg
                        class={cn(
                          "w-5 h-5 transition-transform",
                          expanded()[appliedRule.rule.name] ? "rotate-180" : "",
                        )}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                  </div>

                  <Show when={expanded()[appliedRule.rule.name]}>
                    <div class="mt-4 pt-4 border-t border-gray-200">
                      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h5 class="font-medium text-gray-700 mb-2">
                            Rule Conditions:
                          </h5>
                          <pre class="bg-gray-50 p-3 rounded text-xs overflow-auto">
                            {JSON.stringify(appliedRule.rule.when, null, 2)}
                          </pre>
                        </div>
                        <div>
                          <h5 class="font-medium text-gray-700 mb-2">
                            Decoded Data:
                          </h5>
                          <pre class="bg-gray-50 p-3 rounded text-xs overflow-auto max-h-32">
                            {JSON.stringify(appliedRule.decodedData, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  </Show>
                </div>
              )}
            </For>
          </div>
        }
      >
        <div class="text-center py-8">
          <div class="text-4xl mb-2">⚠️</div>
          <p class="text-lg font-medium mb-1 text-amber-600">No Rules Match</p>
          <p class="text-sm text-gray-600 mb-4">
            This transaction doesn't match any configured monitoring rules.
            <br />
            Consider reviewing your rule configuration.
          </p>
          <div class="bg-amber-50 border border-amber-200 rounded-lg p-4 text-left">
            <div class="flex items-start gap-3">
              <div class="text-amber-500 mt-0.5">
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fill-rule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clip-rule="evenodd"
                  />
                </svg>
              </div>
              <div>
                <h4 class="text-sm font-medium text-amber-800 mb-1">
                  Warning: Unmonitored Transaction
                </h4>
                <p class="text-sm text-amber-700">
                  This transaction type may not be covered by your current
                  monitoring rules. You might want to add specific rules for
                  this transaction pattern.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
