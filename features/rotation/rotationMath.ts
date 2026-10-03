export type Rotation = 0 | 90 | 180 | 270;

export type Size = {
  width: number;
  height: number;
};

export function calculateRotationScale(
  rotation: Rotation,
  videoSize: Size,
  containerSize: Size
): number {
  if (rotation !== 90 && rotation !== 270) return 1;

  const values = [videoSize.width, videoSize.height, containerSize.width, containerSize.height];
  if (values.some((value) => !Number.isFinite(value) || value <= 0)) return 1;

  const rotatedWidth = videoSize.height;
  const rotatedHeight = videoSize.width;

  return Math.min(containerSize.width / rotatedWidth, containerSize.height / rotatedHeight);
}

export function createRotationTransform(rotation: Rotation, scale: number): string {
  if (rotation === 0) return "";
  if (rotation === 180) return "rotate(180deg)";
  return `rotate(${rotation}deg) scale(${scale})`;
}
