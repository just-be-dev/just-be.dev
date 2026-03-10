import type p5 from "p5";

export class LifeCharacter {
  x: number;
  y: number;
  baseY: number;
  char: string;
  color: string;
  isLost: boolean;
  bobOffset: number;
  private font: p5.Font;

  // Predefined distinct colors for life indicators
  static readonly LIFE_COLORS = [
    "#FF6B6B", // Pink/Red
    "#4ECDC4", // Teal
    "#45B7D1", // Light Blue
    "#96CEB4", // Sage
    "#FFEEAD", // Light Yellow
    "#D4A5A5", // Light Pink
    "#ff0066", // Hot pink
    "#00ff00", // Neon green
    "#00ffff", // Cyan
    "#ffff00", // Yellow
    "#ff3399", // Pink
    "#33ccff", // Light blue
  ];

  constructor(x: number, y: number, font: p5.Font, availableColors: string[]) {
    this.x = x;
    this.y = y;
    this.baseY = y;
    this.char = "\u25CF";
    this.isLost = false;
    this.bobOffset = Math.random() * Math.PI * 2; // Random starting phase
    // Randomly select a color from the available colors
    const randomIndex = Math.floor(Math.random() * availableColors.length);
    this.color = availableColors[randomIndex];
    this.font = font;
  }

  update(p: p5, currentTime: number): void {
    if (!this.isLost) {
      // Bob up and down
      this.y = this.baseY + Math.sin(currentTime / 400 + this.bobOffset) * 3;
    }
  }

  draw(p: p5): void {
    p.push();
    p.textAlign(p.CENTER, p.CENTER);
    p.textFont(this.font);
    p.textSize(32);

    const displayColor = this.isLost ? "#FF0000" : this.color;

    if (this.isLost) {
      // Draw the lost character (Korean character that hit bottom)
      // Simple shadow for depth without blur
      p.fill(0, 0, 0, 100);
      p.text(this.char, this.x + 2, this.y + 2);

      // Main character with solid red color
      p.fill(displayColor);
      p.text(this.char, this.x, this.y);
    } else {
      // Draw animated dot
      // Simple shadow for depth
      p.fill(0, 0, 0, 100);
      p.text("\u25CF", this.x + 2, this.y + 2);

      // Main dot with fixed color
      p.fill(displayColor);
      p.text("\u25CF", this.x, this.y);
    }

    p.pop();
  }

  setLostChar(char: string): void {
    this.char = char;
    this.isLost = true;
  }
}
