export type RiskLevel = "high" | "medium" | "low" | "unknown";

export interface HazardRisk {
  risk: RiskLevel;
  description: string;
}

export interface Shelter {
  name: string;
  address: string;
  lat: number;
  lng: number;
  types: string[];
}

export interface HazardData {
  areaCode: string;
  areaName: string;
  updatedAt: string;
  flood: HazardRisk;
  landslide: HazardRisk;
  tsunami: HazardRisk;
  stormSurge: HazardRisk;
  shelters: Shelter[];
}

export interface WeatherWarning {
  areaCode: string;
  areaName: string;
  type: string;
  level: string;
  issuedAt: string;
}

export interface WeatherData {
  updatedAt: string;
  warnings: WeatherWarning[];
}
