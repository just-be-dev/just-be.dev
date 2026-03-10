import p5 from "p5";
import { Game } from "./game";

// p5.sound expects p5 as a global; must be set before the addon loads
(window as any).p5 = p5;
await import("p5/lib/addons/p5.sound");

// Wrap p5's callback-based loaders in promises
function loadFont(p: p5, path: string): Promise<p5.Font> {
  return new Promise((resolve, reject) => {
    p.loadFont(path, resolve, reject);
  });
}

function loadSound(p: p5, path: string): Promise<p5.SoundFile> {
  return new Promise((resolve, reject) => {
    (p as any).loadSound(path, resolve, reject);
  });
}

// Initialize p5.js
const container = document.getElementById("game-container");
if (container) {
  const assetBase = container.dataset.assetBase ?? "/assets/games/hangul-hero";

  new p5((p: p5) => {
    let game: Game;

    p.setup = async () => {
      // Create canvas first
      const canvas = p.createCanvas(container.clientWidth, container.clientWidth * 0.75);
      canvas.parent(container);

      // Pause the draw loop until assets are loaded
      p.noLoop();

      // Load all assets in parallel
      const [
        pixelFont,
        koreanPixelFont,
        buttonPressedSound,
        buttonReleasedSound,
        introMusic,
        gameOverSound,
        gameOverSong,
        gameMusic1,
        gameMusic2,
        gameMusic3,
        gameMusic4,
        explosion1,
        explosion2,
        explosion3,
        success1,
        success2,
        success3,
      ] = await Promise.all([
        loadFont(p, `${assetBase}/fonts/PressStart2P-Regular.ttf`),
        loadFont(p, `${assetBase}/fonts/UnifontExMono.ttf`),
        loadSound(p, `${assetBase}/sounds/button-pressed.mp3`),
        loadSound(p, `${assetBase}/sounds/button-depressed.mp3`),
        loadSound(p, `${assetBase}/sounds/hangul-hero-intro.mp3`),
        loadSound(p, `${assetBase}/sounds/game-over.mp3`),
        loadSound(p, `${assetBase}/sounds/game-over-song.mp3`),
        loadSound(p, `${assetBase}/sounds/game-music-1.mp3`),
        loadSound(p, `${assetBase}/sounds/game-music-2.mp3`),
        loadSound(p, `${assetBase}/sounds/game-music-3.mp3`),
        loadSound(p, `${assetBase}/sounds/game-music-4.mp3`),
        loadSound(p, `${assetBase}/sounds/explosion-1.mp3`),
        loadSound(p, `${assetBase}/sounds/explosion-2.mp3`),
        loadSound(p, `${assetBase}/sounds/explosion-3.mp3`),
        loadSound(p, `${assetBase}/sounds/success-1.mp3`),
        loadSound(p, `${assetBase}/sounds/success-2.mp3`),
        loadSound(p, `${assetBase}/sounds/success-3.mp3`),
      ]);

      game = new Game(p, pixelFont, koreanPixelFont, {
        explosions: [explosion1, explosion2, explosion3],
        buttonPressed: buttonPressedSound,
        buttonReleased: buttonReleasedSound,
        gameOver: gameOverSound,
        intro: introMusic,
        success: [success1, success2, success3],
        gameMusic: [gameMusic1, gameMusic2, gameMusic3, gameMusic4],
        gameOverSong: gameOverSong,
      });

      game.numColumns = Math.floor(p.width / game.columnWidth);
      p.textFont(pixelFont);

      // Setup input handling
      game.setupInput();

      // Setup start button with power state handling
      const startButton = document.getElementById("start-button");
      if (startButton) {
        startButton.addEventListener("mousedown", async () => {
          game.buttonPressStartTime = Date.now();
          await game.playSound(game.sounds.buttonPressed, {
            volume: 1.5,
            rate: 0.8,
          });
        });

        startButton.addEventListener("mouseup", async () => {
          const pressDuration = Date.now() - game.buttonPressStartTime;
          game.isLongPress = pressDuration >= game.longPressThreshold;
          game.handlePowerToggle();
          await game.playSound(game.sounds.buttonReleased, {
            volume: 1.5,
            rate: 0.8,
          });
        });

        // Handle long press
        let longPressTimer: ReturnType<typeof setTimeout>;
        startButton.addEventListener("mousedown", () => {
          longPressTimer = setTimeout(() => {
            game.isLongPress = true;
            game.handlePowerToggle();
          }, game.longPressThreshold);
        });

        startButton.addEventListener("mouseup", () => {
          clearTimeout(longPressTimer);
        });
      }

      // Assets loaded, start the draw loop
      p.loop();
    };

    p.draw = () => {
      if (!game) return;
      game.update();
      game.draw();
    };

    // Handle window resize
    p.windowResized = () => {
      p.resizeCanvas(container.clientWidth, container.clientWidth * 0.75);
      if (game) {
        game.numColumns = Math.floor(p.width / game.columnWidth);
      }
    };
  });
}
