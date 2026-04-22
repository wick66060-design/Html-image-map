export interface RegionData {
  name: string;
  points: [number, number][]; // Normalized [x, y] from 0-1000
}

export interface MapOutput {
  html: string;
  regions: RegionData[];
}

export interface ImageMetadata {
  width: number;
  height: number;
  name: string;
  type: string;
  dataUrl: string;
}
