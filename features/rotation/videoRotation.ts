import {
  calculateRotationScale,
  createRotationTransform,
  type Rotation
} from "./rotationMath";

type SavedStyleProperty = {
  value: string;
  priority: string;
};

type SavedVideoStyles = Record<"transform" | "transform-origin" | "will-change", SavedStyleProperty>;

const STYLE_PROPERTIES = ["transform", "transform-origin", "will-change"] as const;

function saveVideoStyles(video: HTMLVideoElement): SavedVideoStyles {
  return Object.fromEntries(
    STYLE_PROPERTIES.map((property) => [
      property,
      {
        value: video.style.getPropertyValue(property),
        priority: video.style.getPropertyPriority(property)
      }
    ])
  ) as SavedVideoStyles;
}

function restoreVideoStyles(video: HTMLVideoElement, savedStyles: SavedVideoStyles): void {
  for (const property of STYLE_PROPERTIES) {
    const saved = savedStyles[property];
    if (saved.value) {
      video.style.setProperty(property, saved.value, saved.priority);
    } else {
      video.style.removeProperty(property);
    }
  }
}

function isVisibleVideo(video: HTMLVideoElement): boolean {
  const rect = video.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return false;

  const style = getComputedStyle(video);
  return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0;
}

export function findPrimaryVideo(root: ParentNode = document): HTMLVideoElement | null {
  return Array.from(root.querySelectorAll("video"))
    .filter(isVisibleVideo)
    .sort((left, right) => {
      const leftRect = left.getBoundingClientRect();
      const rightRect = right.getBoundingClientRect();
      return rightRect.width * rightRect.height - leftRect.width * leftRect.height;
    })[0] ?? null;
}

function nodeContainsVideo(node: Node): boolean {
  return node instanceof HTMLVideoElement || (node instanceof Element && node.querySelector("video") !== null);
}

function mutationAffectsVideo(record: MutationRecord): boolean {
  if (record.type === "attributes") return nodeContainsVideo(record.target);
  return [...Array.from(record.addedNodes), ...Array.from(record.removedNodes)].some(nodeContainsVideo);
}

export class VideoRotationFeature {
  private video: HTMLVideoElement | null = null;
  private savedStyles: SavedVideoStyles | null = null;
  private rotation: Rotation = 0;
  private readonly host = document.createElement("div");
  private readonly buttons = new Map<"quarter" | "half" | "reset", HTMLButtonElement>();
  private angleStatus: HTMLSpanElement | null = null;
  private readonly resizeObserver = new ResizeObserver(() => this.scheduleLayout());
  private readonly mutationObserver = new MutationObserver((records) => {
    if (!this.video?.isConnected || records.some(mutationAffectsVideo)) {
      this.scheduleScan();
    }
  });
  private frameId: number | null = null;
  private scanFrameId: number | null = null;

  constructor() {
    this.host.id = "bilianime-helper-rotation";
    this.host.setAttribute("aria-label", "BiliAnime Helper video rotation controls");
    Object.assign(this.host.style, {
      display: "none",
      position: "fixed",
      zIndex: "2147483647",
      pointerEvents: "none"
    });
    this.createToolbar();
  }

