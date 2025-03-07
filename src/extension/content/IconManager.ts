const ICON_BASE_PATH = chrome.runtime.getURL("assets/icons/");
const ICON_SIZES = [48, 128] as const;
const ICON_STATES = ["active", "active-filled"] as const;

type IconSize = (typeof ICON_SIZES)[number];
type IconState = (typeof ICON_STATES)[number];

export class IconManager {
  private iconCache: Record<string, ImageData> = {};
  private isPulsing = false;
  private pulseState = false;

  async preloadIcons(): Promise<void> {
    for (const size of ICON_SIZES) {
      for (const state of ICON_STATES) {
        await this.preloadIcon(size, state);
      }
    }
  }

  private async preloadIcon(size: IconSize, state: IconState): Promise<void> {
    const iconUrl = `${ICON_BASE_PATH}mic-${state}${size}.png`;
    try {
      const response = await fetch(iconUrl);
      const blob = await response.blob();
      const imageBitmap = await createImageBitmap(blob);

      const offscreenCanvas = new OffscreenCanvas(size, size);
      const ctx = offscreenCanvas.getContext(
        "2d"
      ) as OffscreenCanvasRenderingContext2D | null;

      if (ctx) {
        ctx.drawImage(imageBitmap, 0, 0);
        this.iconCache[`${state}${size}`] = ctx.getImageData(0, 0, size, size);
      } else {
        throw new Error("Failed to get 2D context from OffscreenCanvas");
      }
    } catch (error) {
      console.error(`Failed to preload icon: ${iconUrl}`, error);
    }
  }

  startPulsing(): void {
    if (this.isPulsing) return;
    this.isPulsing = true;
    this.pulseState = false;

    chrome.alarms.create("iconPulse", { periodInMinutes: 5 / 60 }, () => {
      if (chrome.runtime.lastError) {
        setInterval(() => {
          this.togglePulseState();
        }, 5000);
      }
    });

    this.updateIcon(true, true);
  }

  stopPulsing(): void {
    if (!this.isPulsing) return;
    this.isPulsing = false;
    this.pulseState = false;
    chrome.alarms.clear("iconPulse");
    this.updateIcon(false);
  }

  togglePulseState(): void {
    if (!this.isPulsing) return;
    this.pulseState = !this.pulseState;
    this.updateIcon(true, this.pulseState);
  }

  async updateIcon(
    isDubbingActive: boolean,
    pulse: boolean = false
  ): Promise<void> {
    const state = isDubbingActive
      ? pulse
        ? "active-filled"
        : "active"
      : "active-filled";
    const iconData: { [key: number]: ImageData } = {};

    ICON_SIZES.forEach((size) => {
      const cachedIcon = this.iconCache[`${state}${size}`];
      if (cachedIcon instanceof ImageData) {
        iconData[size] = cachedIcon;
      }
    });

    if (Object.keys(iconData).length === 0) {
      return console.error("No valid ImageData found in iconCache");
    }

    return new Promise((resolve, reject) => {
      chrome.action.setIcon({ imageData: iconData }, () => {
        if (chrome.runtime.lastError) {
          reject(
            new Error(`Error setting icon: ${chrome.runtime.lastError.message}`)
          );
        } else {
          resolve();
        }
      });
    });
  }
}
