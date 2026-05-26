import { MapClient } from "./client";

export const metadata = {
  title: "State Coverage Mapping | TechReport Dashboard",
  description: "Interactive All-India SVG coverage map showing service centers and covered districts by vendor.",
};

export default function MapPage() {
  return (
    <MapClient />
  );
}
