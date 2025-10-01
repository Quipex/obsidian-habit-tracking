import { describe, expect, it } from "vitest";
import { bootstrapPlugin } from "./harness";

class FakeEditor {
  public buffer = "";
  getCursor() {
    return { line: 0, ch: 0 };
  }
  replaceRange(text: string) {
    this.buffer = text;
  }
}

describe("command snippet", () => {
  it("inserts snippet respecting current settings", async () => {
    // given
    const plugin = await bootstrapPlugin({ defaultLayout: "row" });
    const command = plugin.commands.find((cmd) => cmd.id === "habit-button-insert-block");
    expect(command).toBeDefined();
    const editor = new FakeEditor();

    // when
    command!.editorCallback?.(editor as any);

    // then
    expect(editor.buffer).toContain("heatLayout: row");
    expect(editor.buffer).toContain("# \"grid\" or \"row\"");
  });
});
