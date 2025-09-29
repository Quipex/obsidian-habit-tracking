import type { PluginHarness } from "../harness";
import { flushPromises, renderHabitBlock } from "../harness";

interface HabitBlockOptions {
  title: string;
  warnHoursThreshold?: number;
  extraLines?: string[];
}

export function buildHabitDefinition(options: HabitBlockOptions): string {
  const lines = [`title: ${options.title}`];
  if (typeof options.warnHoursThreshold === "number") {
    lines.push(`warnHoursThreshold: ${options.warnHoursThreshold}`);
  }
  if (options.extraLines?.length) {
    lines.push(...options.extraLines);
  }
  return lines.join("\n");
}

export async function renderHabit(
  plugin: PluginHarness,
  habitDefinition: string,
): Promise<HTMLElement> {
  const container = await renderHabitBlock(plugin, habitDefinition);
  await flushPromises();
  return container;
}