  start(): void {
    document.documentElement.append(this.host);
    this.mutationObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "hidden", "style"],
      childList: true,
      subtree: true
    });
    window.addEventListener("resize", this.scheduleLayout, { passive: true });
    window.addEventListener("scroll", this.scheduleLayout, { passive: true, capture: true });
    document.addEventListener("fullscreenchange", this.handleFullscreenChange);
    this.scanForVideo();
  }

  stop(): void {
    this.mutationObserver.disconnect();
    this.resizeObserver.disconnect();
    window.removeEventListener("resize", this.scheduleLayout);
    window.removeEventListener("scroll", this.scheduleLayout, true);
    document.removeEventListener("fullscreenchange", this.handleFullscreenChange);
    if (this.frameId !== null) cancelAnimationFrame(this.frameId);
    if (this.scanFrameId !== null) cancelAnimationFrame(this.scanFrameId);
    this.detachVideo();
    this.host.remove();
  }

  private readonly scheduleLayout = (): void => {
    if (this.frameId !== null) return;
    this.frameId = requestAnimationFrame(() => {
      this.frameId = null;
      this.applyRotation();
      this.positionToolbar();
    });
  };

  private readonly scheduleScan = (): void => {
    if (this.scanFrameId !== null) return;
    this.scanFrameId = requestAnimationFrame(() => {
      this.scanFrameId = null;
      this.scanForVideo();
    });
  };

  private readonly handleFullscreenChange = (): void => {
    this.scheduleScan();
    this.scheduleLayout();
  };

  private scanForVideo(): void {
    const candidate = findPrimaryVideo();
    if (candidate === this.video) {
      this.positionToolbar();
      return;
    }

    this.detachVideo();
    if (candidate) this.attachVideo(candidate);
  }

  private attachVideo(video: HTMLVideoElement): void {
    this.video = video;
    this.savedStyles = saveVideoStyles(video);
    this.resizeObserver.observe(video);
    if (video.parentElement) this.resizeObserver.observe(video.parentElement);
    this.applyRotation();
    this.positionToolbar();
  }

  private detachVideo(): void {
    if (this.video && this.savedStyles) restoreVideoStyles(this.video, this.savedStyles);
    this.resizeObserver.disconnect();
    this.video = null;
    this.savedStyles = null;
    this.host.style.display = "none";
  }

  private setRotation(rotation: Rotation): void {
    this.rotation = rotation;
    this.applyRotation();
    this.updatePressedState();
    this.positionToolbar();
  }

  private rotateQuarterTurn(): void {
    const nextRotation = ((this.rotation + 90) % 360) as Rotation;
    this.setRotation(nextRotation);
  }

  private applyRotation(): void {
    if (!this.video || !this.savedStyles) return;

    if (this.rotation === 0) {
      restoreVideoStyles(this.video, this.savedStyles);
      return;
    }

    const videoRect = {
      width: this.video.offsetWidth,
      height: this.video.offsetHeight
    };
    const containerRect = this.video.parentElement?.getBoundingClientRect() ?? videoRect;
    const scale = calculateRotationScale(this.rotation, videoRect, containerRect);

    this.video.style.setProperty("transform-origin", "center center", "important");
    this.video.style.setProperty(
      "transform",
      createRotationTransform(this.rotation, scale),
      "important"
    );
    this.video.style.setProperty("will-change", "transform");
  }

  private positionToolbar(): void {
    if (!this.video || document.fullscreenElement) {
      this.host.style.display = "none";
      return;
    }

    const rect = this.video.parentElement?.getBoundingClientRect() ?? this.video.getBoundingClientRect();
    const intersectsViewport =
      rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth;
    if (!intersectsViewport) {
      this.host.style.display = "none";
      return;
    }

    this.host.style.display = "block";
    this.host.style.visibility = "hidden";
    this.host.style.left = "0";
    this.host.style.right = "auto";
    this.host.style.top = "0";

    const toolbarRect = this.host.getBoundingClientRect();
    const gap = 8;
    const viewportPadding = 8;
    const top = rect.top - gap - toolbarRect.height;
    if (top < viewportPadding) {
      this.host.style.display = "none";
      return;
    }
    const left = Math.min(
      window.innerWidth - toolbarRect.width - viewportPadding,
      Math.max(viewportPadding, rect.right - toolbarRect.width)
    );

    this.host.style.left = `${left}px`;
    this.host.style.top = `${top}px`;
    this.host.style.visibility = "visible";
  }

  private createToolbar(): void {
    const shadow = this.host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = `
      :host { color-scheme: dark; }
      .toolbar {
        display: flex;
        align-items: center;
        gap: 3px;
        padding: 4px;
        border: 1px solid rgba(255, 255, 255, .2);
        border-radius: 8px;
        background: rgba(24, 25, 28, .82);
        box-shadow: 0 4px 14px rgba(0, 0, 0, .22);
        backdrop-filter: blur(8px);
        pointer-events: auto;
        font: 12px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      button {
        appearance: none;
        border: 0;
        border-radius: 5px;
        padding: 6px 8px;
        color: rgba(255, 255, 255, .9);
        background: transparent;
        cursor: pointer;
        font: inherit;
      }
      button:hover { background: rgba(255, 255, 255, .14); }
      button:focus-visible { outline: 2px solid #00aeec; outline-offset: 1px; }
      button[aria-pressed="true"] { color: white; background: #00aeec; }
      .angle {
        min-width: 28px;
        padding: 0 4px;
        color: rgba(255, 255, 255, .65);
        text-align: center;
        font-variant-numeric: tabular-nums;
      }
    `;
    const toolbar = document.createElement("div");
    toolbar.className = "toolbar";
    toolbar.setAttribute("role", "group");
    toolbar.setAttribute("aria-label", "Rotate video");

    const controls: Array<{
      key: "quarter" | "half" | "reset";
      label: string;
      ariaLabel: string;
      action: () => void;
    }> = [
      {
        key: "quarter",
        label: "↻ 90°",
        ariaLabel: "Rotate video clockwise by 90 degrees",
        action: () => this.rotateQuarterTurn()
      },
      {
        key: "half",
        label: "180°",
        ariaLabel: "Rotate video to 180 degrees",
        action: () => this.setRotation(180)
      },
      {
        key: "reset",
        label: "Reset",
        ariaLabel: "Reset video rotation",
        action: () => this.setRotation(0)
      }
    ];

    for (const control of controls) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = control.label;
      button.setAttribute("aria-label", control.ariaLabel);
      button.addEventListener("click", control.action);
      this.buttons.set(control.key, button);
      toolbar.append(button);
    }

    this.angleStatus = document.createElement("span");
    this.angleStatus.className = "angle";
    this.angleStatus.setAttribute("aria-live", "polite");
    toolbar.append(this.angleStatus);

    shadow.append(style, toolbar);
    this.updatePressedState();
  }

  private updatePressedState(): void {
    this.buttons.get("half")?.setAttribute("aria-pressed", String(this.rotation === 180));
    this.buttons.get("reset")?.setAttribute("aria-pressed", String(this.rotation === 0));
    this.buttons.get("quarter")?.removeAttribute("aria-pressed");
    if (this.angleStatus) this.angleStatus.textContent = `${this.rotation}°`;
  }
}
