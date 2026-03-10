import type p5 from "p5";

export class WarningMessage {
  x: number;
  y: number;
  opacity: number;
  startTime: number;
  duration: number;
  text: string;
  private p: p5;
  private flashCount: number;
  private flashDuration: number;
  private lines: string[];
  private lineHeight: number;

  constructor(p: p5, text: string) {
    this.p = p;
    this.x = p.width / 2;
    this.y = 100; // Position near the top of the screen
    this.opacity = 1;
    this.startTime = performance.now();
    this.duration = 2000; // Animation duration in milliseconds
    this.text = text;
    this.flashCount = 3; // Number of flashes
    this.flashDuration = this.duration / (this.flashCount * 2); // Duration of each flash phase (on/off)
    this.lineHeight = 25; // Space between lines
    this.lines = []; // Will be populated in wrapText()
  }

  private wrapText(p: p5, text: string, maxWidth: number): string[] {
    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const width = p.textWidth(currentLine + " " + word);
      if (width < maxWidth) {
        currentLine += " " + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    lines.push(currentLine);
    return lines;
  }

  update(): boolean {
    const elapsed = performance.now() - this.startTime;
    const progress = elapsed / this.duration;

    if (progress >= 1) {
      return false; // Animation is complete
    }

    // Calculate flash effect
    if (progress > 0.6) {
      // Start flashing at 60% of duration
      const flashProgress = (elapsed - this.duration * 0.6) / (this.duration * 0.4);
      const flashPhase = (flashProgress * this.flashCount) % 1;
      this.opacity = flashPhase > 0.5 ? 1 : 0.2; // Flash between full and 20% opacity
    } else if (progress < 0.1) {
      this.opacity = progress * 10; // Quick fade in
    } else {
      this.opacity = 1; // Stay fully visible
    }

    return true;
  }

  draw(p: p5, font: p5.Font): void {
    p.push();
    p.textFont(font);
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(16); // Further reduced from 20 to 16

    // Calculate text wrapping if not already done
    if (this.lines.length === 0) {
      this.lines = this.wrapText(p, this.text, p.width * 0.8); // Use 80% of screen width
    }

    // Calculate total height of all lines
    const totalHeight = this.lines.length * this.lineHeight;
    const startY = this.y - totalHeight / 2 + this.lineHeight / 2;

    // Draw each line
    this.lines.forEach((line, i) => {
      const lineY = startY + i * this.lineHeight;

      // Draw text shadow
      p.fill(0, 0, 0, this.opacity * 255);
      p.text(line, this.x + 2, lineY + 2);

      // Draw glowing effect
      const glowColor = p.color(255, 238, 173); // Light yellow RGB values
      for (let j = 4; j >= 1; j--) {
        glowColor.setAlpha(this.opacity * 64);
        p.fill(glowColor);
        p.text(line, this.x, lineY);
      }

      // Draw main text
      p.fill(255, 238, 173, this.opacity * 255); // Light yellow RGB values
      p.text(line, this.x, lineY);
    });

    p.pop();
  }
}
