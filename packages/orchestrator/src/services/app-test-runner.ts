import { v4 as uuidv4 } from 'uuid';
import { AdapterType } from '@driftcode/shared';
import type { HarnessAppTestFlow, HarnessConfig, ToolRequest, ToolResult } from '@driftcode/shared';
import type { BrowserAdapter } from '../adapters/browser-adapter.js';
import { createToolRequest, createToolResult } from '../helpers/factories.js';

export class AppTestRunner {
  constructor(
    private config: HarnessConfig,
    private browser: BrowserAdapter,
  ) {}

  findFlow(flowId: string): HarnessAppTestFlow | undefined {
    const flows = this.config.appTestFlows ?? [];
    return flows.find((flow) => flow.id === flowId || flow.name.toLowerCase() === flowId.toLowerCase());
  }

  async runFlow(flowId: string, sessionId: string): Promise<ToolResult[]> {
    const flow = this.findFlow(flowId);
    const correlationId = uuidv4();
    if (!flow) {
      const req = createToolRequest({
        sessionId,
        correlationId,
        adapter: AdapterType.Browser,
        action: 'browser.runFlow',
        parameters: { flowId },
        description: `Run flow ${flowId}`,
        sourceId: correlationId,
      });
      return [createToolResult({ toolRequest: req, success: false, errorCode: 'FLOW_NOT_FOUND', errorMessage: `No flow named ${flowId}` })];
    }

    const results: ToolResult[] = [];
    const baseUrl = this.config.devServerUrl ?? 'http://localhost:5173';

    for (const [index, step] of flow.steps.entries()) {
      const req = createToolRequest({
        sessionId,
        correlationId,
        adapter: AdapterType.Browser,
        action: `appTest.${step.type}`,
        parameters: { ...step, stepIndex: index, flowId: flow.id },
        description: `${flow.name} step ${index + 1}: ${step.type}`,
        sourceId: correlationId,
      });

      let result: ToolResult;
      switch (step.type) {
        case 'navigate': {
          const url = step.url?.startsWith('http') ? step.url : `${baseUrl.replace(/\/$/, '')}${step.url ?? '/'}`;
          result = await this.browser.executeToolRequest({ ...req, action: 'browser.navigate', parameters: { url } });
          break;
        }
        case 'click':
          result = await this.browser.executeToolRequest({ ...req, action: 'browser.click', parameters: { selector: step.selector, target: step.selector } });
          break;
        case 'fill':
          result = await this.browser.executeToolRequest({ ...req, action: 'browser.fill', parameters: { selector: step.selector, target: step.selector, value: step.value ?? '' } });
          break;
        case 'assertText':
          result = await this.browser.executeToolRequest({ ...req, action: 'browser.assertText', parameters: { text: step.text ?? '' } });
          break;
        case 'wait':
          await new Promise((resolve) => setTimeout(resolve, step.timeoutMs ?? 1000));
          result = createToolResult({ toolRequest: req, success: true, message: `Waited ${step.timeoutMs ?? 1000}ms` });
          break;
        default:
          result = createToolResult({ toolRequest: req, success: false, errorCode: 'UNKNOWN_STEP', errorMessage: step.type });
      }

      results.push(result);
      if (!result.success) break;
    }

    return results;
  }
}
